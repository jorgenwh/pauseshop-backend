/**
 * Health check endpoint
 */

import { Request, Response } from "express";
import { HealthResponse } from "../types";
import {
    getUptime,
    getMemoryUsage,
    getEnvironment,
    getVersion,
} from "../utils";
import { asyncWrapper } from "../middleware";

const healthCheck = (req: Request, res: Response): void => {
    // Safely cast the startTime to a Date object
    const startTime = req.app.locals.startTime as Date;

    const healthResponse: HealthResponse = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: getUptime(startTime),
        version: getVersion(),
        environment: getEnvironment(),
        memory: getMemoryUsage(),
    };

    res.status(200).json(healthResponse);
};

export const healthCheckHandler = asyncWrapper(healthCheck);
