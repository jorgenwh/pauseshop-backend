/**
 * OpenRouter Service
 * Handles streaming image analysis using OpenRouter's API with support for multiple models
 */

import {
    AnalysisService,
    OpenRouterConfig,
    StreamingCallbacks,
    OpenRouterResponse,
    OpenRouterStreamChoice,
    RankingRequest,
    RankingCallbacks,
} from "../types/analyze";
import { handleAPIError, loadPrompt } from "./analysis-utils";
import { DefaultPartialProductParser } from "./partial-product-parser";

export class OpenRouterService implements AnalysisService {
    private config: OpenRouterConfig;

    constructor(config: OpenRouterConfig) {
        this.config = config;
    }

    /**
     * Check if streaming is supported
     */
    supportsStreaming(): boolean {
        return true;
    }

    /**
     * Analyze image with streaming
     */
    async analyzeImageStreaming(
        imageData: string,
        callbacks: StreamingCallbacks,
    ): Promise<void> {
        try {
            const prompt = await loadPrompt();
            const parser = new DefaultPartialProductParser();

            let _firstTokenTime: number | null = null;
            let _lastTokenTime: number | null = null;

            const body = JSON.stringify({
                model: this.config.model,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: imageData,
                                },
                            },
                        ],
                    },
                ],
                stream: true,
                max_tokens: this.config.maxTokens,
            });

            const response = await fetch(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.config.apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": this.config.siteUrl || "",
                        "X-Title": this.config.siteName || "",
                    },
                    body,
                },
            );

            const reader = response.body?.getReader();
            if (!reader) throw new Error("Response body is not readable");

            const decoder = new TextDecoder();
            let buffer = "";
            let fullContent = "";
            let usage: OpenRouterResponse["usage"] = undefined;

            try {
                let reading = true;
                while (reading) {
                    const { done, value } = (await reader.read()) as { done: boolean; value: Uint8Array | undefined };
                    if (done) {
                        reading = false;
                        break;
                    }

if (!value) continue;
                    buffer += decoder.decode(value, { stream: true });

                    let lineEnd: number;
                    while ((lineEnd = buffer.indexOf("\n")) !== -1) {
                        const line = buffer.slice(0, lineEnd).trim();
                        buffer = buffer.slice(lineEnd + 1);

                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") {
                                reading = false;
                                break;
                            }

                            try {
                                const parsed =
                                    JSON.parse(data) as OpenRouterStreamChoice;
                                const content =
                                    parsed.choices?.[0]?.delta?.content || "";
                                if (content) {
                                    if (_firstTokenTime === null) {
                                        _firstTokenTime = Date.now();
                                    }
                                    _lastTokenTime = Date.now();

                                    fullContent += content;
                                    const products = parser.parse(content);
                                    products.forEach((product) =>
                                        callbacks.onProduct(product),
                                    );
                                }
                                if (parsed.usage) {
                                    usage = {
                                        prompt_tokens:
                                            parsed.usage.prompt_tokens,
                                        completion_tokens:
                                            parsed.usage.completion_tokens,
                                        total_tokens:
                                            parsed.usage.total_tokens,
                                    };
                                }
                            } catch (e) {
                                // Ignore invalid JSON
                            }
                        }
                    }
                }
            } finally {
                reader.cancel().catch(_error => {
                    // Fail silently
                });
            }

            if (_firstTokenTime && _lastTokenTime) {
                // First and last token times are available
            }

            const promptCost =
                (usage?.prompt_tokens || 0) * this.config.promptCostPerToken;
            const completionCost =
                (usage?.completion_tokens || 0) *
                this.config.completionCostPerToken;
            const totalCost = promptCost + completionCost;
            if (totalCost) {
                // Total cost is available
            }
            
            callbacks.onComplete({
                content: fullContent,
                usage: usage
                    ? {
                        prompt_tokens: usage.prompt_tokens,
                        completion_tokens: usage.completion_tokens,
                        total_tokens: usage.total_tokens,
                    }
                    : undefined,
            });
        } catch (error) {
            callbacks.onError(handleAPIError(error, "OPENROUTER"));
        }
    }

    async rankProductSimilarityStreaming(
        request: RankingRequest,
        callbacks: RankingCallbacks,
    ): Promise<void> {
        // OpenRouter ranking is not yet implemented - only Gemini supports ranking
        callbacks.onError(
            new Error("Product ranking is only supported with Gemini provider."),
        );
        return Promise.reject(
            new Error("Product ranking is only supported with Gemini provider."),
        );
    }
}
