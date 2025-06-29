import {
    AnalysisService,
    Product,
    StreamingCallbacks,
    GeminiResponse,
    OpenAIResponse,
    RequestyResponse,
    OpenRouterResponse,
    RankingRequest,
    RankingCallbacks,
    ProductRanking,
    RankingCompleteResponse,
} from "../types/analyze";
import { AnalysisProviderFactory } from "./analysis-provider-factory";
import { logger } from "../utils/logger";

interface StreamingAnalysisCallbacks extends StreamingCallbacks {
    onStart?: () => void;
    onProgress?: (progress: { processed: number; estimated: number }) => void;
}


export class StreamingAnalysisService {
    private provider: AnalysisService;
    private providerName: string;

    constructor() {
        this.provider = AnalysisProviderFactory.createProvider();
        this.providerName = AnalysisProviderFactory.getCurrentProvider();
    }

    public async analyzeImageStreaming(
        imageData: string,
        callbacks: StreamingAnalysisCallbacks,
    ): Promise<void> {
        const products: Product[] = [];

        logger.log("[ANALYZE_STREAM] =================================");
        logger.log("[ANALYZE_STREAM] Starting streaming image analysis request");
        logger.log(`[ANALYZE_STREAM] Provider: ${this.providerName}`);
        logger.log("[ANALYZE_STREAM] =================================");

        callbacks.onStart?.();

        try {
            await this.provider.analyzeImageStreaming(imageData, {
                onProduct: (product: Product) => {
                    logger.log(
                        `[${new Date()
                            .toTimeString()
                            .slice(
                                0,
                                8
                            )}] ${product.name} (category: ${product.category}, icon: ${product.iconCategory}, confidence: ${product.confidence})`
                    );
                    logger.log(`Search term: ${product.searchTerms}`);
                    logger.log('===========================');
                    products.push(product);
                    callbacks.onProduct(product);
                },
                onComplete: (
                    response:
                        | GeminiResponse
                        | OpenAIResponse
                        | RequestyResponse
                        | OpenRouterResponse,
                ) => {
                    callbacks.onComplete(response);
                },
                onError: (error: Error) => {
                    callbacks.onError(error);
                },
            });
        } catch (error) {
            callbacks.onError(error as Error);
        }
    }

    public async rankProductSimilarityStreaming(
        request: RankingRequest,
        callbacks: RankingCallbacks,
    ): Promise<void> {
        const rankings: ProductRanking[] = [];

        logger.log("[RANKING_STREAM] =================================");
        logger.log("[RANKING_STREAM] Starting streaming ranking analysis request");
        logger.log(`[RANKING_STREAM] Provider: ${this.providerName}`);
        logger.log(`[RANKING_STREAM] Product: ${request.productName}`);
        logger.log(`[RANKING_STREAM] Thumbnails: ${request.thumbnails.length}`);
        logger.log("[RANKING_STREAM] =================================");

        // Validate provider supports ranking (only Gemini for now)
        if (this.providerName.toUpperCase() !== "GEMINI") {
            const error = new Error(`Product ranking is only supported with Gemini provider. Current provider: ${this.providerName}`);
            callbacks.onError(error);
            return;
        }

        try {
            await this.provider.rankProductSimilarityStreaming(request, {
                onRanking: (ranking: ProductRanking) => {
                    logger.log(
                        `[${new Date()
                            .toTimeString()
                            .slice(
                                0,
                                8
                            )}] Rank ${ranking.rank}: ${ranking.id} (similarity: ${ranking.similarityScore}%)`
                    );
                    rankings.push(ranking);
                    callbacks.onRanking(ranking);
                },
                onComplete: (response: RankingCompleteResponse) => {
                    logger.log("[RANKING_STREAM] =================================");
                    logger.log(`[RANKING_STREAM] Ranking analysis completed`);
                    logger.log(`[RANKING_STREAM] Total rankings: ${response.totalRankings}`);
                    logger.log(`[RANKING_STREAM] Processing time: ${response.processingTime}ms`);
                    logger.log("[RANKING_STREAM] =================================");
                    callbacks.onComplete(response);
                },
                onError: (error: Error) => {
                    logger.error("[RANKING_STREAM] Error during ranking analysis:", error);
                    callbacks.onError(error);
                },
            });
        } catch (error) {
            callbacks.onError(error as Error);
        }
    }
}
