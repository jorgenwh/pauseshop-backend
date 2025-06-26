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

export default router;
