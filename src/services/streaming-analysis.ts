import {
    AnalysisService,
    Product,
    StreamingCallbacks,
    GeminiResponse,
    OpenAIResponse,
    RequestyResponse,
    OpenRouterResponse,
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
}
