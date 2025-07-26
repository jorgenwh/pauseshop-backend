/**
 * Statistics tracking endpoints
 */

import { Request, Response } from "express";
import { StatisticsService } from "../services/statistics-service";
import { logger } from "../utils/logger";

/**
 * Track website visit
 * POST /api/statistics/website-visit
 */
export const trackWebsiteVisitHandler = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        await StatisticsService.getInstance().trackWebsiteVisit();
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error("[STATISTICS] Failed to track website visit:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to track visit" 
        });
    }
};

/**
 * Track pause event from extension
 * POST /api/statistics/pause
 */
export const trackPauseHandler = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        await StatisticsService.getInstance().trackPauseRegistered();
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error("[STATISTICS] Failed to track pause:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to track pause" 
        });
    }
};

/**
 * Get current statistics
 * GET /api/statistics
 */
export const getStatisticsHandler = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const stats = await StatisticsService.getInstance().getStatistics();
        res.status(200).json({ 
            success: true, 
            statistics: stats || {
                websiteVisits: 0,
                imageAnalyses: 0,
                deepSearches: 0,
                pausesRegistered: 0
            }
        });
    } catch (error) {
        logger.error("[STATISTICS] Failed to get statistics:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to get statistics" 
        });
    }
};

/**
 * Get statistics for a specific date
 * GET /api/statistics/daily/:date
 */
export const getDailyStatisticsHandler = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const { date } = req.params;
        
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.status(400).json({ 
                success: false, 
                error: "Invalid date format. Use YYYY-MM-DD" 
            });
            return;
        }
        
        const stats = await StatisticsService.getInstance().getDailyStatistics(date);
        res.status(200).json({ 
            success: true, 
            date,
            statistics: stats || {
                websiteVisits: 0,
                imageAnalyses: 0,
                deepSearches: 0,
                pausesRegistered: 0
            }
        });
    } catch (error) {
        logger.error("[STATISTICS] Failed to get daily statistics:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to get daily statistics" 
        });
    }
};