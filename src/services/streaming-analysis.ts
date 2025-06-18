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

interface StreamingAnalysisCallbacks extends StreamingCallbacks {
    onStart?: () => void;
    onProgress?: (progress: { processed: number; estimated: number }) => void;
}

export class StreamingAnalysisService {
    private provider: AnalysisService;

    constructor() {
        this.provider = AnalysisProviderFactory.createProvider();
    }

    public async analyzeImageStreaming(
        imageData: string,
        callbacks: StreamingAnalysisCallbacks,
    ): Promise<void> {
        const products: Product[] = [];

        callbacks.onStart?.();

        try {
            await this.provider.analyzeImageStreaming(imageData, {
                onProduct: (product: Product) => {
                    // console.info(
                    //     `[${new Date()
                    //         .toISOString()
                    //         .substr(
                    //             11,
                    //             12
                    //         )}] ${product.name} (category: ${product.category}, icon: ${product.iconCategory}, confidence: ${product.confidence})`
                    // );
                    // console.info(`Search term: ${product.searchTerms}`);
                    // console.info('===========================');
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
