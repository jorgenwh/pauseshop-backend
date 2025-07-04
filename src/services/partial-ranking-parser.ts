/**
 * Partial Ranking Parser
 * Parses streaming JSON ranking objects from AI responses
 */

import { ProductRanking } from "../types/analyze";
import { logger } from "../utils/logger";

export interface PartialRankingParser {
    parse(partialResponse: string): ProductRanking[];
    flush(): ProductRanking[];
}

export class DefaultPartialRankingParser implements PartialRankingParser {
    private buffer: string = "";
    private parsedRankings: Set<string> = new Set(); // Track parsed ranking IDs to avoid duplicates

    /**
     * Parse streaming ranking JSON objects from partial response
     */
    parse(partialResponse: string): ProductRanking[] {
        this.buffer += partialResponse;
        const rankings: ProductRanking[] = [];

        // Split by lines and try to parse each line as JSON
        const lines = this.buffer.split('\n');
        
        // Keep the last line in buffer (might be incomplete)
        this.buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            try {
                const ranking = this.parseRankingLine(trimmedLine);
                if (ranking && !this.parsedRankings.has(ranking.id)) {
                    rankings.push(ranking);
                    this.parsedRankings.add(ranking.id);
                }
            } catch (error) {
                // Log parsing errors but continue processing
                logger.warn(`[RANKING_PARSER] Failed to parse line: ${trimmedLine}`, error);
            }
        }

        return rankings;
    }

    /**
     * Flush the remaining buffer to parse any final rankings.
     * This method processes the entire remaining buffer as a single unit.
     */
    flush(): ProductRanking[] {
        const rankings: ProductRanking[] = [];
        const trimmedBuffer = this.buffer.trim();

        if (trimmedBuffer) {
            try {
                const ranking = this.parseRankingLine(trimmedBuffer);
                if (ranking && !this.parsedRankings.has(ranking.id)) {
                    rankings.push(ranking);
                    this.parsedRankings.add(ranking.id);
                }
            } catch (error) {
                // Log error but don't throw, as it might be partial data
                logger.warn(`[RANKING_PARSER] Failed to parse final buffer content on flush: ${trimmedBuffer}`);
            }
        }

        this.buffer = ""; // Clear buffer after flushing
        return rankings;
    }

    /**
     * Parse a single line as a ranking JSON object
     */
    private parseRankingLine(line: string): ProductRanking | null {
        try {
            const parsed = JSON.parse(line) as unknown;
            
            // Validate the parsed object has required fields
            if (!this.isValidRanking(parsed)) {
                logger.warn(`[RANKING_PARSER] Invalid ranking object: ${line}`);
                return null;
            }

            // Now we know it's a valid ranking object, safe to access properties
            const validRanking = parsed as Record<string, unknown>;
            return {
                id: String(validRanking.id).trim(),
                similarityScore: Number(validRanking.similarityScore),
                rank: Number(validRanking.rank)
            };
        } catch (error) {
            // Not valid JSON, return null
            return null;
        }
    }

    /**
     * Validate that an object has the required ranking fields
     */
    private isValidRanking(obj: unknown): boolean {
        if (!obj || typeof obj !== 'object') return false;
        
        const ranking = obj as Record<string, unknown>;
        
        return (
            (typeof ranking.id === 'string' || typeof ranking.id === 'number') &&
            typeof ranking.similarityScore === 'number' && 
            ranking.similarityScore >= 0 && 
            ranking.similarityScore <= 100 &&
            typeof ranking.rank === 'number' && 
            ranking.rank >= 1 && 
            ranking.rank <= 10
        );
    }

    /**
     * Reset the parser state (useful for new requests)
     */
    reset(): void {
        this.buffer = "";
        this.parsedRankings.clear();
    }

    /**
     * Get the current number of parsed rankings
     */
    getParsedCount(): number {
        return this.parsedRankings.size;
    }
}