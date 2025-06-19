# Build stage
FROM node:18-slim AS builder

# Create app directory
WORKDIR /usr/src/app

# Define build arguments
ARG SERVER_MODE=prod

# Set environment variables from build args
ENV SERVER_MODE=${SERVER_MODE}

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:18-slim

WORKDIR /usr/src/app

# Pass the build arg to the production stage
ARG SERVER_MODE=prod
ENV SERVER_MODE=${SERVER_MODE}

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/src/prompts ./src/prompts

# Expose the port the app runs on
ENV PORT=8080
EXPOSE 8080

# Command to run the application
CMD [ "npm", "start" ]
