// Simple in-memory query cache with TTL for reducing redundant database hits
// Used for: glucose readings queries that repeat within short time windows

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Get cached value if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttlMs;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set a value with TTL (time to live in milliseconds)
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
    });
  }

  /**
   * Invalidate a single key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size for debugging
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance for glucose readings cache
export const readingsCache = new QueryCache();

// Cache TTL constants
export const CACHE_TTL = {
  READINGS_QUERY: 5 * 60 * 1000, // 5 minutes
  RECENT_READINGS: 2 * 60 * 1000, // 2 minutes
} as const;

/**
 * Generate cache key for glucose readings between timestamps
 */
export function getCacheKeyReadingsBetween(startMs: number, endMs: number): string {
  return `readings:between:${startMs}:${endMs}`;
}

/**
 * Generate cache key for recent readings with limit
 */
export function getCacheKeyRecentReadings(limit: number): string {
  return `readings:recent:${limit}`;
}

/**
 * Generate cache key for readings since timestamp
 */
export function getCacheKeyReadingsSince(sinceMs: number): string {
  return `readings:since:${sinceMs}`;
}
