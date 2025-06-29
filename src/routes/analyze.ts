/**
 * Streaming image analysis endpoint
 * Accepts POST requests with image data and returns AI-powered product analysis via SSE
 */

import { Request, Response } from "express";
import {
    Product,
    AnalyzeRequest,
    AnalysisProvider,
    ProductRanking,
} from "../types/analyze";
import { validateImageData } from "../utils/image-validator";
import { validateRankingRequest, isValidRankingRequest } from "../utils/ranking-validator";
import { AnalysisProviderFactory } from "../services/analysis-provider-factory";
import { StreamingAnalysisService } from "../services/streaming-analysis";
import { SessionManager } from "../services/session-manager";
import { logger } from "../utils/logger";

/**
 * Handles POST /analyze/stream requests for SSE
 */
export const analyzeImageStreamingHandler = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const startTime = Date.now();

    // Validate provider configuration
    const validation = AnalysisProviderFactory.validateProviderConfig();
    if (!validation.isValid) {
        res.status(500).json({
            success: false,
            error: {
                message: validation.error || "Invalid provider configuration",
                code: "PROVIDER_CONFIG_ERROR",
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }

    // Set SSE headers
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*", // Allow all origins for development, restrict in production
    });

    // Send a "start" event immediately
    const { image, sessionId } = req.body as AnalyzeRequest;
    const startData: {
        timestamp: string;
        provider: AnalysisProvider;
        sessionId?: string;
    } = {
        timestamp: new Date().toISOString(),
        provider: AnalysisProviderFactory.getCurrentProvider(),
    };

    if (sessionId) {
        const sessionManager = SessionManager.getInstance();
        const session = sessionManager.createSession(sessionId, image);
        startData.sessionId = session.sessionId;
    }

    res.write(`event: start\ndata: ${JSON.stringify(startData)}\n\n`);

    const streamingService = new StreamingAnalysisService();

    try {
        if (!image) {
            res.write(
                `event: error\ndata: ${JSON.stringify({ message: "Missing required field: image", code: "MISSING_IMAGE" })}\n\n`,
            );
            res.end();
            return;
        }

        const validationResult = validateImageData(image);
        if (!validationResult.isValid) {
            res.write(
                `event: error\ndata: ${JSON.stringify({ message: validationResult.error || "Invalid image data", code: "INVALID_IMAGE" })}\n\n`,
            );
            res.end();
            return;
        }

        await streamingService.analyzeImageStreaming(image, {
            onProduct: (product: Product) => {
                res.write(
                    `event: product\ndata: ${JSON.stringify(product)}\n\n`,
                );
            },
            onComplete: (response) => {
                const processingTime = Date.now() - startTime;
                res.write(
                    `event: complete\ndata: ${JSON.stringify({ totalProducts: 0, processingTime, usage: response.usage })}\n\n`,
                ); // totalProducts will be calculated on frontend
                res.end();
            },
            onError: (error: Error) => {
                logger.error(
                    "[ANALYZE_STREAM] Error during streaming analysis:",
                    error,
                );
                res.write(
                    `event: error\ndata: ${JSON.stringify({ message: error.message, code: "STREAMING_ERROR" })}\n\n`,
                );
                res.end();
            },
        });
    } catch (error) {
        logger.error(
            "[ANALYZE_STREAM] Uncaught error in streaming handler:",
            error,
        );
        res.write(
            `event: error\ndata: ${JSON.stringify({ message: (error as Error).message || "Internal server error during streaming analysis", code: "INTERNAL_STREAMING_ERROR" })}\n\n`,
        );
        res.end();
    }
};

export const getScreenshotHandler = (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const sessionManager = SessionManager.getInstance();
    const session = sessionManager.getSession(sessionId);

    if (session) {
        // Return the base64 data URL directly in a JSON response
        res.status(200).json({ success: true, screenshot: session.screenshot });
    } else {
        res.status(404).json({ success: false, error: "Session not found" });
    }
};

export const endSessionHandler = (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const sessionManager = SessionManager.getInstance();
    const success = sessionManager.endSession(sessionId);

    // Always return success - if session doesn't exist, it's already ended
    // This handles cases where sessions were auto-cleaned after 30 minutes
    res.status(200).json({
        success: true,
        message: success ? "Session ended" : "Session already ended or expired",
    });
};

/**
 * Handles POST /analyze/rank-products requests for SSE ranking
 */
export const rankProductsStreamingHandler = async (
    req: Request,
    res: Response,
): Promise<void> => {
    const startTime = Date.now();

    // Validate provider configuration
    const validation = AnalysisProviderFactory.validateProviderConfig();
    if (!validation.isValid) {
        res.status(500).json({
            success: false,
            error: {
                message: validation.error || "Invalid provider configuration",
                code: "PROVIDER_CONFIG_ERROR",
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }

    // Validate that Gemini is the active provider (ranking only supported on Gemini)
    const currentProvider = AnalysisProviderFactory.getCurrentProvider();
    if (currentProvider !== AnalysisProvider.GEMINI) {
        res.status(400).json({
            success: false,
            error: {
                message: `Product ranking is only supported with Gemini provider. Current provider: ${currentProvider}`,
                code: "UNSUPPORTED_PROVIDER",
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }

    // Set SSE headers
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*", // Allow all origins for development, restrict in production
    });

    // Send a "start" event immediately
    res.write(
        `event: start\ndata: ${JSON.stringify({
            timestamp: new Date().toISOString(),
            provider: currentProvider,
            feature: "ranking",
        })}\n\n`,
    );

    const streamingService = new StreamingAnalysisService();

    try {
        // Validate request body structure
        const validationResult = validateRankingRequest(req.body);
        if (!validationResult.isValid) {
            res.write(
                `event: error\ndata: ${JSON.stringify({
                    message:
                        validationResult.error || "Invalid request structure",
                    code: "INVALID_REQUEST",
                })}\n\n`,
            );
            res.end();
            return;
        }

        // Type-safe request body (validated above)
        const rankingRequest = req.body as Parameters<
            typeof isValidRankingRequest
        >[0];
        if (!isValidRankingRequest(rankingRequest)) {
            res.write(
                `event: error\ndata: ${JSON.stringify({
                    message: "Request validation failed",
                    code: "VALIDATION_ERROR",
                })}\n\n`,
            );
            res.end();
            return;
        }

        // Session-first image retrieval
        if (rankingRequest.pauseId && !rankingRequest.originalImage) {
            const sessionManager = SessionManager.getInstance();
            const session = sessionManager.getSession(rankingRequest.pauseId);

            if (session?.screenshot) {
                rankingRequest.originalImage = session.screenshot;
                logger.info(`[RANKING_STREAM] Retrieved original image from session: ${rankingRequest.pauseId}`);
            } else {
                logger.warn(`[RANKING_STREAM] Session image unavailable for pauseId: ${rankingRequest.pauseId}`);
                res.status(404).json({
                    success: false,
                    error: {
                        message: "Original image not found for the provided session ID.",
                        code: "SESSION_IMAGE_UNAVAILABLE",
                        timestamp: new Date().toISOString(),
                    },
                });
                return; // End the request
            }
        }

        await streamingService.rankProductSimilarityStreaming(rankingRequest, {
            onRanking: (ranking: ProductRanking) => {
                res.write(
                    `event: ranking\ndata: ${JSON.stringify(ranking)}\n\n`,
                );
            },
            onComplete: (response) => {
                const processingTime = Date.now() - startTime;
                res.write(
                    `event: complete\ndata: ${JSON.stringify({
                        totalRankings: response.totalRankings,
                        processingTime,
                        usage: response.usage,
                    })}\n\n`,
                );
                res.end();
            },
            onError: (error: Error) => {
                res.write(
                    `event: error\ndata: ${JSON.stringify({
                        message: error.message,
                        code: "RANKING_ERROR",
                    })}\n\n`,
                );
                res.end();
            },
        });
    } catch (error) {
        res.write(
            `event: error\ndata: ${JSON.stringify({
                message:
                    (error as Error).message ||
                    "Internal server error during ranking analysis",
                code: "INTERNAL_RANKING_ERROR",
            })}\n\n`,
        );
        res.end();
    }
};
