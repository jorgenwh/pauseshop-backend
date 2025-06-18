/**
 * Global error handling middleware
 */

import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../types";
import { isDevelopment } from "../utils";

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = 500,
        isOperational: boolean = true,
    ) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        Error.captureStackTrace(this, this.constructor);
    }
}

export const globalErrorHandler = (
    error: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const message = error.message || "Internal Server Error";

    const errorResponse: ErrorResponse = {
        error: {
            message,
            status: statusCode,
            timestamp: new Date().toISOString(),
            path: req.path,
        },
    };

    // Include error details in development
    if (isDevelopment()) {
        // Use type assertion to avoid unsafe assignment
        const safeDetails = {
            stack: error.stack,
            // Use type assertion to ensure type safety
            body: req.body ? JSON.parse(JSON.stringify(req.body)) as Record<string, unknown> : undefined,
            query: req.query ? JSON.parse(JSON.stringify(req.query)) as Record<string, unknown> : undefined,
            params: req.params ? JSON.parse(JSON.stringify(req.params)) as Record<string, unknown> : undefined,
        };
        
        errorResponse.error.details = safeDetails;
    }

    // Log error in development
    if (isDevelopment()) { /* Log error details in development */ }

    res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response): void => {
    const errorResponse: ErrorResponse = {
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            status: 404,
            timestamp: new Date().toISOString(),
            path: req.path,
        },
    };

    res.status(404).json(errorResponse);
};

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

export const asyncWrapper = (fn: AsyncHandler) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = fn(req, res, next);
            if (result instanceof Promise) {
                result.catch(next);
            }
        } catch (error) {
            next(error);
        }
    };
};
