/**
 * Simple logger utility for consistent formatting.
 */

/* eslint-disable no-console */

const getTimestamp = (): string => {
    const now = new Date();
    return now.toISOString();
};

const getFormattedTimestamp = (): string => {
    const now = new Date();
    return now.toTimeString().split(" ")[0];
};

export const logger = {
    info: (...args: unknown[]) => {
        console.log(`[INFO] ${getFormattedTimestamp()}`, ...args);
    },
    warn: (...args: unknown[]) => {
        console.warn(`[WARN] ${getFormattedTimestamp()}`, ...args);
    },
    error: (...args: unknown[]) => {
        console.error(`[ERROR] ${getFormattedTimestamp()}`, ...args);
    },
    debug: (...args: unknown[]) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEBUG] ${getFormattedTimestamp()}`, ...args);
        }
    },
    log: (...args: unknown[]) => {
        console.log(...args);
    },
    http: (message: string) => {
        console.log(`[${getTimestamp()}] ${message}`);
    },
};