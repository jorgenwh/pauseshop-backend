/**
 * PauseShop Server Entry Point
 */

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import createApp from "./app";

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
        process.exit(1);
    }

    const missingVars = requiredEnvVars.filter(
        (varName) => !process.env[varName],
    );

    if (missingVars.length > 0) {
        process.exit(1);
    }

};

const startServer = (): void => {
    try {
        // Validate environment variables first
        validateEnvironment();

        const app = createApp();

        const server = app.listen(PORT, () => { /* Server started */ });

        // Graceful shutdown handling
        const gracefulShutdown = (_signal: string) => {
            // console.log(`Received signal: ${signal}. Shutting down gracefully.`);
            server.close(() => {
                // console.log("Server closed.");
                process.exit(0);
            });

            // Force shutdown after 10 seconds
            setTimeout(() => {
                process.exit(1);
            }, 10000);
        };

        // Handle shutdown signals
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));

        // Handle uncaught exceptions
        process.on("uncaughtException", (_error) => {
            // console.error("Uncaught exception:", error);
            gracefulShutdown("uncaughtException");
        });

        // Handle unhandled promise rejections
        process.on("unhandledRejection", (_reason, _promise) => {
            // console.error("Unhandled promise rejection:", reason, promise);
            gracefulShutdown("unhandledRejection");
        });
    } catch (error) {
        process.exit(1);
    }
};

// Start the server
void startServer();
