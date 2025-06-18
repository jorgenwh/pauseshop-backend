/**
 * Request logging middleware for development
 */

import { Request, Response, NextFunction } from "express";

export const requestLogger = (
    _req: Request,
    _res: Response,
    next: NextFunction,
): void => {
    // const _startTime = Date.now();
    // const { method: _method, url: _url, ip: _ip } = _req;

    // Log request start
    // console.log(`[${new Date().toISOString()}] ${method} ${url} - ${ip}`);

    // Override _res.end to log response
    const originalEnd = _res.end.bind(_res);
    _res.end = function(this: Response, ...args: Parameters<typeof originalEnd>): Response {
        // const _duration = Date.now() - _startTime;
        // const { statusCode: _statusCode } = this;
        // const _statusColor =
        //     _statusCode >= 400
        //         ? "\x1b[31m"
        //         : _statusCode >= 300
        //             ? "\x1b[33m"
        //             : "\x1b[32m";

        // console.log(
        //     `[${new Date().toISOString()}] ${method} ${url} - ${statusColor}${statusCode}\x1b[0m - ${duration}ms`,
        // );

        // Call original end method with spread operator
        return originalEnd.apply(this, args);
    } as typeof _res.end;

    next();
};
