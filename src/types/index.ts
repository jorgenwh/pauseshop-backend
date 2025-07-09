/**
 * Server type definitions for FreezeFrame backend
 */

// Re-export analyze types including new ranking types
export * from "./analyze";

export interface HealthResponse {
    status: "healthy" | "unhealthy";
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    memory: {
        used: string;
        total: string;
    };
}

export interface ErrorResponse {
    error: {
        message: string;
        status: number;
        timestamp: string;
        path: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        details?: any; // Only in development - contains request details
    };
}

export interface ServerConfig {
    port: number;
    environment: string;
    corsOrigins: string[];
}

export interface AppLocals {
    startTime: Date;
    version: string;
}

// Augment Express namespace
declare global {
    // Using module augmentation instead of namespace
    interface Express {
        Locals: AppLocals;
    }
}
