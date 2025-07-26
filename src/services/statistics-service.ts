/**
 * Statistics tracking service using Google Firestore
 */

import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { Statistics, StatisticType } from '../types/statistics';
import { logger } from '../utils/logger';

export class StatisticsService {
    private static instance: StatisticsService;
    private db: Firestore | null = null;
    private app: App | null = null;
    private initialized = false;

    private constructor() {}

    static getInstance(): StatisticsService {
        if (!StatisticsService.instance) {
            StatisticsService.instance = new StatisticsService();
        }
        return StatisticsService.instance;
    }

    /**
     * Initialize Firestore connection
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            const projectId = process.env.GCP_PROJECT_ID;
            
            if (!projectId) {
                logger.warn('[STATISTICS] GCP_PROJECT_ID not set, statistics tracking disabled');
                return;
            }

            // Check if running on Google Cloud (Cloud Run, App Engine, etc.)
            const isGoogleCloud = process.env.K_SERVICE || process.env.GAE_SERVICE;
            
            if (isGoogleCloud) {
                // Use Application Default Credentials on Google Cloud
                this.app = initializeApp({
                    projectId
                });
                logger.info('[STATISTICS] Initialized with Application Default Credentials');
            } else {
                // Local development - use service account
                const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
                
                if (!serviceAccountPath) {
                    logger.warn('[STATISTICS] No service account credentials found for local development');
                    logger.warn('[STATISTICS] Set GOOGLE_APPLICATION_CREDENTIALS env var or run: gcloud auth application-default login');
                    return;
                }

                this.app = initializeApp({
                    credential: cert(serviceAccountPath),
                    projectId
                });
                logger.info('[STATISTICS] Initialized with service account credentials');
            }

            this.db = getFirestore(this.app, 'ff-statistics');
            this.initialized = true;
            
            // Initialize daily stats document if it doesn't exist
            await this.initializeDailyStats();
            
            logger.info('[STATISTICS] Firestore statistics service initialized successfully');
        } catch (error) {
            logger.error('[STATISTICS] Failed to initialize Firestore:', error);
            // Don't throw - allow the app to run without statistics
        }
    }

    /**
     * Initialize today's daily stats document
     */
    private async initializeDailyStats(): Promise<void> {
        if (!this.db) return;

        const today = new Date().toISOString().split('T')[0];
        const dailyRef = this.db.collection('daily').doc(today);
        
        try {
            await dailyRef.set({
                websiteVisits: 0,
                imageAnalyses: 0,
                deepSearches: 0,
                pausesRegistered: 0,
                date: today
            }, { merge: true });
        } catch (error) {
            logger.error('[STATISTICS] Failed to initialize daily stats:', error);
        }
    }

    /**
     * Increment a statistic counter
     */
    async increment(type: StatisticType, count: number = 1): Promise<void> {
        if (!this.db) {
            logger.debug(`[STATISTICS] Would increment ${type} by ${count} (Firestore not initialized)`);
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        
        try {
            // Update total counter
            const totalRef = this.db.collection('statistics').doc('total');
            await totalRef.set({
                [type]: FieldValue.increment(count),
                lastUpdated: FieldValue.serverTimestamp()
            }, { merge: true });

            // Update daily counter
            const dailyRef = this.db.collection('daily').doc(today);
            await dailyRef.set({
                [type]: FieldValue.increment(count),
                date: today,
                lastUpdated: FieldValue.serverTimestamp()
            }, { merge: true });

            logger.debug(`[STATISTICS] Incremented ${type} by ${count}`);
        } catch (error) {
            logger.error(`[STATISTICS] Failed to increment ${type}:`, error);
        }
    }

    /**
     * Get current statistics
     */
    async getStatistics(): Promise<Statistics | null> {
        if (!this.db) {
            return null;
        }

        try {
            const doc = await this.db.collection('statistics').doc('total').get();
            
            if (!doc.exists) {
                return {
                    websiteVisits: 0,
                    imageAnalyses: 0,
                    deepSearches: 0,
                    pausesRegistered: 0
                };
            }

            const data = doc.data() as Statistics;
            return data;
        } catch (error) {
            logger.error('[STATISTICS] Failed to get statistics:', error);
            return null;
        }
    }

    /**
     * Get statistics for a specific date
     */
    async getDailyStatistics(date: string): Promise<Statistics | null> {
        if (!this.db) {
            return null;
        }

        try {
            const doc = await this.db.collection('daily').doc(date).get();
            
            if (!doc.exists) {
                return {
                    websiteVisits: 0,
                    imageAnalyses: 0,
                    deepSearches: 0,
                    pausesRegistered: 0
                };
            }

            const data = doc.data() as Statistics;
            return data;
        } catch (error) {
            logger.error(`[STATISTICS] Failed to get daily statistics for ${date}:`, error);
            return null;
        }
    }

    /**
     * Track website visit
     */
    async trackWebsiteVisit(): Promise<void> {
        await this.increment(StatisticType.WEBSITE_VISIT);
    }

    /**
     * Track image analysis
     */
    async trackImageAnalysis(): Promise<void> {
        await this.increment(StatisticType.IMAGE_ANALYSIS);
    }

    /**
     * Track deep search
     */
    async trackDeepSearch(): Promise<void> {
        await this.increment(StatisticType.DEEP_SEARCH);
    }

    /**
     * Track pause registered
     */
    async trackPauseRegistered(): Promise<void> {
        await this.increment(StatisticType.PAUSE_REGISTERED);
    }
}