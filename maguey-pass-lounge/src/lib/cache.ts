/**
 * Cache Layer
 * 
 * Provides a unified caching interface for the frontend application.
 * Supports multiple storage backends:
 * - In-memory (default, fastest, lost on page refresh)
 * - localStorage (persists across sessions)
 * - sessionStorage (persists across page refreshes in same tab)
 * 
 * Features:
 * - TTL-based expiration
 * - Stale-while-revalidate pattern
 * - Cache-aside pattern with wrap() method
 * - Prefix-based invalidation
 * - Metrics integration
 * 
 * Note: For production with server-side rendering or API routes,
 * this can be upgraded to use Redis via an API endpoint.
 */

import { createLogger } from './logger';
import { metrics, startTimer } from './monitoring';

// ============================================
// TYPES
// ============================================

export interface CacheOptions {
  /** Time-to-live in seconds */
  ttlSeconds: number;
  
  /** 
   * If true, allows serving stale data while fetching fresh data in background
   * The stale window is ttlSeconds * 2 by default
   */
  staleWhileRevalidate?: boolean;
  
  /**
   * Custom stale window in seconds (only used if staleWhileRevalidate is true)
   * Defaults to ttlSeconds * 2
   */
  staleWindowSeconds?: number;
  
  /**
   * Storage backend to use
   * - 'memory': In-memory only (fastest, lost on refresh)
   * - 'local': localStorage (persists across sessions)
   * - 'session': sessionStorage (persists in tab only)
   * Default: 'memory'
   */
  storage?: 'memory' | 'local' | 'session';
}

export interface CacheEntry<T> {
  /** The cached data */
  data: T;
  
  /** Unix timestamp when the entry expires */
  expiresAt: number;
  
  /** Unix timestamp when the entry becomes stale (for SWR) */
  staleAt?: number;
  
  /** When the entry was created */
  createdAt: number;
  
  /** Cache key for debugging */
  key: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  size: number;
  hitRate: number;
}

// ============================================
// LOGGER
// ============================================

const logger = createLogger({ module: 'cache' });

// ============================================
// STORAGE ADAPTERS
// ============================================

interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
  keys(): string[];
  clear(): void;
}

class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();
  
  get(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  
  set(key: string, value: string): void {
    this.store.set(key, value);
  }
  
  delete(key: string): void {
    this.store.delete(key);
  }
  
  keys(): string[] {
    return Array.from(this.store.keys());
  }
  
  clear(): void {
    this.store.clear();
  }
}

class WebStorageAdapter implements StorageAdapter {
  private prefix = 'cache:';
  
  constructor(private storage: Storage) {}
  
  get(key: string): string | null {
    try {
      return this.storage.getItem(this.prefix + key);
    } catch {
      return null;
    }
  }
  
  set(key: string, value: string): void {
    try {
      this.storage.setItem(this.prefix + key, value);
    } catch (error) {
      // Storage might be full or disabled
      logger.warn('Failed to write to storage', { key, error });
    }
  }
  
  delete(key: string): void {
    try {
      this.storage.removeItem(this.prefix + key);
    } catch {
      // Ignore errors
    }
  }
  
  keys(): string[] {
    const keys: string[] = [];
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key?.startsWith(this.prefix)) {
          keys.push(key.slice(this.prefix.length));
        }
      }
    } catch {
      // Ignore errors
    }
    return keys;
  }
  
  clear(): void {
    try {
      const keys = this.keys();
      for (const key of keys) {
        this.storage.removeItem(this.prefix + key);
      }
    } catch {
      // Ignore errors
    }
  }
}

// ============================================
// CACHE CLASS
// ============================================

export class Cache {
  private memoryAdapter = new MemoryStorageAdapter();
  private localAdapter: StorageAdapter | null = null;
  private sessionAdapter: StorageAdapter | null = null;
  
  // Stats tracking
  private stats = {
    hits: 0,
    misses: 0,
    staleHits: 0,
  };
  
  // Pending revalidation promises (for deduplication)
  private pendingRevalidations = new Map<string, Promise<unknown>>();
  
  constructor() {
    // Initialize web storage adapters if available
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage) {
          this.localAdapter = new WebStorageAdapter(window.localStorage);
        }
      } catch {
        // localStorage might be disabled
      }
      
      try {
        if (window.sessionStorage) {
          this.sessionAdapter = new WebStorageAdapter(window.sessionStorage);
        }
      } catch {
        // sessionStorage might be disabled
      }
    }
    
    // Clean up expired entries periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanupExpired(), 60000); // Every minute
    }
  }
  
  /**
   * Get the appropriate storage adapter
   */
  private getAdapter(storage: 'memory' | 'local' | 'session' = 'memory'): StorageAdapter {
    switch (storage) {
      case 'local':
        return this.localAdapter ?? this.memoryAdapter;
      case 'session':
        return this.sessionAdapter ?? this.memoryAdapter;
      default:
        return this.memoryAdapter;
    }
  }
  
  /**
   * Get a value from the cache
   */
  async get<T>(key: string, storage: 'memory' | 'local' | 'session' = 'memory'): Promise<T | null> {
    const timer = startTimer();
    const adapter = this.getAdapter(storage);
    
    try {
      const raw = adapter.get(key);
      if (!raw) {
        this.stats.misses++;
        metrics.increment('cache.misses', 1, { storage });
        logger.debug('Cache miss', { key, storage });
        return null;
      }
      
      const entry: CacheEntry<T> = JSON.parse(raw);
      const now = Date.now();
      
      // Check if expired
      if (now > entry.expiresAt) {
        // Entry is fully expired, remove it
        adapter.delete(key);
        this.stats.misses++;
        metrics.increment('cache.misses', 1, { storage, reason: 'expired' });
        logger.debug('Cache miss (expired)', { key, storage });
        return null;
      }
      
      // Check if stale (but not expired)
      if (entry.staleAt && now > entry.staleAt) {
        this.stats.staleHits++;
        metrics.increment('cache.stale_hits', 1, { storage });
        logger.debug('Cache stale hit', { key, storage });
      } else {
        this.stats.hits++;
        metrics.increment('cache.hits', 1, { storage });
        logger.debug('Cache hit', { key, storage });
      }
      
      metrics.timing('cache.get.duration', timer(), { storage });
      return entry.data;
      
    } catch (error) {
      logger.warn('Cache get error', { key, error });
      this.stats.misses++;
      return null;
    }
  }
  
  /**
   * Check if a cached entry is stale (but not expired)
   */
  async isStale(key: string, storage: 'memory' | 'local' | 'session' = 'memory'): Promise<boolean> {
    const adapter = this.getAdapter(storage);
    
    try {
      const raw = adapter.get(key);
      if (!raw) return true;
      
      const entry: CacheEntry<unknown> = JSON.parse(raw);
      const now = Date.now();
      
      // Expired = definitely stale
      if (now > entry.expiresAt) return true;
      
      // Check stale window
      if (entry.staleAt && now > entry.staleAt) return true;
      
      return false;
    } catch {
      return true;
    }
  }
  
  /**
   * Set a value in the cache
   */
  async set<T>(
    key: string, 
    data: T, 
    options: CacheOptions
  ): Promise<void> {
    const timer = startTimer();
    const adapter = this.getAdapter(options.storage);
    const now = Date.now();
    
    const ttlMs = options.ttlSeconds * 1000;
    const expiresAt = now + ttlMs;
    
    // Calculate stale time for SWR
    let staleAt: number | undefined;
    if (options.staleWhileRevalidate) {
      const staleWindow = options.staleWindowSeconds 
        ? options.staleWindowSeconds * 1000
        : ttlMs; // Default: stale after TTL, expire after 2x TTL
      staleAt = now + staleWindow;
    }
    
    const entry: CacheEntry<T> = {
      data,
      expiresAt: options.staleWhileRevalidate ? expiresAt + ttlMs : expiresAt,
      staleAt,
      createdAt: now,
      key,
    };
    
    try {
      adapter.set(key, JSON.stringify(entry));
      metrics.timing('cache.set.duration', timer(), { storage: options.storage ?? 'memory' });
      logger.debug('Cache set', { 
        key, 
        storage: options.storage ?? 'memory',
        ttlSeconds: options.ttlSeconds,
        swr: options.staleWhileRevalidate,
      });
    } catch (error) {
      logger.warn('Cache set error', { key, error });
    }
  }
  
  /**
   * Delete a value from the cache
   */
  async delete(key: string, storage?: 'memory' | 'local' | 'session'): Promise<void> {
    if (storage) {
      this.getAdapter(storage).delete(key);
    } else {
      // Delete from all storages
      this.memoryAdapter.delete(key);
      this.localAdapter?.delete(key);
      this.sessionAdapter?.delete(key);
    }
    
    logger.debug('Cache delete', { key, storage: storage ?? 'all' });
  }
  
  /**
   * Delete all entries matching a prefix
   */
  async deleteByPrefix(prefix: string, storage?: 'memory' | 'local' | 'session'): Promise<number> {
    let deleted = 0;
    
    const deleteFromAdapter = (adapter: StorageAdapter) => {
      const keys = adapter.keys().filter(k => k.startsWith(prefix));
      for (const key of keys) {
        adapter.delete(key);
        deleted++;
      }
    };
    
    if (storage) {
      deleteFromAdapter(this.getAdapter(storage));
    } else {
      // Delete from all storages
      deleteFromAdapter(this.memoryAdapter);
      if (this.localAdapter) deleteFromAdapter(this.localAdapter);
      if (this.sessionAdapter) deleteFromAdapter(this.sessionAdapter);
    }
    
    logger.debug('Cache deleteByPrefix', { prefix, deleted, storage: storage ?? 'all' });
    metrics.increment('cache.invalidations', deleted, { reason: 'prefix' });
    
    return deleted;
  }
  
  /**
   * Clear all cached data
   */
  async clear(storage?: 'memory' | 'local' | 'session'): Promise<void> {
    if (storage) {
      this.getAdapter(storage).clear();
    } else {
      this.memoryAdapter.clear();
      this.localAdapter?.clear();
      this.sessionAdapter?.clear();
    }
    
    logger.info('Cache cleared', { storage: storage ?? 'all' });
    metrics.increment('cache.clears', 1);
  }
  
  /**
   * Cache-aside pattern: get from cache or fetch and cache
   * 
   * This is the primary method for caching data. It will:
   * 1. Try to get from cache
   * 2. If cache miss, call fetcher and cache result
   * 3. If stale-while-revalidate is enabled and entry is stale,
   *    return stale data immediately and revalidate in background
   */
  async wrap<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    const timer = startTimer();
    const storage = options.storage ?? 'memory';
    
    // Try to get from cache
    const cached = await this.get<T>(key, storage);
    
    if (cached !== null) {
      // Check if we need to revalidate in background (SWR)
      if (options.staleWhileRevalidate) {
        const stale = await this.isStale(key, storage);
        
        if (stale) {
          // Return stale data immediately, revalidate in background
          this.revalidateInBackground(key, fetcher, options);
        }
      }
      
      metrics.timing('cache.wrap.duration', timer(), { storage, hit: 'true' });
      return cached;
    }
    
    // Cache miss - fetch fresh data
    try {
      const data = await fetcher();
      await this.set(key, data, options);
      
      metrics.timing('cache.wrap.duration', timer(), { storage, hit: 'false' });
      return data;
      
    } catch (error) {
      logger.error('Cache wrap fetcher error', { key, error });
      throw error;
    }
  }
  
  /**
   * Revalidate cache entry in background (for SWR)
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    // Deduplicate concurrent revalidations for same key
    if (this.pendingRevalidations.has(key)) {
      return;
    }
    
    const revalidate = (async () => {
      try {
        logger.debug('Background revalidation started', { key });
        const data = await fetcher();
        await this.set(key, data, options);
        logger.debug('Background revalidation completed', { key });
      } catch (error) {
        logger.warn('Background revalidation failed', { key, error });
      } finally {
        this.pendingRevalidations.delete(key);
      }
    })();
    
    this.pendingRevalidations.set(key, revalidate);
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    
    // Count total entries across all storages
    let size = this.memoryAdapter.keys().length;
    if (this.localAdapter) size += this.localAdapter.keys().length;
    if (this.sessionAdapter) size += this.sessionAdapter.keys().length;
    
    return {
      ...this.stats,
      size,
      hitRate,
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, staleHits: 0 };
  }
  
  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;
    
    const cleanAdapter = (adapter: StorageAdapter) => {
      for (const key of adapter.keys()) {
        try {
          const raw = adapter.get(key);
          if (!raw) continue;
          
          const entry: CacheEntry<unknown> = JSON.parse(raw);
          if (now > entry.expiresAt) {
            adapter.delete(key);
            cleaned++;
          }
        } catch {
          // Remove corrupted entries
          adapter.delete(key);
          cleaned++;
        }
      }
    };
    
    cleanAdapter(this.memoryAdapter);
    if (this.localAdapter) cleanAdapter(this.localAdapter);
    if (this.sessionAdapter) cleanAdapter(this.sessionAdapter);
    
    if (cleaned > 0) {
      logger.debug('Cache cleanup', { cleaned });
      metrics.increment('cache.cleanup', cleaned);
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const cache = new Cache();

// ============================================
// CACHE KEY BUILDERS
// ============================================

/**
 * Build cache keys with consistent naming
 */
export const CacheKeys = {
  /** All events list */
  events: () => 'events:all',
  
  /** Single event by ID */
  event: (eventId: string) => `events:${eventId}`,
  
  /** Event with ticket types */
  eventWithTickets: (eventId: string) => `events:${eventId}:tickets`,
  
  /** Event availability */
  eventAvailability: (eventId: string) => `events:${eventId}:availability`,
  
  /** Ticket types for event */
  ticketTypes: (eventId: string) => `ticket-types:${eventId}`,
  
  /** Promotion by code */
  promotion: (code: string) => `promotions:${code.toUpperCase()}`,
  
  /** User-specific data */
  userTickets: (userId: string) => `user:${userId}:tickets`,
  userOrders: (userId: string) => `user:${userId}:orders`,
  
  /** VIP tables */
  vipTables: (eventId: string) => `vip-tables:${eventId}`,
  
  /** Dashboard stats */
  dashboardStats: () => 'dashboard:stats',
} as const;

// ============================================
// CACHE TTL PRESETS
// ============================================

/**
 * Predefined TTL configurations for common use cases
 * 
 * Per specifications:
 * - Event details: 5 minutes (300s)
 * - Event list: 1 minute (60s)
 * - Ticket availability: 30 seconds
 */
export const CacheTTL = {
  /** Very short TTL for frequently changing data (10 seconds) */
  REALTIME: { ttlSeconds: 10 },
  
  /** Short TTL for dynamic data (1 minute) */
  SHORT: { ttlSeconds: 60 },
  
  /** Medium TTL for semi-static data (5 minutes) */
  MEDIUM: { ttlSeconds: 300 },
  
  /** Long TTL for mostly static data (15 minutes) */
  LONG: { ttlSeconds: 900 },
  
  /** Extended TTL for static data (1 hour) */
  EXTENDED: { ttlSeconds: 3600 },
  
  /** 
   * Event list caching (1 minute fresh, 2 minutes stale)
   * Per spec: Cache event list for 1 minute
   */
  EVENTS: { 
    ttlSeconds: 60, 
    staleWhileRevalidate: true,
    staleWindowSeconds: 60,
  },
  
  /** 
   * Single event details caching (5 minutes fresh, 10 minutes stale) 
   * Per spec: Cache event details for 5 minutes
   */
  EVENT: { 
    ttlSeconds: 300, 
    staleWhileRevalidate: true,
    staleWindowSeconds: 300,
  },
  
  /** 
   * Ticket availability (30 seconds fresh, 30 seconds stale)
   * Per spec: Cache ticket availability for 30 seconds
   */
  AVAILABILITY: { 
    ttlSeconds: 30,
    staleWhileRevalidate: true,
    staleWindowSeconds: 30,
  },
  
  /** Promotion codes (5 minutes) */
  PROMOTION: { 
    ttlSeconds: 300,
    staleWhileRevalidate: true,
  },
  
  /** User data (short, 1 minute, session storage) */
  USER_DATA: { 
    ttlSeconds: 60,
    storage: 'session' as const,
  },
  
  /** Dashboard stats (5 minutes) */
  DASHBOARD: { 
    ttlSeconds: 300,
    staleWhileRevalidate: true,
  },
  
  /** Ticket types (5 minutes, same as event details) */
  TICKET_TYPES: {
    ttlSeconds: 300,
    staleWhileRevalidate: true,
    staleWindowSeconds: 300,
  },
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Invalidate all event-related caches
 */
export async function invalidateEventCaches(eventId?: string): Promise<void> {
  if (eventId) {
    await cache.delete(CacheKeys.event(eventId));
    await cache.delete(CacheKeys.eventWithTickets(eventId));
    await cache.delete(CacheKeys.eventAvailability(eventId));
    await cache.delete(CacheKeys.ticketTypes(eventId));
  }
  
  // Always invalidate the events list
  await cache.delete(CacheKeys.events());
  
  logger.info('Event caches invalidated', { eventId: eventId ?? 'all' });
}

/**
 * Invalidate user-related caches
 */
export async function invalidateUserCaches(userId: string): Promise<void> {
  await cache.delete(CacheKeys.userTickets(userId));
  await cache.delete(CacheKeys.userOrders(userId));
  
  logger.info('User caches invalidated', { userId });
}

/**
 * Preload commonly accessed data into cache
 */
export async function preloadCache(
  loaders: {
    events?: () => Promise<unknown[]>;
  }
): Promise<void> {
  const promises: Promise<void>[] = [];
  
  if (loaders.events) {
    promises.push(
      cache.wrap(CacheKeys.events(), loaders.events, CacheTTL.EVENTS)
        .then(() => { logger.debug('Preloaded events cache'); })
        .catch(err => { logger.warn('Failed to preload events', { error: err }); })
    );
  }
  
  await Promise.all(promises);
}

// ============================================
// CACHE MONITORING
// ============================================

/**
 * Cache monitoring data
 */
export interface CacheMonitoringData {
  stats: CacheStats;
  entries: Array<{
    key: string;
    storage: 'memory' | 'local' | 'session';
    createdAt: Date;
    expiresAt: Date;
    staleAt?: Date;
    isStale: boolean;
    isExpired: boolean;
    sizeBytes: number;
  }>;
  totalSizeBytes: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

/**
 * Get detailed cache monitoring data
 */
export function getCacheMonitoringData(): CacheMonitoringData {
  const stats = cache.getStats();
  const now = Date.now();
  const entries: CacheMonitoringData['entries'] = [];
  let totalSizeBytes = 0;
  let oldestEntry: Date | undefined;
  let newestEntry: Date | undefined;

  // Helper to process entries from a storage adapter
  const processStorage = (storage: 'memory' | 'local' | 'session') => {
    const adapter = storage === 'memory' 
      ? (cache as any).memoryAdapter 
      : storage === 'local' 
        ? (cache as any).localAdapter 
        : (cache as any).sessionAdapter;
    
    if (!adapter) return;

    for (const key of adapter.keys()) {
      try {
        const raw = adapter.get(key);
        if (!raw) continue;

        const entry: CacheEntry<unknown> = JSON.parse(raw);
        const sizeBytes = raw.length * 2; // Rough estimate (UTF-16)
        totalSizeBytes += sizeBytes;

        const createdAt = new Date(entry.createdAt);
        const expiresAt = new Date(entry.expiresAt);
        const staleAt = entry.staleAt ? new Date(entry.staleAt) : undefined;
        
        if (!oldestEntry || createdAt < oldestEntry) {
          oldestEntry = createdAt;
        }
        if (!newestEntry || createdAt > newestEntry) {
          newestEntry = createdAt;
        }

        entries.push({
          key,
          storage,
          createdAt,
          expiresAt,
          staleAt,
          isStale: staleAt ? now > staleAt.getTime() : false,
          isExpired: now > expiresAt.getTime(),
          sizeBytes,
        });
      } catch {
        // Skip corrupted entries
      }
    }
  };

  processStorage('memory');
  processStorage('local');
  processStorage('session');

  return {
    stats,
    entries,
    totalSizeBytes,
    oldestEntry,
    newestEntry,
  };
}

/**
 * Log cache statistics to metrics
 */
export function reportCacheMetrics(): void {
  const stats = cache.getStats();
  
  metrics.gauge('cache.size', stats.size);
  metrics.gauge('cache.hit_rate', stats.hitRate * 100); // as percentage
  metrics.gauge('cache.hits_total', stats.hits);
  metrics.gauge('cache.misses_total', stats.misses);
  metrics.gauge('cache.stale_hits_total', stats.staleHits);
  
  logger.debug('Cache metrics reported', stats);
}

/**
 * Start periodic cache metrics reporting
 * @param intervalMs - Reporting interval in milliseconds (default: 60000 = 1 minute)
 * @returns Cleanup function to stop reporting
 */
export function startCacheMetricsReporting(intervalMs: number = 60000): () => void {
  const intervalId = setInterval(reportCacheMetrics, intervalMs);
  
  // Report immediately
  reportCacheMetrics();
  
  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Cache health check
 */
export interface CacheHealthStatus {
  healthy: boolean;
  hitRate: number;
  size: number;
  memoryAvailable: boolean;
  localStorageAvailable: boolean;
  sessionStorageAvailable: boolean;
  issues: string[];
}

/**
 * Check cache health
 */
export function checkCacheHealth(): CacheHealthStatus {
  const stats = cache.getStats();
  const issues: string[] = [];
  
  // Check hit rate (warn if below 50% after significant usage)
  const totalRequests = stats.hits + stats.misses;
  if (totalRequests > 100 && stats.hitRate < 0.5) {
    issues.push(`Low hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  }
  
  // Check if storage is available
  const memoryAvailable = true; // Memory is always available
  let localStorageAvailable = false;
  let sessionStorageAvailable = false;
  
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const testKey = '__cache_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      localStorageAvailable = true;
    }
  } catch {
    issues.push('localStorage not available');
  }
  
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const testKey = '__cache_test__';
      window.sessionStorage.setItem(testKey, 'test');
      window.sessionStorage.removeItem(testKey);
      sessionStorageAvailable = true;
    }
  } catch {
    issues.push('sessionStorage not available');
  }
  
  return {
    healthy: issues.length === 0,
    hitRate: stats.hitRate,
    size: stats.size,
    memoryAvailable,
    localStorageAvailable,
    sessionStorageAvailable,
    issues,
  };
}

/**
 * React hook for cache stats (call in useEffect)
 * Returns a function that fetches current stats
 */
export function useCacheStats(): () => CacheStats {
  return () => cache.getStats();
}
