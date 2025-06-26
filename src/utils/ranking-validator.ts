/**
 * Validation utilities for ranking requests
 */

import { RankingRequest } from "../types/analyze";

export interface RankingValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validate a ranking request structure and content
 */
export const validateRankingRequest = (body: unknown): RankingValidationResult => {
    // Check if body exists and is an object
    if (!body || typeof body !== "object") {
        return {
            isValid: false,
            error: "Request body must be a valid object",
        };
    }

    const request = body as Record<string, unknown>;

    // Validate originalImage
    if (!request.originalImage || typeof request.originalImage !== "string") {
        return {
            isValid: false,
            error: "Missing or invalid originalImage field",
        };
    }

    // Validate productName
    if (!request.productName || typeof request.productName !== "string" || request.productName.trim().length === 0) {
        return {
            isValid: false,
            error: "Missing or invalid productName field",
        };
    }

    // Validate thumbnails array
    if (!Array.isArray(request.thumbnails)) {
        return {
            isValid: false,
            error: "thumbnails must be an array",
        };
    }

    if (request.thumbnails.length === 0) {
        return {
            isValid: false,
            error: "thumbnails array cannot be empty",
        };
    }

    // Limit number of thumbnails to prevent abuse
    const MAX_THUMBNAILS = 50;
    if (request.thumbnails.length > MAX_THUMBNAILS) {
        return {
            isValid: false,
            error: `Too many thumbnails. Maximum allowed: ${MAX_THUMBNAILS}`,
        };
    }

    // Validate each thumbnail
    for (let i = 0; i < request.thumbnails.length; i++) {
        const thumbnail = request.thumbnails[i] as unknown;

        if (!thumbnail || typeof thumbnail !== "object") {
            return {
                isValid: false,
                error: `Thumbnail at index ${i} must be an object`,
            };
        }

        const thumbObj = thumbnail as Record<string, unknown>;

        if (!thumbObj.id || typeof thumbObj.id !== "string" || thumbObj.id.trim().length === 0) {
            return {
                isValid: false,
                error: `Thumbnail at index ${i} missing or invalid id field`,
            };
        }

        if (!thumbObj.image || typeof thumbObj.image !== "string") {
            return {
                isValid: false,
                error: `Thumbnail at index ${i} missing or invalid image field`,
            };
        }
    }

    return { isValid: true };
};

/**
 * Type guard to ensure a validated request is properly typed
 */
export const isValidRankingRequest = (body: unknown): body is RankingRequest => {
    const validation = validateRankingRequest(body);
    return validation.isValid;
};
