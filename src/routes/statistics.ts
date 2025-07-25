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
 * Track clicked Amazon link event from extension
 * POST /api/statistics/clickedAmazonLink
 */
export const trackClickedAmazonLinkHandler = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        await StatisticsService.getInstance().trackClickedAmazonLink();
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error("[STATISTICS] Failed to track pause:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to track 'clicked Amazon link' event"
        });
    }
};

/**
 * Track redirects to extension Google Web Store page event from website
 * POST /api/statistics/extensionRedirect
 */
export const trackExtensionRedirectHandler = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        await StatisticsService.getInstance().trackExtensionRedirect();
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error("[STATISTICS] Failed to track pause:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to track 'extension redirect' event"
        });
    }
};

/**
 * Track redirects to extension Google Web Store page event from website's /extension page
 * POST /api/statistics/extensionRedirectPage
 */
export const trackExtensionRedirectPageHandler = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        await StatisticsService.getInstance().trackExtensionRedirectPage();
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error("[STATISTICS] Failed to track pause:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to track 'extension redirect page' event"
        });
    }
};

/**
 * Get current statistics
 * GET /api/statistics/total
 */
export const getTotalStatisticsHandler = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const stats = await StatisticsService.getInstance().getTotalStatistics();
        res.status(200).json({ 
            success: true, 
            statistics: stats
        });
    } catch (error) {
        logger.error("[STATISTICS] Failed to get statistics:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to get total statistics" 
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
            statistics: stats
        });
    } catch (error) {
        logger.error("[STATISTICS] Failed to get daily statistics:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to get daily statistics" 
        });
    }
};
