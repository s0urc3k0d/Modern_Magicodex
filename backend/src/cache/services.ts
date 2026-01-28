/**
 * Card Cache Service
 * Caching layer for card-related queries
 */

import { redisCache, CACHE_TTL, CACHE_KEYS, cacheKey } from './redis';
import { cacheLogger as logger } from '../utils/logger';

export interface CachedCardSearchResult {
  ids: string[];
  total: number;
  timestamp: number;
}

export const cardCache = {
  /**
   * Get cached FTS search results
   */
  async getFtsResults(
    query: string,
    options: Record<string, unknown> = {}
  ): Promise<string[] | null> {
    const key = cacheKey(
      CACHE_KEYS.CARDS_FTS,
      query.toLowerCase(),
      JSON.stringify(options)
    );
    
    const cached = await redisCache.get<CachedCardSearchResult>(key);
    if (cached) {
      logger.debug({ query, hitAge: Date.now() - cached.timestamp }, 'FTS cache hit');
      return cached.ids;
    }
    
    return null;
  },

  /**
   * Cache FTS search results
   */
  async setFtsResults(
    query: string,
    options: Record<string, unknown>,
    ids: string[]
  ): Promise<void> {
    const key = cacheKey(
      CACHE_KEYS.CARDS_FTS,
      query.toLowerCase(),
      JSON.stringify(options)
    );
    
    await redisCache.set<CachedCardSearchResult>(
      key,
      { ids, total: ids.length, timestamp: Date.now() },
      CACHE_TTL.CARDS_FTS
    );
  },

  /**
   * Invalidate all card search caches
   */
  async invalidateAll(): Promise<void> {
    logger.info('Invalidating all card caches');
    await redisCache.invalidateCards();
  },
};

export const setCache = {
  /**
   * Get all sets from cache
   */
  async getAll<T>(): Promise<T[] | null> {
    return redisCache.get<T[]>(CACHE_KEYS.SETS);
  },

  /**
   * Cache all sets
   */
  async setAll<T>(sets: T[]): Promise<void> {
    await redisCache.set(CACHE_KEYS.SETS, sets, CACHE_TTL.SETS_LIST);
  },

  /**
   * Get set by code from cache
   */
  async getByCode<T>(code: string): Promise<T | null> {
    const key = cacheKey(CACHE_KEYS.SET_BY_CODE, code.toUpperCase());
    return redisCache.get<T>(key);
  },

  /**
   * Cache set by code
   */
  async setByCode<T>(code: string, set: T): Promise<void> {
    const key = cacheKey(CACHE_KEYS.SET_BY_CODE, code.toUpperCase());
    await redisCache.set(key, set, CACHE_TTL.SETS_LIST);
  },

  /**
   * Invalidate sets cache
   */
  async invalidateAll(): Promise<void> {
    logger.info('Invalidating sets cache');
    await redisCache.invalidateSets();
  },
};

export const collectionCache = {
  /**
   * Get collection stats from cache
   */
  async getStats<T>(
    userId: string,
    groupBy: string,
    extras?: boolean
  ): Promise<T | null> {
    const key = cacheKey(CACHE_KEYS.COLLECTION_STATS, userId, groupBy, String(extras));
    return redisCache.get<T>(key);
  },

  /**
   * Cache collection stats
   */
  async setStats<T>(
    userId: string,
    groupBy: string,
    extras: boolean | undefined,
    stats: T
  ): Promise<void> {
    const key = cacheKey(CACHE_KEYS.COLLECTION_STATS, userId, groupBy, String(extras));
    await redisCache.set(key, stats, CACHE_TTL.COLLECTION_STATS);
  },

  /**
   * Invalidate user collection cache
   */
  async invalidateUser(userId: string): Promise<void> {
    logger.debug({ userId }, 'Invalidating user collection cache');
    await redisCache.invalidateUser(userId);
  },
};

export const deckCache = {
  /**
   * Get deck from cache
   */
  async get<T>(deckId: string): Promise<T | null> {
    const key = cacheKey(CACHE_KEYS.DECK, deckId);
    return redisCache.get<T>(key);
  },

  /**
   * Cache deck
   */
  async set<T>(deckId: string, deck: T): Promise<void> {
    const key = cacheKey(CACHE_KEYS.DECK, deckId);
    await redisCache.set(key, deck, CACHE_TTL.DECK_VIEW);
  },

  /**
   * Invalidate deck cache
   */
  async invalidate(deckId: string): Promise<void> {
    logger.debug({ deckId }, 'Invalidating deck cache');
    await redisCache.invalidateDeck(deckId);
  },
};

export const adminCache = {
  /**
   * Get admin stats from cache
   */
  async getStats<T>(): Promise<T | null> {
    return redisCache.get<T>(CACHE_KEYS.ADMIN_STATS);
  },

  /**
   * Cache admin stats
   */
  async setStats<T>(stats: T): Promise<void> {
    await redisCache.set(CACHE_KEYS.ADMIN_STATS, stats, CACHE_TTL.ADMIN_STATS);
  },

  /**
   * Invalidate admin cache
   */
  async invalidate(): Promise<void> {
    await redisCache.del(CACHE_KEYS.ADMIN_STATS);
  },
};
