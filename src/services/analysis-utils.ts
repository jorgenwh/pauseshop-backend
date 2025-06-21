/**
 * Analysis Utilities
 * Shared functionality for analysis services
 */

import { promises as fs } from "fs";
import { resolve } from "path";
import { Product, TargetGender, Category } from "../types/analyze";
import { ICON_CATEGORIES, IconCategory } from "../config/icon-categories";
import { logger } from "../utils/logger";

// Shared prompt cache
let promptCache: string | null = null;

/**
 * Load the prompt from file (shared cache)
 */
export async function loadPrompt(): Promise<string> {
    if (promptCache) {
        return promptCache;
    }

    let serverMode = process.env.SERVER_MODE || "dev";
    if (serverMode !== "prod" && serverMode !== "dev") {
        logger.warn(`Invalid SERVER_MODE: ${serverMode}. Defaulting to 'prod'.`);
        serverMode = "prod";
    }

    try {
        const promptPath = resolve(
            __dirname,
            serverMode === "prod"
                ? "/usr/src/app/src/prompts/product-analysis-v4.txt"
                : "../prompts/product-analysis-v4.txt"
        );
        let promptContent = await fs.readFile(promptPath, "utf-8");

        // Dynamically inject product categories into the prompt
        const iconCategoriesList = ICON_CATEGORIES.map(
            (cat) => `'${cat}'`,
        ).join(", ");
        promptContent = promptContent.replace(
            "[LIST_OF_CATEGORIES_HERE]",
            iconCategoriesList,
        );

        promptCache = promptContent.trim();
        return promptCache;
    } catch (error) {
        throw new Error("Failed to load image analysis prompt");
    }
}

/**
 * Extract JSON from response, handling potential extra text
 */
export function extractJSONFromResponse(response: string): string {
    const jsonStart = response.indexOf("{");
    if (jsonStart === -1) throw new Error("No JSON found in response");

    const jsonEnd = response.lastIndexOf("}");
    if (jsonEnd === -1) throw new Error("Incomplete JSON in response");

    return response.substring(jsonStart, jsonEnd + 1);
}

/**
 * Validate and sanitize products array
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateAndSanitizeProducts(products: unknown[]): Product[] {
    return products
        .filter((product): product is RawProductData => isValidProduct(product))
        .map((product) => sanitizeProduct(product));
}

/**
 * Define a type for raw product data from API responses
 */
interface RawProductData {
    name?: unknown;
    iconCategory?: unknown;
    category?: unknown;
    brand?: unknown;
    primaryColor?: unknown;
    secondaryColors?: unknown;
    features?: unknown;
    targetGender?: unknown;
    searchTerms?: unknown;
    confidence?: unknown;
}

/**
 * Check if product has all required fields
 */
function isValidProduct(product: unknown): boolean {
    if (!product || typeof product !== "object") return false;
    
    const p = product as RawProductData;
    
    return (
        typeof p.name === "string" &&
        typeof p.iconCategory === "string" &&
        typeof p.category === "string" &&
        typeof p.brand === "string" &&
        typeof p.primaryColor === "string" &&
        Array.isArray(p.secondaryColors) &&
        Array.isArray(p.features) &&
        typeof p.targetGender === "string" &&
        typeof p.searchTerms === "string" &&
        typeof p.confidence === "number" &&
        p.confidence >= 1 &&
        p.confidence <= 10
    );
}

/**
 * Sanitize and normalize product data
 */
function sanitizeProduct(product: RawProductData): Product {
    // We've already validated the types in isValidProduct, but we'll be extra careful here
    const name = typeof product.name === 'string' ? product.name : '';
    const iconCategory = typeof product.iconCategory === 'string' ? product.iconCategory : '';
    const category = typeof product.category === 'string' ? product.category : '';
    const brand = typeof product.brand === 'string' ? product.brand : '';
    const primaryColor = typeof product.primaryColor === 'string' ? product.primaryColor : '';
    const secondaryColors = Array.isArray(product.secondaryColors) ? product.secondaryColors : [];
    const features = Array.isArray(product.features) ? product.features : [];
    const targetGender = typeof product.targetGender === 'string' ? product.targetGender : '';
    const searchTerms = typeof product.searchTerms === 'string' ? product.searchTerms : '';
    const confidence = typeof product.confidence === 'number' ? product.confidence : 6;
    
    return {
        name: String(name).substring(0, 100).trim(),
        iconCategory: validateIconCategory(iconCategory),
        category: validateBroadCategory(category),
        brand: String(brand).substring(0, 50).trim(),
        primaryColor: String(primaryColor).substring(0, 30).trim(),
        secondaryColors: sanitizeStringArray(secondaryColors, 30, 3),
        features: sanitizeStringArray(features, 50, 5),
        targetGender: validateTargetGender(targetGender),
        searchTerms: String(searchTerms).substring(0, 200).trim(),
        confidence: Math.max(1, Math.min(10, Math.round(Number(confidence) || 6))),
    };
}

/**
 * Validate product category, fallback to OTHER if invalid
 */
function validateIconCategory(iconCategory: string): IconCategory {
    // Ensure the icon category is one of the predefined product categories
    return ICON_CATEGORIES.includes(iconCategory)
        ? (iconCategory)
        : ("other" as IconCategory); // Fallback to "other" if category is not in the list
}

/**
 * Validate broad category, fallback to OTHER if invalid
 */
function validateBroadCategory(category: string): Category {
    const validCategories = Object.values(Category);
    return validCategories.includes(category as Category)
        ? (category as Category)
        : Category.OTHER; // Fallback to "other" if category is not in the list
}

/**
 * Validate target gender, fallback to UNISEX if invalid
 */
function validateTargetGender(targetGender: string): TargetGender {
    const validGenders = Object.values(TargetGender);
    return validGenders.includes(targetGender as TargetGender)
        ? (targetGender as TargetGender)
        : TargetGender.UNISEX;
}

/**
 * Sanitize array of strings with length and count limits
 */
function sanitizeStringArray(
    arr: unknown,
    maxLength: number,
    maxCount: number,
): string[] {
    if (!Array.isArray(arr)) return [];

    return arr
        .slice(0, maxCount)
        .map((item) => String(item).substring(0, maxLength).trim())
        .filter((item) => item.length > 0);
}

/**
 * Type for API errors with common properties
 */
interface ApiErrorLike {
    status?: number;
    code?: string;
    message?: string;
}

/**
 * Handle API errors with service-specific prefixes
 */
export function handleAPIError(error: unknown, servicePrefix: string): never {
    // Try to extract useful information from the error
    const apiError: ApiErrorLike = {};
    
    if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>;
        
        if (typeof err.status === 'number') {
            apiError.status = err.status;
        }
        
        if (typeof err.code === 'string') {
            apiError.code = err.code;
        }
        
        if (typeof err.message === 'string') {
            apiError.message = err.message;
        }
    }

    if (apiError.status === 401) {
        throw new Error(`${servicePrefix}_AUTH_ERROR`);
    }
    if (apiError.status === 429) {
        throw new Error(`${servicePrefix}_RATE_LIMIT`);
    }
    if (apiError.code === "ECONNRESET" || apiError.code === "ETIMEDOUT") {
        throw new Error(`${servicePrefix}_TIMEOUT`);
    }

    throw new Error(`${servicePrefix}_API_ERROR${apiError.message ? ': ' + apiError.message : ''}`);
}
