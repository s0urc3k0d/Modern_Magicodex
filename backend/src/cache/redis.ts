/**
 * Redis Cache Service
 * Centralized caching layer for Magicodex
 */

import { createClient, RedisClientType } from 'redis';

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  CARDS_FTS: 300,           // 5 minutes - search results
  SETS_LIST: 3600,          // 1 hour - sets rarely change
  COLLECTION_STATS: 60,     // 1 minute - user-specific, changes often
  DECK_VIEW: 120,           // 2 minutes - deck details
  USER_CARDS: 30,           // 30 seconds - frequently updated
  ADMIN_STATS: 300,         // 5 minutes - admin dashboard
} as const;

// Cache key prefixes for organization
export const CACHE_KEYS = {
  CARDS_FTS: 'cards:fts:',
  CARDS_BY_ID: 'cards:id:',
  SETS: 'sets:all',
  SET_BY_CODE: 'sets:code:',
  COLLECTION_STATS: 'coll:stats:',
  USER_COLLECTION: 'coll:user:',
  DECK: 'deck:',
  ADMIN_STATS: 'admin:stats',
} as const;

class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.log('[Redis] REDIS_URL not configured, cache disabled');
      return;
    }

    try {
      this.client = createClient({ url: redisUrl });

      this.client.on('error', (err) => {
        console.error('[Redis] Connection error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected successfully');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('[Redis] Reconnecting...');
      });

      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      console.error('[Redis] Failed to connect:', error);
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable() || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[Redis] GET error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<boolean> {
    if (!this.isAvailable() || !this.client) {
      return false;
    }

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[Redis] SET error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.isAvailable() || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`[Redis] DEL error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.isAvailable() || !this.client) {
      return 0;
    }

    try {
      let cursor = 0;
      let deleted = 0;

      do {
        const result = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = result.cursor;
        
        if (result.keys.length > 0) {
          await this.client.del(result.keys);
          deleted += result.keys.length;
        }
      } while (cursor !== 0);

      return deleted;
    } catch (error) {
      console.error(`[Redis] DEL pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate user-specific cache
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.delPattern(`${CACHE_KEYS.COLLECTION_STATS}${userId}:*`);
    await this.delPattern(`${CACHE_KEYS.USER_COLLECTION}${userId}:*`);
  }

  /**
   * Invalidate deck cache
   */
  async invalidateDeck(deckId: string): Promise<void> {
    await this.del(`${CACHE_KEYS.DECK}${deckId}`);
  }

  /**
   * Invalidate all cards cache (after sync)
   */
  async invalidateCards(): Promise<void> {
    await this.delPattern(`${CACHE_KEYS.CARDS_FTS}*`);
    await this.delPattern(`${CACHE_KEYS.CARDS_BY_ID}*`);
  }

  /**
   * Invalidate sets cache (after sync)
   */
  async invalidateSets(): Promise<void> {
    await this.del(CACHE_KEYS.SETS);
    await this.delPattern(`${CACHE_KEYS.SET_BY_CODE}*`);
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await fetcher();

    // Cache it (don't await, fire and forget)
    this.set(key, value, ttlSeconds).catch(() => {});

    return value;
  }

  /**
   * Close connection gracefully
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const redisCache = new RedisCache();

// Helper to generate cache keys
export function cacheKey(prefix: string, ...parts: (string | number)[]): string {
  return prefix + parts.join(':');
}
