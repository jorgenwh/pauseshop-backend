/**
 * FreezeFrame Server Entry Point
 */

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import createApp from "./app";
import { SessionManager } from "./services/session-manager";
import { StatisticsService } from "./services/statistics-service";
import { logger } from "./utils/logger";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Validate required environment variables
const validateEnvironment = (): void => {
    const provider = (process.env.ANALYSIS_PROVIDER || "openai").toLowerCase();
    let requiredEnvVars: string[] = [];

    if (provider === "openai") {
        requiredEnvVars = ["OPENAI_API_KEY"];
    } else if (provider === "requesty") {
        requiredEnvVars = ["REQUESTY_API_KEY"];
    } else if (provider === "gemini") {
        requiredEnvVars = ["GEMINI_API_KEY"];
    } else if (provider === "openrouter") {
        requiredEnvVars = ["OPENROUTER_API_KEY"];
    } else {
        logger.error(`Unknown ANALYSIS_PROVIDER: ${provider}`);
        process.exit(1);
    }

    const missingVars = requiredEnvVars.filter(
        (varName) => !process.env[varName],
    );

    if (missingVars.length > 0) {
        logger.error(
            `Missing required environment variables for ${provider}: ${missingVars.join(
                ", ",
            )}`,
        );
        process.exit(1);
    }
    logger.info(`✅ Environment variables validated for ${provider} provider`);
};

const startServer = (): void => {
    try {
        // Validate environment variables first
        validateEnvironment();

        // Initialize services
        SessionManager.getInstance();
        logger.info("✅ Session manager initialized");
        
        // Initialize statistics service
        StatisticsService.getInstance().initialize();
        logger.info("✅ Statistics service initialized");

        const app = createApp();

        const server = app.listen(PORT, () => {
            logger.log("=================================");
            logger.log("FreezeFrame Server Starting...");
            logger.log("=================================");
            logger.log("Environment Variables:");
            logger.log(`NODE_ENV: ${process.env.NODE_ENV || "development"}`);
            logger.log(`PORT: ${PORT}`);
            logger.log(`ANALYSIS_PROVIDER: "${process.env.ANALYSIS_PROVIDER || "gemini"}"`);
            logger.log(`Current Provider: ${app.locals.provider}`);
            logger.log(`Provider Config: ${app.locals.providerConfigValid ? "✅ Valid" : "❌ Invalid"}`);
            logger.log("============================================================================");
            logger.log(`🚀 FreezeFrame Server running on port ${PORT}`);
            logger.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
            logger.log(`🔗 Health check: http://localhost:${PORT}/health`);
            logger.log(`⏰ Started at: ${new Date().toISOString()}`);
        });

        // Graceful shutdown handling
        const gracefulShutdown = (signal: string) => {
            logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);
            server.close(() => {
                logger.info("✅ HTTP server closed");
                logger.info("👋 FreezeFrame Server stopped gracefully");
                process.exit(0);
            });

            // Force shutdown after 10 seconds
            setTimeout(() => {
                logger.error("Forceful shutdown after 10s timeout.");
                process.exit(1);
            }, 10000);
        };

        // Handle shutdown signals
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));

        // Handle uncaught exceptions
        process.on("uncaughtException", (error) => {
            logger.error("Uncaught exception:", error);
            gracefulShutdown("uncaughtException");
        });

        // Handle unhandled promise rejections
        process.on("unhandledRejection", (reason, promise) => {
            logger.error("Unhandled promise rejection:", reason, promise);
            gracefulShutdown("unhandledRejection");
        });
    } catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
};

// Start the server
void startServer();
