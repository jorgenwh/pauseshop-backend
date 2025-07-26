/**
 * Route aggregator
 */

import { Router } from "express";
import { healthCheckHandler } from "./health";
import {
    analyzeImageStreamingHandler,
    getScreenshotHandler,
    endSessionHandler,
    rankProductsStreamingHandler,
} from "./analyze";
import {
    trackWebsiteVisitHandler,
    trackPauseHandler,
    getTotalStatisticsHandler,
    getDailyStatisticsHandler,
} from "./statistics";

const router = Router();

// Health check endpoint
router.get("/health", healthCheckHandler);

// Streaming image analysis endpoint
router.post("/analyze/stream", (req, res, next) => {
    void analyzeImageStreamingHandler(req, res).catch(next);
});

// Session management endpoints
router.get("/session/:sessionId/screenshot", getScreenshotHandler);
router.post("/session/:sessionId/end", endSessionHandler);

// Streaming product ranking endpoint
router.post("/analyze/rank-products", (req, res, next) => {
    void rankProductsStreamingHandler(req, res).catch(next);
});

// Statistics endpoints
router.post("/statistics/website-visit", (req, res, next) => {
    void trackWebsiteVisitHandler(req, res).catch(next);
});

router.post("/statistics/pause", (req, res, next) => {
    void trackPauseHandler(req, res).catch(next);
});

router.get("/statistics/total", (req, res, next) => {
    void getTotalStatisticsHandler(req, res).catch(next);
});

router.get("/statistics/daily/:date", (req, res, next) => {
    void getDailyStatisticsHandler(req, res).catch(next);
});

export default router;
