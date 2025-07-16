import acceptLanguage from 'accept-language-parser';

/**
 * Detects the best language from Accept-Language header
 * Falls back to English if no supported language is found
 */
export function detectLanguage(acceptLanguageHeader?: string): string {
    if (!acceptLanguageHeader) {
        return 'en';
    }
    
    const supportedLanguages = ['en', 'es', 'de', 'fr', 'it', 'ja', 'ko', 'pt_BR', 'hi', 'tr', 'ar'];
    const parsedLanguages = acceptLanguage.parse(acceptLanguageHeader);
    
    for (const lang of parsedLanguages) {
        // Check exact match (e.g., 'en')
        if (supportedLanguages.includes(lang.code)) {
            return lang.code;
        }
        
        // Check region variants (e.g., 'en-US' -> 'en')
        const baseLang = lang.code.split('-')[0];
        if (supportedLanguages.includes(baseLang)) {
            return baseLang;
        }
    }
    
    return 'en'; // fallback
}