/**
 * Request logging middleware for development
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export const requestLogger = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const startTime = Date.now();
    const { method, url, ip } = req;

    // Log request start
    logger.http(`${method} ${url} - ${ip}`);

    // Override res.end to log response
    const originalEnd = res.end.bind(res);
    res.end = function(this: Response, ...args: Parameters<typeof originalEnd>): Response {
        const duration = Date.now() - startTime;
        const { statusCode } = this;

        logger.http(`${method} ${url} - ${statusCode} - ${duration}ms`);

        // Call original end method with spread operator
        return originalEnd.apply(this, args);
    } as typeof res.end;

    next();
};
