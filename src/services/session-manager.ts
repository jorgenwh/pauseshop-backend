import { Session } from '../types/analyze';
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