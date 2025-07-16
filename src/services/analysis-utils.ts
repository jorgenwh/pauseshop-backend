/**
 * Analysis Utilities
 * Shared functionality for analysis services
 */

import { promises as fs } from "fs";
import { resolve } from "path";
import { Product, TargetGender, Category } from "../types/analyze";
import { ICON_CATEGORIES, IconCategory } from "../config/icon-categories";
import { logger } from "../utils/logger";

// Shared prompt caches - now keyed by language
const promptCache: Map<string, string> = new Map();

/**
 * Load the prompt from file with language injection
 */
export async function loadPrompt(language: string = 'en'): Promise<string> {
    const cacheKey = language;
    if (promptCache.has(cacheKey)) {
        return promptCache.get(cacheKey)!;
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

        // Inject language instructions if language is not English
        if (language !== 'en') {
            const languageNames: Record<string, string> = {
                'es': 'Spanish',
                'de': 'German', 
                'fr': 'French',
                'it': 'Italian',
                'ja': 'Japanese',
                'ko': 'Korean',
                'pt_BR': 'Portuguese (Brazil)',
                'hi': 'Hindi',
                'tr': 'Turkish',
                'ar': 'Arabic'
            };
            
            const languageName = languageNames[language] || 'English';
            const languageInstruction = `\n\nIMPORTANT: Respond in ${languageName} language. All product names, brands, colors, features, and descriptions should be in ${languageName}. EXCEPTION: The "iconCategory" and "category" fields must ALWAYS remain in English as they need to match the predefined system values.`;
            promptContent = promptContent + languageInstruction;
        }

        const finalPrompt = promptContent.trim();
        promptCache.set(cacheKey, finalPrompt);
        return finalPrompt;
    } catch (error) {
        throw new Error("Failed to load image analysis prompt");
    }
}

/**
 * Load the ranking prompt from file and inject product name
 */
export async function loadRankingPrompt(
    productName: string,
    category: Category,
    language: string = 'en',
): Promise<string> {
    const promptFileName = `${category}.txt`;
    const defaultPromptFileName = "default.txt";

    let serverMode = process.env.SERVER_MODE || "dev";
    if (serverMode !== "prod" && serverMode !== "dev") {
        logger.warn(`Invalid SERVER_MODE: ${serverMode}. Defaulting to 'prod'.`);
        serverMode = "prod";
    }

    const getPromptPath = (fileName: string) => {
        return resolve(
            __dirname,
            serverMode === "prod"
                ? `/usr/src/app/src/prompts/ranking/${fileName}`
                : `../prompts/ranking/${fileName}`,
        );
    };

    let promptPath = getPromptPath(promptFileName);
    let promptContent: string;
    let loadedPromptFile = promptFileName;
 
     try {
         promptContent = await fs.readFile(promptPath, "utf-8");
     } catch (error) {
         // If the specific prompt doesn't exist, fall back to the default
         loadedPromptFile = defaultPromptFileName;
         promptPath = getPromptPath(defaultPromptFileName);
         try {
             promptContent = await fs.readFile(promptPath, "utf-8");
         } catch (defaultError) {
             throw new Error("Failed to load any ranking prompt");
         }
     }
 
     logger.info(`Using ranking prompt: ${loadedPromptFile}`);

    // Inject product name and category into the prompt
    promptContent = promptContent.replace(/\[PRODUCT_NAME\]/g, productName.trim());
    promptContent = promptContent.replace(/\[CATEGORY\]/g, category);

    // Inject language instructions if language is not English
    if (language !== 'en') {
        const languageNames: Record<string, string> = {
            'es': 'Spanish',
            'de': 'German', 
            'fr': 'French',
            'it': 'Italian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'pt_BR': 'Portuguese (Brazil)',
            'hi': 'Hindi',
            'tr': 'Turkish',
            'ar': 'Arabic'
        };
        
        const languageName = languageNames[language] || 'English';
        const languageInstruction = `\n\nIMPORTANT: Respond in ${languageName} language.`;
        promptContent = promptContent + languageInstruction;
    }

    return promptContent.trim();
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
 * Validate a ranking object structure
 */
export function validateRankingObject(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false;
    
    const ranking = obj as Record<string, unknown>;
    
    return (
        typeof ranking.id === 'number' &&
        ranking.id > 0 &&
        typeof ranking.similarityScore === 'number' &&
        ranking.similarityScore >= 0 &&
        ranking.similarityScore <= 100 &&
        typeof ranking.rank === 'number' &&
        ranking.rank >= 1 &&
        ranking.rank <= 10
    );
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
