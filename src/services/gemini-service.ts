/**
 * Gemini Service
 * Handles streaming image analysis using Google's Gemini API
 */

import { GoogleGenAI } from "@google/genai";
import {
    GeminiConfig,
    AnalysisService,
    StreamingCallbacks,
    TokenUsage,
    RankingRequest,
    RankingCallbacks,
} from "../types/analyze";
import { loadPrompt, loadRankingPrompt, handleAPIError } from "./analysis-utils";
import { DefaultPartialProductParser } from "./partial-product-parser";
import { DefaultPartialRankingParser } from "./partial-ranking-parser";
import { logger } from "../utils/logger";

// Type definitions for Gemini API response structure
interface GeminiUsageMetadata {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    responseTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
}

interface GeminiChunk {
    text?: string;
    usageMetadata?: GeminiUsageMetadata;
}

export class GeminiService implements AnalysisService {
    private client: GoogleGenAI;
    private config: GeminiConfig;

    constructor(config: GeminiConfig) {
        this.config = config;
        this.client = new GoogleGenAI({
            apiKey: config.apiKey,
        });
    }

    supportsStreaming(): boolean {
        return true;
    }

    async analyzeImageStreaming(
        imageData: string,
        callbacks: StreamingCallbacks,
        language: string = 'en',
    ): Promise<void> {
        const startTime = Date.now();
        try {
            const prompt = await loadPrompt(language);
            const parser = new DefaultPartialProductParser();

            let firstTokenTime: number | null = null;
            let lastTokenTime: number | null = null;
            let lastChunk: GeminiChunk | null = null;

            // Extract MIME type from base64 data URL
            const mimeTypeMatch = imageData.match(/^data:([^;]+);base64,/);
            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

            const response = await this.client.models.generateContentStream({
                model: this.config.model,
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: imageData.split(",")[1],
                                },
                            },
                        ],
                    },
                ],
                config: {
                    thinkingConfig: {
                        thinkingBudget: 0,
                    },
                },
            });

            let fullContent = "";
            for await (const chunk of response) {
                lastChunk = chunk;
                const chunkText = chunk.text || "";
                if (chunkText) {
                    if (firstTokenTime === null) {
                        firstTokenTime = Date.now();
                    }
                    lastTokenTime = Date.now();

                    fullContent += chunkText;
                    const products = parser.parse(chunkText);
                    products.forEach((product) => callbacks.onProduct(product));
                }
            }

            const processingTime = Date.now() - startTime;
            const streamingDuration = lastTokenTime && firstTokenTime ? lastTokenTime - firstTokenTime : 0;

            // Extract usage metadata from the last chunk
            const usageMetadata = lastChunk?.usageMetadata;
            const promptTokenCount = usageMetadata?.promptTokenCount || 0;
            const candidatesTokenCount = usageMetadata?.candidatesTokenCount || usageMetadata?.responseTokenCount || 0;
            const totalTokenCount = usageMetadata?.totalTokenCount || 0;
            const thoughtsTokenCount = usageMetadata?.thoughtsTokenCount || 0;

            const promptCost = promptTokenCount * this.config.promptCostPerToken;
            const completionCost = candidatesTokenCount * this.config.completionCostPerToken;
            const totalCost = promptCost + completionCost;

            logger.log(
                `[GEMINI_SERVICE] LLM Streaming Analysis completed in ${processingTime}ms (streaming duration: ${streamingDuration}ms). Tokens: [${promptTokenCount}/${candidatesTokenCount}/${totalTokenCount}]${thoughtsTokenCount ? ` (thoughts: ${thoughtsTokenCount})` : ''}. Cost: $${totalCost.toFixed(6)}`,
            );

            callbacks.onComplete({
                content: fullContent,
                usage: {
                    promptTokens: promptTokenCount,
                    completionTokens: candidatesTokenCount,
                    totalTokens: totalTokenCount,
                } as TokenUsage,
            });
        } catch (error) {
            logger.error(
                "[GEMINI_SERVICE] Error during streaming image analysis:",
                error,
            );
            callbacks.onError(handleAPIError(error, "GEMINI"));
        }
    }

    async rankProductSimilarityStreaming(
        request: RankingRequest,
        callbacks: RankingCallbacks,
    ): Promise<void> {
        const startTime = Date.now();
        try {
            // Load ranking prompt with product name injection
            const prompt = await loadRankingPrompt(
                request.productName,
                request.category,
            );
            const parser = new DefaultPartialRankingParser();

            let firstTokenTime: number | null = null;
            let lastTokenTime: number | null = null;
            let rankingCount = 0;
            let lastChunk: GeminiChunk | null = null;

            // Prepare multi-image request: original image + all thumbnails
            if (!request.originalImage) {
                throw new Error("Original image is required for ranking.");
            }

            // Extract MIME type from original image
            const originalMimeTypeMatch = request.originalImage.match(/^data:([^;]+);base64,/);
            const originalMimeType = originalMimeTypeMatch ? originalMimeTypeMatch[1] : "image/jpeg";

            const imageParts = [
                // Original image first
                {
                    inlineData: {
                        mimeType: originalMimeType,
                        data: request.originalImage.split(",")[1], // Remove base64 prefix
                    },
                }
            ];

            // Add all thumbnail images
            request.thumbnails.forEach(thumbnail => {
                // Extract MIME type from each thumbnail
                const thumbnailMimeTypeMatch = thumbnail.image.match(/^data:([^;]+);base64,/);
                const thumbnailMimeType = thumbnailMimeTypeMatch ? thumbnailMimeTypeMatch[1] : "image/jpeg";

                imageParts.push({
                    inlineData: {
                        mimeType: thumbnailMimeType,
                        data: thumbnail.image.split(",")[1], // Remove base64 prefix
                    },
                });
            });

            const geminiStartTime = Date.now();
            const response = await this.client.models.generateContentStream({
                model: this.config.deepSearchModel,
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: prompt },
                            ...imageParts
                        ],
                    },
                ],
                config: {
                    thinkingConfig: {
                        thinkingBudget: 512,
                    },
                },
            });

            for await (const chunk of response) {
                lastChunk = chunk;
                const chunkText = chunk.text || "";
                if (chunkText) {
                    if (firstTokenTime === null) {
                        firstTokenTime = Date.now();
                    }
                    lastTokenTime = Date.now();

                    // Parse rankings from the current chunk
                    const rankings = parser.parse(chunkText);

                    // Stream each ranking and check if we should stop
                    rankings.forEach((ranking) => {
                        if (rankingCount < 10) { // Stop at 10 rankings
                            callbacks.onRanking(ranking);
                            rankingCount++;
                        }
                    });

                    // Stop streaming if we've reached 10 rankings
                    if (rankingCount >= 10) {
                        break;
                    }
                }
            }

            const geminiElapsedTime = Date.now() - geminiStartTime;

            // After the stream ends, flush the parser buffer to get any remaining rankings
            const remainingRankings = parser.flush();
            remainingRankings.forEach((ranking) => {
                if (rankingCount < 10) {
                    callbacks.onRanking(ranking);
                    rankingCount++;
                }
            });

            const processingTime = Date.now() - startTime;
            const streamingDuration = lastTokenTime && firstTokenTime ? lastTokenTime - firstTokenTime : 0;

            // Extract usage metadata from the last chunk
            const usageMetadata = lastChunk?.usageMetadata;
            const promptTokenCount = usageMetadata?.promptTokenCount || 0;
            const candidatesTokenCount = usageMetadata?.candidatesTokenCount || usageMetadata?.responseTokenCount || 0;
            const totalTokenCount = usageMetadata?.totalTokenCount || 0;
            const thoughtsTokenCount = usageMetadata?.thoughtsTokenCount || 0;

            const promptCost = promptTokenCount * this.config.promptCostPerToken;
            const completionCost = candidatesTokenCount * this.config.completionCostPerToken;
            const totalCost = promptCost + completionCost;

            logger.log(
                `[GEMINI_SERVICE] Gemini querying time completed in ${geminiElapsedTime}ms using model: ${this.config.deepSearchModel}`
            );
            logger.log(
                `[GEMINI_SERVICE] Ranking Analysis completed in ${processingTime}ms (streaming duration: ${streamingDuration}ms). Rankings: ${rankingCount}/10. Tokens: [${promptTokenCount}/${candidatesTokenCount}/${totalTokenCount}]${thoughtsTokenCount ? ` (thoughts: ${thoughtsTokenCount})` : ''}. Cost: $${totalCost.toFixed(6)}`,
            );

            callbacks.onComplete({
                totalRankings: rankingCount,
                processingTime,
                usage: {
                    promptTokens: promptTokenCount,
                    completionTokens: candidatesTokenCount,
                    totalTokens: totalTokenCount,
                } as TokenUsage,
            });

        } catch (error) {
            logger.error(
                "[GEMINI_SERVICE] Error during ranking analysis:",
                error,
            );
            callbacks.onError(handleAPIError(error, "GEMINI"));
        }
    }
}
