/**
 * Express app configuration
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import {
    requestLogger,
    globalErrorHandler,
    notFoundHandler,
} from "./middleware";
import routes from "./routes";
import { getVersion } from "./utils";
import { AnalysisProvider } from "./types/analyze";
import { AnalysisProviderFactory } from "./services/analysis-provider-factory";

const createApp = (): express.Application => {
    const app = express();

    // Log startup configuration

    // Log provider-specific configuration
    const currentProvider = AnalysisProviderFactory.getCurrentProvider();
    const providerConfig = AnalysisProviderFactory.getProviderConfig();
    const isProviderConfigValid = !!providerConfig;

    if (currentProvider === AnalysisProvider.OPENAI) { /* No specific action for OpenAI provider */ }
    else if (currentProvider === AnalysisProvider.REQUESTY) { /* No specific action for Requesty provider */ }

    // Validate provider configuration

    // Set app locals
    app.locals.startTime = new Date();
    app.locals.version = getVersion();
    app.locals.provider = currentProvider;
    app.locals.providerConfigValid = isProviderConfigValid;

    // Trust proxy (for accurate IP addresses)
    app.set("trust proxy", 1);

    // Security middleware - Helmet
    app.use(
        helmet({
            contentSecurityPolicy: false, // Allow extension communication
            crossOriginEmbedderPolicy: false,
        }),
    );

    // CORS configuration for extension communication
    app.use(
        cors({
            origin: [
                "chrome-extension://*",
                /^chrome-extension:\/\/.*$/,
                "http://localhost:3000", // For local development testing
                // "http://localhost:5173", // For local website testing
                "http://127.0.0.1:3000",
                "https://pauseshop.net",
            ],
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "X-Requested-With",
                "Accept",
                "Cache-Control",
            ],
            credentials: false,
        }),
    );

    // Body parsing middleware
    app.use(express.json({ limit: "10mb" })); // For base64 images
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request logging (development only)
    app.use(requestLogger);

    // API routes
    app.use("/", routes);

    // 404 handler
    app.use(notFoundHandler);

    // Global error handler (must be last)
    app.use(globalErrorHandler);

    return app;
};

export default createApp;
