/**
 * Type definitions for image analysis endpoint
 */

export interface AnalyzeRequest {
    image: string; // base64 data URL
    sessionId?: string; // Optional client-generated ID
    metadata?: {
        timestamp: string;
    };
}

export interface Session {
    sessionId: string;
    screenshot: string; // base64 data URL
    timestamp: number;
}

import { IconCategory } from "../config/icon-categories";

export enum Category {
    CLOTHING = "clothing",
    ELECTRONICS = "electronics",
    FURNITURE = "furniture",
    ACCESSORIES = "accessories",
    FOOTWEAR = "footwear",
    HOME_DECOR = "home_decor",
    BOOKS_MEDIA = "books_media",
    SPORTS_FITNESS = "sports_fitness",
    BEAUTY_PERSONAL_CARE = "beauty_personal_care",
    KITCHEN_DINING = "kitchen_dining",
    OTHER = "other",
}

export interface Product {
    name: string;
    iconCategory: IconCategory;
    category: Category;
    brand: string;
    primaryColor: string;
    secondaryColors: string[];
    features: string[];
    targetGender: TargetGender;
    searchTerms: string;
    confidence: number;
}

export enum TargetGender {
    MEN = "men",
    WOMEN = "women",
    UNISEX = "unisex",
    BOY = "boy",
    GIRL = "girl",
}

export interface OpenAIConfig {
    apiKey: string;
    model: string;
    maxTokens: number;
    promptCostPerToken: number;
    completionCostPerToken: number;
}

export interface OpenAIResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface OpenRouterConfig {
    apiKey: string;
    model: string;
    maxTokens: number;
    siteUrl?: string;
    siteName?: string;
    promptCostPerToken: number;
    completionCostPerToken: number;
}

export interface OpenRouterResponse {
    content: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    reasoning?: string; // OpenRouter specific
}

export interface OpenRouterStreamChoice {
    choices?: {
        delta?: {
            content?: string;
        };
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface GeminiConfig {
    apiKey: string;
    model: string;
    deepSearchModel: string;
    promptCostPerToken: number;
    completionCostPerToken: number;
}

export interface GeminiResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        thoughtsTokenCount?: number;
        candidatesTokenCount?: number;
    };
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface AnalyzeErrorResponse {
    success: false;
    error: {
        message: string;
        code: string;
        timestamp: string;
    };
}

export interface ImageValidationResult {
    isValid: boolean;
    width?: number;
    height?: number;
    format?: string;
    sizeBytes?: number;
    error?: string;
}

export interface RequestyConfig {
    apiKey: string;
    model: string;
    maxTokens: number;
    siteUrl?: string;
    siteName?: string;
    promptCostPerToken: number;
    completionCostPerToken: number;
}

export interface RequestyResponse {
    content: string;
    usage?:
        | {
              promptTokens: number;
              completionTokens: number;
              totalTokens: number;
          }
        | undefined;
}

export enum AnalysisProvider {
    OPENAI = "openai",
    REQUESTY = "requesty",
    GEMINI = "gemini",
    OPENROUTER = "openrouter",
}

export interface StreamingCallbacks {
    onProduct: (product: Product) => void;
    onComplete: (
        response:
            | OpenAIResponse
            | RequestyResponse
            | GeminiResponse
            | OpenRouterResponse,
    ) => void;
    onError: (error: Error) => void;
}

export interface PartialProductParser {
    parse(partialResponse: string): Product[];
}

// ============================================================================
// RANKING TYPES - New interfaces for product ranking functionality
// ============================================================================

export interface RankingRequest {
    originalImage?: string;          // base64 original video frame (optional)
    pauseId?: string;                // ID for session-based image retrieval (optional)
    productName: string;             // from product metadata
    category: Category;              // from product metadata
    thumbnails: ThumbnailData[];     // array of thumbnail images with IDs
}

export interface ThumbnailData {
    id: string;                      // unique identifier
    image: string;                   // base64 thumbnail image
}

export interface ProductRanking {
    id: string;                      // matches thumbnail ID
    similarityScore: number;         // 0-100 confidence score
    rank: number;                    // 1-10 position
}

export interface RankingCallbacks {
    onRanking: (ranking: ProductRanking) => void;    // Stream each rank as it's determined
    onComplete: (response: RankingCompleteResponse) => void;
    onError: (error: Error) => void;
}

export interface RankingCompleteResponse {
    totalRankings: number;
    processingTime: number;
    usage?: TokenUsage;
}

export interface AnalysisService {
    supportsStreaming(): boolean;
    analyzeImageStreaming(
        imageData: string,
        callbacks: StreamingCallbacks,
        language?: string,
    ): Promise<void>;
    // New streaming method for ranking
    rankProductSimilarityStreaming(
        request: RankingRequest, 
        callbacks: RankingCallbacks
    ): Promise<void>;
}
