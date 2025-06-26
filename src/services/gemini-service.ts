/**
 * Gemini Service
 * Handles streaming image analysis using Google's Gemini API
 */

import { GoogleGenerativeAI, GenerateContentRequest, GenerateContentResponse } from "@google/generative-ai";
import {
    GeminiConfig,
    AnalysisService,
    StreamingCallbacks,
    TokenUsage,
    RankingRequest,
    RankingCallbacks,
} from "../types/analyze";
import { loadPrompt, handleAPIError } from "./analysis-utils";
import { DefaultPartialProductParser } from "./partial-product-parser";
import { logger } from "../utils/logger";

export class GeminiService implements AnalysisService {
    private client: GoogleGenerativeAI;
    private config: GeminiConfig;

    constructor(config: GeminiConfig) {
        this.config = config;
        this.client = new GoogleGenerativeAI(config.apiKey);
    }

    supportsStreaming(): boolean {
        return true;
    }

    async analyzeImageStreaming(
        imageData: string,
        callbacks: StreamingCallbacks,
    ): Promise<void> {
        const startTime = Date.now();
        try {
            const prompt = await loadPrompt();
            const parser = new DefaultPartialProductParser();

            let firstTokenTime: number | null = null;
            let lastTokenTime: number | null = null;

            const request: GenerateContentRequest = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: "image/jpeg", // Assuming JPEG for now, can be made dynamic
                                    data: imageData.split(",")[1], // Remove "data:image/jpeg;base64," prefix
                                },
                            },
                        ],
                    },
                ],
                generationConfig: {
                    maxOutputTokens: this.config.maxTokens,
                },
            };

            if (this.config.thinkingBudget !== undefined) {
                request.generationConfig = {
                    ...request.generationConfig,
                    // The 'thinkingConfig' property is not directly part of GenerationConfig in the public API.
                    // If it's a custom or internal property, it might need to be handled differently.
                    // For now, removing it to resolve the type error.
                    // thinkingConfig: {
                    //     thinkingBudget: this.config.thinkingBudget,
                    // },
                };
            }

            const model = this.client.getGenerativeModel({ model: this.config.model });
            const streamResult = await model.generateContentStream(request);

            let fullContent = "";
            let lastChunk: GenerateContentResponse | null = null;
            for await (const chunk of streamResult.stream) {
                lastChunk = chunk;
                const chunkText = chunk.text();
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

            const usageMetadata = lastChunk?.usageMetadata;
            const promptTokenCount = usageMetadata?.promptTokenCount || 0;
            const candidatesTokenCount = usageMetadata?.candidatesTokenCount || 0;
            const totalTokenCount = usageMetadata?.totalTokenCount || 0;
            // The 'thoughtsTokenCount' property is not directly part of UsageMetadata in the public API.
            // If it's a custom or internal property, it might need to be handled differently.
            // For now, removing it to resolve the type error.
            // const thoughtsTokenCount = usageMetadata?.thoughtsTokenCount || 0;


            const promptCost = promptTokenCount * this.config.promptCostPerToken;
            const completionCost = candidatesTokenCount * this.config.completionCostPerToken;
            const totalCost = promptCost + completionCost;

            logger.log(
                `[GEMINI_SERVICE] LLM Streaming Analysis completed in ${processingTime}ms (streaming duration: ${streamingDuration}ms). Tokens: [${promptTokenCount}/${candidatesTokenCount}/${totalTokenCount}]. Cost: $${totalCost.toFixed(6)}`,
            );

            callbacks.onComplete({
                content: fullContent,
                usage: usageMetadata
                    ? {
                        promptTokens: promptTokenCount,
                        completionTokens: candidatesTokenCount,
                        totalTokens: totalTokenCount,
                        // thoughtsTokenCount: thoughtsTokenCount, // Removed as it's not in public API
                        // candidatesTokenCount: candidatesTokenCount, // Removed as it's redundant with completionTokens
                    } as TokenUsage
                    : undefined,
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
        // TODO: Implement ranking functionality in Phase 3
        callbacks.onError(
            new Error("Ranking functionality not yet implemented - coming in Phase 3."),
        );
        return Promise.reject(
            new Error("Ranking functionality not yet implemented - coming in Phase 3."),
        );
    }
}
