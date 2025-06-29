# AI-Powered Product Ranking Implementation Plan

## Overview
Implement a new `/analyze/rank-products` endpoint that uses AI to compare Amazon product thumbnails against an original video frame image to rank products by visual similarity. This will reuse as much existing Gemini AI infrastructure as possible.

## Current Architecture Analysis

### Existing Components We Can Reuse
- **GeminiService**: Core AI service with streaming capabilities
- **AnalysisProviderFactory**: Provider management and configuration
- **StreamingAnalysisService**: Orchestration layer for AI analysis
- **Analysis Utils**: Prompt loading, error handling, validation
- **Type System**: Base interfaces for AI services and responses
- **Route Structure**: Express routing patterns and error handling

### Existing Flow Pattern
1. Request validation and provider setup
2. Image validation and preprocessing
3. Prompt loading and AI service invocation
4. Streaming response handling with callbacks
5. Error handling and logging

## Implementation Strategy

### Phase 1: Type System Extensions

#### 1.1 New Request/Response Interfaces
```typescript
// Add to src/types/analyze.ts
interface RankingRequest {
    originalImage: string;           // base64 original video frame
    productName: string;             // from product metadata
    thumbnails: ThumbnailData[];     // array of thumbnail images with IDs
}

interface ThumbnailData {
    id: string;                      // unique identifier
    image: string;                   // base64 thumbnail image
}

interface RankingResponse {
    rankings: ProductRanking[];      // top 10 matches
    processingTime: number;
    usage?: TokenUsage;
}

interface ProductRanking {
    id: string;                      // matches thumbnail ID
    similarityScore: number;         // 0-100 confidence score
    rank: number;                    // 1-10 position
}
```

#### 1.2 Service Interface Extensions
```typescript
// New streaming callbacks for ranking
interface RankingCallbacks {
    onRanking: (ranking: ProductRanking) => void;    // Stream each rank as it's determined
    onComplete: (response: RankingCompleteResponse) => void;
    onError: (error: Error) => void;
}

interface RankingCompleteResponse {
    totalRankings: number;
    processingTime: number;
    usage?: TokenUsage;
}

// Extend AnalysisService interface
interface AnalysisService {
    // Existing method
    analyzeImageStreaming(imageData: string, callbacks: StreamingCallbacks): Promise<void>;
    
    // New streaming method for ranking
    rankProductSimilarityStreaming(request: RankingRequest, callbacks: RankingCallbacks): Promise<void>;
}
```

### Phase 2: Prompt Engineering

#### 2.1 Create Ranking Prompt
- **Location**: `src/prompts/product-ranking.txt`
- **Purpose**: Instruct AI to compare thumbnails against original image
- **Key Elements**:
  - Visual similarity analysis instructions
  - Focus on product name context
  - Scoring criteria (0-100 scale)
  - JSON output format for rankings
  - Top 10 limitation

#### 2.2 Prompt Structure
```
Analyze the original image and compare it against the provided product thumbnails to find the most visually similar products to [PRODUCT_NAME].

TASK: Rank the thumbnails by visual similarity to the [PRODUCT_NAME] visible in the original image.

SCORING CRITERIA:
- Visual appearance match (40 points)
- Color similarity (25 points)
- Shape/form similarity (20 points)
- Style/design similarity (15 points)

STREAMING OUTPUT INSTRUCTIONS:
- Stream rankings one by one, starting with rank 1 (highest similarity)
- Output each ranking immediately as you determine it
- Stop after outputting the top 10 rankings
- Format each ranking as a complete JSON object on its own line

JSON FORMAT for each ranking:
{
    "id": "thumbnail_id",
    "similarityScore": 85,
    "rank": 1
}
```

### Phase 3: Service Layer Implementation

#### 3.1 Extend GeminiService
- **File**: `src/services/gemini-service.ts`
- **New Method**: `rankProductSimilarityStreaming()`
- **Approach**: 
  - Reuse existing Gemini client setup and streaming infrastructure
  - Create multi-image request format
  - Handle streaming response similar to existing `analyzeImageStreaming()`
  - Parse each JSON ranking object as it streams
  - Stop processing after 10th ranking

#### 3.2 Implementation Details
```typescript
async rankProductSimilarityStreaming(request: RankingRequest, callbacks: RankingCallbacks): Promise<void> {
    // 1. Load ranking prompt
    // 2. Inject product name into prompt
    // 3. Prepare multi-image request (original + thumbnails) - images pre-formatted by frontend
    // 4. Call Gemini API with streaming
    // 5. Parse each ranking JSON object as it streams
    // 6. Call onRanking callback for each parsed ranking
    // 7. Stop after 10 rankings or stream ends
    // 8. Call onComplete with final metrics
}
```

#### 3.3 Multi-Image Request Format
- Original image as first image with context
- All thumbnails as subsequent images
- Prompt references images by position
- Gemini handles multiple images in single request

### Phase 4: Route Implementation

#### 4.1 New Route Handler
- **File**: `src/routes/analyze.ts`
- **Function**: `rankProductsStreamingHandler()`
- **Endpoint**: `POST /analyze/rank-products`
- **Response Type**: Server-Sent Events (SSE) like existing analyze endpoint

#### 4.2 Request Flow
```typescript
export const rankProductsStreamingHandler = async (req: Request, res: Response): Promise<void> => {
    // 1. Set SSE headers (same as existing analyze endpoint)
    // 2. Send start event
    // 3. Validate request body structure (product name, thumbnails array)
    // 4. Validate provider configuration (ensure Gemini)
    // 5. Create ranking service instance
    // 6. Execute streaming ranking analysis with callbacks:
    //    - onRanking: stream each ranking as "ranking" event
    //    - onComplete: stream completion as "complete" event
    //    - onError: stream error as "error" event
    // 7. End SSE connection
}
```

#### 4.3 Route Registration
- **File**: `src/routes/index.ts`
- **Addition**: `router.post("/analyze/rank-products", rankProductsStreamingHandler)`

### Phase 5: Service Orchestration

#### 5.1 Extend StreamingAnalysisService
- **File**: `src/services/streaming-analysis.ts`
- **New Method**: `rankProductSimilarityStreaming()`
- **Purpose**: Orchestrate ranking analysis similar to existing streaming analysis
- **Features**: 
  - Provider management and logging
  - Ranking collection and progress tracking
  - Automatic stopping after 10 rankings

#### 5.2 Provider Factory Integration
- **Reuse**: Existing `AnalysisProviderFactory`
- **Gemini Only**: Ranking feature will only support Gemini provider
- **Validation**: Ensure Gemini is configured and available
- **Fallback**: Return error if Gemini is not the active provider

### Phase 6: Error Handling & Validation

#### 6.1 Input Validation
- **Product Name**: Basic string validation (required, non-empty)
- **Request Structure**: JSON schema validation
- **Image Data**: Frontend ensures proper base64 format and sizing

#### 6.2 Error Scenarios
- Too many thumbnails (limit to reasonable number)
- AI service failures
- Malformed AI responses
- Gemini provider configuration issues
- Non-Gemini provider selected (ranking not supported)
- Missing or invalid product name

#### 6.3 Graceful Degradation
- Return empty rankings on failure
- Log errors for debugging
- Maintain service availability

## Implementation Phases

### Phase 1: Foundation (Types & Interfaces)
1. Extend `src/types/analyze.ts` with ranking interfaces
2. Update `AnalysisService` interface
3. Add validation helpers

### Phase 2: Prompt Engineering
1. Create `src/prompts/product-ranking.txt`
2. Test prompt with sample data
3. Refine based on AI response quality

### Phase 3: Core Service Implementation
1. Extend `GeminiService` with streaming ranking method
2. Implement multi-image request handling
3. Add streaming JSON parsing for individual rankings
4. Implement early termination after 10 rankings

### Phase 4: Route & Orchestration
1. Create route handler in `src/routes/analyze.ts`
2. Register route in `src/routes/index.ts`
3. Extend `StreamingAnalysisService` for ranking

### Phase 5: Testing & Refinement
1. Test with sample images and thumbnails
2. Validate response format and accuracy
3. Performance optimization
4. Error handling verification

## Technical Considerations

### Image Handling
- **Frontend Responsibility**: All image formatting, sizing, and base64 encoding handled by frontend
- **Backend Simplification**: Backend receives properly formatted base64 images
- **Batch Size**: Limit number of thumbnails (e.g., max 20)
- **Direct Processing**: Pass images directly to Gemini without additional validation

### AI Service Optimization
- **Streaming Architecture**: Reuse existing streaming infrastructure for real-time ranking delivery
- **Early Termination**: Stop processing after 10th ranking to save tokens and time
- **Token Management**: Monitor token usage for multi-image requests
- **Response Parsing**: Robust JSON parsing for individual ranking objects
- **Timeout Handling**: Appropriate timeouts for larger requests

### Performance Considerations
- **Caching**: Consider caching similar ranking requests
- **Async Processing**: Handle multiple thumbnails efficiently
- **Memory Management**: Minimal memory usage since images are pre-processed
- **Rate Limiting**: Protect against abuse

### Compatibility
- **Provider Support**: Gemini only for ranking feature
- **Provider Validation**: Clear error messages when non-Gemini provider is active
- **API Versioning**: Consider future API changes
- **Backward Compatibility**: Don't break existing analysis endpoint

## Success Criteria

### Functional Requirements
- ✅ Accept original image + thumbnails with IDs
- ✅ Return top 10 ranked matches with scores
- ✅ Reuse existing Gemini infrastructure
- ✅ Graceful error handling
- ✅ Reasonable response times (<30 seconds)

### Technical Requirements
- ✅ Type safety throughout
- ✅ Consistent error handling patterns
- ✅ Proper logging and monitoring
- ✅ Input validation and sanitization
- ✅ Memory efficient processing

### Integration Requirements
- ✅ Seamless integration with existing codebase
- ✅ No breaking changes to existing endpoints
- ✅ Consistent API patterns and responses
- ✅ Proper provider configuration reuse

### Future Enhancements

### Potential Improvements
- **Caching Layer**: Cache ranking results for identical requests
- **Batch Optimization**: Optimize for large thumbnail sets
- **Multiple Providers**: Extend ranking support to other AI providers (OpenAI, etc.)
- **Advanced Scoring**: More sophisticated similarity algorithms
- **Performance Metrics**: Detailed timing and accuracy metrics

### Monitoring & Analytics
- **Usage Tracking**: Monitor ranking request patterns
- **Accuracy Metrics**: Track ranking quality over time
- **Performance Monitoring**: Response times and error rates
- **Cost Tracking**: Token usage and API costs

## Risk Mitigation

### Technical Risks
- **AI Response Quality**: Extensive prompt testing and refinement
- **Performance Issues**: Proper timeout and resource management
- **Gemini Dependency**: Single provider dependency, ensure robust error handling
- **Request Size**: Large payloads with multiple images, monitor performance

### Operational Risks
- **Cost Management**: Monitor token usage and implement limits
- **Rate Limiting**: Protect against abuse and overuse
- **Error Recovery**: Robust error handling and logging
- **Scalability**: Design for future growth and load

## Conclusion

This implementation plan leverages the existing robust Gemini AI infrastructure while adding the new streaming ranking capability. By reusing the GeminiService, AnalysisProviderFactory, and established streaming patterns, we can implement the feature efficiently while maintaining code quality and consistency.

The focus on Gemini as the sole provider simplifies the initial implementation while ensuring we can leverage Gemini's multi-image capabilities effectively. The streaming architecture provides real-time ranking delivery with automatic termination after 10 results, optimizing both user experience and resource usage.

The phased approach allows for iterative development and testing, ensuring each component works correctly before moving to the next phase. The focus on error handling and graceful degradation ensures the new feature won't impact existing functionality.