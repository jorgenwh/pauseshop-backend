# Session Management Implementation Plan

This document outlines the plan to implement session management for the PauseShop server. This feature will allow the server to temporarily store screenshots and associate them with a session, enabling the website to retrieve the image later.

## 1. Session Data Structure

The `AnalyzeRequest` interface in `src/types/analyze.ts` will be updated to include an optional `sessionId`. A new `Session` type will also be defined.

```typescript
export interface AnalyzeRequest {
    image: string; // base64 data URL
    sessionId?: string; // Optional client-generated ID
    metadata?: {
        timestamp: string;
    };
}

export interface Session {
    sessionId: string;
    screenshot: string; // base64 data URL
    timestamp: number;
}
```

## 2. SessionManager Service

A new service, `SessionManager`, will be created in `src/services/session-manager.ts`. This service will handle the creation, storage, retrieval, and deletion of sessions. Initially, it will use an in-memory cache, with the ability to be replaced by a more robust solution like Redis in the future.

```typescript
// src/services/session-manager.ts
import { Session } from '../types';
import { logger } from '../utils/logger';

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

export class SessionManager {
    private static instance: SessionManager;
    private sessions: Map<string, Session> = new Map();

    private constructor() {
        // Periodically clean up expired sessions
        setInterval(() => this.cleanupExpiredSessions(), 60 * 1000); // Every minute
    }

    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    public createSession(sessionId: string, screenshot: string): Session {
        const session: Session = {
            sessionId,
            screenshot,
            timestamp: Date.now(),
        };
        this.sessions.set(sessionId, session);
        logger.info(`Session created: ${sessionId}`);
        return session;
    }

    public getSession(sessionId: string): Session | undefined {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (Date.now() - session.timestamp > SESSION_TTL) {
                this.sessions.delete(sessionId);
                logger.info(`Session expired and cleaned: ${sessionId}`);
                return undefined;
            }
            logger.info(`Session retrieved: ${sessionId}`);
            return session;
        }
        logger.warn(`Session not found: ${sessionId}`);
        return undefined;
    }

    public endSession(sessionId: string): boolean {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            logger.info(`Session ended by client: ${sessionId}`);
        }
        return deleted;
    }



    private cleanupExpiredSessions(): void {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.timestamp > SESSION_TTL) {
                this.sessions.delete(sessionId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger.info(`Session cleanup complete. Cleaned: ${cleanedCount}, Remaining: ${this.sessions.size}`);
        }
    }
}
```

## 3. API Endpoint Modifications

### 3.1. Update `/analyze/stream` Endpoint

The existing `/analyze/stream` endpoint will be modified to handle an optional `sessionId` from the request body.

-   **On request**: If a `sessionId` is provided in the request body, a new session will be created using this ID and the `SessionManager`.
-   **Backward Compatibility**: If no `sessionId` is provided, the endpoint will function as it currently does, without creating a session.
-   **SSE `start` event**: The `start` event will include the `sessionId` only if a session was created.

```typescript
// src/routes/analyze.ts (modifications)
import { SessionManager } from '../services/session-manager';

// ... inside analyzeImageStreamingHandler
const { image, sessionId } = req.body as AnalyzeRequest;
const startData: { [key: string]: any } = {
    timestamp: new Date().toISOString(),
    provider: AnalysisProviderFactory.getCurrentProvider(),
};

if (sessionId) {
    const sessionManager = SessionManager.getInstance();
    const session = sessionManager.createSession(sessionId, image);
    startData.sessionId = session.sessionId;
}

res.write(`event: start\ndata: ${JSON.stringify(startData)}\n\n`);
```

### 3.2. New Endpoint: `GET /session/:sessionId/screenshot`

A new endpoint will be created to allow the client to retrieve the screenshot associated with a session.

-   **Route**: `GET /session/:sessionId/screenshot`
-   **Logic**:
    -   Retrieve the session using the `sessionId` from the `SessionManager`.
    -   If the session exists, return the screenshot data.
    -   If the session does not exist, return a `404 Not Found` error.

```typescript
// src/routes/analyze.ts (new handler)
export const getScreenshotHandler = (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const sessionManager = SessionManager.getInstance();
    const session = sessionManager.getSession(sessionId);

    if (session) {
        // Return the image directly
        const imageBuffer = Buffer.from(session.screenshot.split(',')[1], 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': imageBuffer.length
        });
        res.end(imageBuffer);
    } else {
        res.status(404).json({ success: false, error: 'Session not found' });
    }
};
```

### 3.3. New Endpoint: `POST /session/:sessionId/end`

A new endpoint will be created to allow the client to signal the end of a session, which will delete the session data from the server.

-   **Route**: `POST /session/:sessionId/end`
-   **Logic**:
    -   Call `sessionManager.endSession(sessionId)` to delete the session.
    -   Return a success response.

```typescript
// src/routes/analyze.ts (new handler)
export const endSessionHandler = (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const sessionManager = SessionManager.getInstance();
    const success = sessionManager.endSession(sessionId);

    if (success) {
        res.status(200).json({ success: true, message: 'Session ended' });
    } else {
        res.status(404).json({ success: false, error: 'Session not found' });
    }
};
```

## 4. Routing

The new endpoints will be registered in `src/app.ts`.

```typescript
// src/app.ts (modifications)
import { 
    analyzeImageStreamingHandler, 
    getScreenshotHandler, 
    endSessionHandler 
} from './routes/analyze';

// ...

app.post('/analyze/stream', analyzeImageStreamingHandler);
app.get('/session/:sessionId/screenshot', getScreenshotHandler);
app.post('/session/:sessionId/end', endSessionHandler);
```

## 5. Logging Strategy

To ensure visibility into the session lifecycle, the following events will be logged:

-   **Session Creation**: Logged when a new session is successfully created.
-   **Session Retrieval**: Logged on successful retrieval of a session.
-   **Session Not Found**: A warning is logged if a requested session ID does not exist.
-   **Session Expiration**: Logged when a session is accessed but has expired.
-   **Session End**: Logged when a session is terminated by the client.
-   **Session Cleanup**: A summary is logged periodically, detailing the number of expired sessions cleaned and the number remaining.

## 6. Future Scalability

## 5. Future Scalability

The current in-memory session management is suitable for initial development but is not scalable for a production environment with multiple server instances. In the future, the `SessionManager` should be refactored to use a distributed cache like **Redis**.

This change would be isolated to the `SessionManager` class, preserving the existing API. The Redis client would replace the in-memory `Map`, and session expiration would be handled by Redis's built-in TTL (Time-To-Live) feature.