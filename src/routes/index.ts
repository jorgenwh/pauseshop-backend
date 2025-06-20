/**
 * Route aggregator
 */

import { Router } from "express";
import { healthCheckHandler } from "./health";
import { analyzeImageStreamingHandler } from "./analyze";

const router = Router();

// Health check endpoint
router.get("/health", healthCheckHandler);

// Streaming image analysis endpoint (only endpoint available)
router.post("/analyze/stream", (req, res, next) => {
  void analyzeImageStreamingHandler(req, res).catch(next);
});

export default router;
