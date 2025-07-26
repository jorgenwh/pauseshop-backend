/**
 * Statistics tracking types
 */

export interface Statistics {
    websiteVisits: number;
    imageAnalyses: number;
    deepSearches: number;
    pausesRegistered: number;
}

export interface DailyStatistics extends Statistics {
    date: string; // ISO date string YYYY-MM-DD
}

export interface StatisticsMetadata {
    lastUpdated: Date;
}

export enum StatisticType {
    WEBSITE_VISIT = 'websiteVisits',
    IMAGE_ANALYSIS = 'imageAnalyses',
    DEEP_SEARCH = 'deepSearches',
    PAUSE_REGISTERED = 'pausesRegistered',
    CLICKED_AMAZON_LINK = 'clickedAmazonLink',
    EXTENSION_REDIRECT = 'extensionRedirect',
    EXTENSION_REDIRECT_PAGE = 'extensionRedirectPage'
}
