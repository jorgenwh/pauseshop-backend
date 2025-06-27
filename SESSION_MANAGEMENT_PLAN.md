# Session Management Implementation Plan

This document outlines the plan to implement session management for the PauseShop server. This feature will allow the server to temporarily store screenshots and associate them with a session, enabling the website to retrieve the image later.

## 1. Session Data Structure

A new `Session` type will be defined in `src/types/analyze.ts` to standardize the session data structure.

```typescript
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
import { randomBytes } from 'crypto';

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
        return session;
    }

    public getSession(sessionId: string): Session | undefined {
        const session = this.sessions.get(sessionId);
        if (session && Date.now() - session.timestamp > SESSION_TTL) {
            this.sessions.delete(sessionId);
            return undefined;
        }
        return session;
    }

    public endSession(sessionId: string): boolean {
        return this.sessions.delete(sessionId);
    }

    private cleanupExpiredSessions(): void {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.timestamp > SESSION_TTL) {
                this.sessions.delete(sessionId);
            }
        }
    }
}
```

## 3. API Endpoint Modifications

### 3.1. Update `/analyze/stream` Endpoint

The existing `/analyze/stream` endpoint will be modified to accept a `sessionId` in the URL, for example: `POST /analyze/stream/:sessionId`.

-   **On request**: The `sessionId` will be extracted from the URL parameters. A new session will be created using this ID and the `SessionManager`.
-   **Idempotency**: This approach makes the endpoint idempotent. If the client sends the same request multiple times, it will simply update the existing session.

```typescript
// src/routes/analyze.ts (modifications)
import { SessionManager } from '../services/session-manager';

// ... inside analyzeImageStreamingHandler
const { sessionId } = req.params;
const image = req.body.image as string;

const sessionManager = SessionManager.getInstance();
const session = sessionManager.createSession(sessionId, image);

res.write(
    `event: start\ndata: ${JSON.stringify({
        timestamp: new Date().toISOString(),
        provider: AnalysisProviderFactory.getCurrentProvider(),
        sessionId: session.sessionId
    })}\n\n`,
);
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

app.post('/analyze/stream/:sessionId', analyzeImageStreamingHandler);
app.get('/session/:sessionId/screenshot', getScreenshotHandler);
app.post('/session/:sessionId/end', endSessionHandler);
```

## 5. Future Scalability

The current in-memory session management is suitable for initial development but is not scalable for a production environment with multiple server instances. In the future, the `SessionManager` should be refactored to use a distributed cache like **Redis**.

This change would be isolated to the `SessionManager` class, preserving the existing API. The Redis client would replace the in-memory `Map`, and session expiration would be handled by Redis's built-in TTL (Time-To-Live) feature.