import { Session } from '../types/analyze';
import { logger } from '../utils/logger';

const SESSION_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || '100', 10); // Maximum number of concurrent sessions

export class SessionManager {
    private static instance: SessionManager;
    private sessions: Map<string, Session> = new Map();

    private constructor() {
        console.log("SessionManager initialized with max sessions:", MAX_SESSIONS);
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
        // If we're at the session limit, remove the oldest session
        if (this.sessions.size >= MAX_SESSIONS) {
            const oldestSessionId = this.sessions.keys().next().value;
            if (oldestSessionId) {
                this.sessions.delete(oldestSessionId);
                logger.info(`Session limit reached. Evicted oldest session: ${oldestSessionId}`);
            }
        }

        const session: Session = {
            sessionId,
            screenshot,
            timestamp: Date.now(),
        };
        this.sessions.set(sessionId, session);
        logger.info(`Session created: ${sessionId} (Active sessions: ${this.sessions.size})`);
        return session;
    }

    public getSession(sessionId: string): Session | undefined {
        const session = this.sessions.get(sessionId);
        if (session) {
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
        } else {
            logger.info(`Session end requested for non-existent session (likely already expired): ${sessionId}`);
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
        logger.info(`Session cleanup complete. Cleaned: ${cleanedCount}, Active: ${this.sessions.size}`);
    }
}
