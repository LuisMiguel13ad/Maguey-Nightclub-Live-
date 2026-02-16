/**
 * Rate Limiter
 *
 * Provides rate limiting functionality to protect against abuse and DDoS attacks.
 * Uses in-memory storage by default, can be extended to use Redis for distributed systems.
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({
 *   windowMs: 60000,  // 1 minute
 *   maxRequests: 10,  // 10 requests per minute
 * });
 *
 * const result = await limiter.check('user-123');
 * if (!result.allowed) {
 *   throw new Error(`Rate limit exceeded. Retry after ${result.retryAfter}s`);
 * }
 * ```
 */

import { createLogger } from './logger';

const logger = createLogger({ module: 'rate-limiter' });

// ============================================
// TYPES
// ============================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Optional prefix for rate limit keys (for different limit types) */
  keyPrefix?: string;
  /** Whether to skip rate limiting (for development/testing) */
  skip?: boolean;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Timestamp when the rate limit window resets (Unix milliseconds) */
  resetAt: number;
  /** Seconds until the user can retry (if rate limited) */
  retryAfter?: number;
  /** Total requests in current window */
  total: number;
}

/**
 * Rate limit entry in storage
 */
interface RateLimitEntry {
  /** Number of requests in current window */
  count: number;
  /** Timestamp when window resets */
  resetAt: number;
  /** First request timestamp in current window */
  firstRequestAt: number;
}

/**
 * Rate limit violation log
 */
export interface RateLimitViolation {
  key: string;
  count: number;
  maxRequests: number;
  timestamp: number;
  ip?: string;
  userId?: string;
  endpoint?: string;
}

// ============================================
// RATE LIMITER CLASS
// ============================================

/**
 * Rate limiter with in-memory storage
 *
 * For production distributed systems, extend this to use Redis or similar.
 */
export class RateLimiter {
  private storage: Map<string, RateLimitEntry> = new Map();
  private violations: RateLimitViolation[] = [];
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly maxViolationsHistory = 1000;

  constructor(private config: RateLimitConfig) {
    // Start cleanup interval to remove expired entries
    this.startCleanup();
  }

  /**
   * Check if a request is allowed without incrementing the counter
   */
  async check(key: string): Promise<RateLimitResult> {
    if (this.config.skip) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: Date.now() + this.config.windowMs,
        total: 0,
      };
    }

    const fullKey = this.getFullKey(key);
    const now = Date.now();
    const entry = this.storage.get(fullKey);

    // If no entry or window expired, create new entry
    if (!entry || now >= entry.resetAt) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: now + this.config.windowMs,
        total: 0,
      };
    }

    // Check if limit exceeded
    const allowed = entry.count < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const retryAfter = allowed ? undefined : Math.ceil((entry.resetAt - now) / 1000);

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
      retryAfter,
      total: entry.count,
    };
  }

  /**
   * Increment the counter and check if request is allowed
   */
  async increment(key: string, metadata?: { ip?: string; userId?: string; endpoint?: string }): Promise<RateLimitResult> {
    if (this.config.skip) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: Date.now() + this.config.windowMs,
        total: 0,
      };
    }

    const fullKey = this.getFullKey(key);
    const now = Date.now();
    let entry = this.storage.get(fullKey);

    // If no entry or window expired, create new entry
    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + this.config.windowMs,
        firstRequestAt: now,
      };
    }

    // Increment counter
    entry.count++;

    // Check if limit exceeded
    const allowed = entry.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const retryAfter = allowed ? undefined : Math.ceil((entry.resetAt - now) / 1000);

    // Store updated entry
    this.storage.set(fullKey, entry);

    // Log violation if limit exceeded
    if (!allowed) {
      this.logViolation(fullKey, entry.count, metadata);
    }

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
      retryAfter,
      total: entry.count,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    this.storage.delete(fullKey);
    logger.debug('Rate limit reset', { key: fullKey });
  }

  /**
   * Get current rate limit status for a key
   */
  async getStatus(key: string): Promise<RateLimitResult | null> {
    const fullKey = this.getFullKey(key);
    const entry = this.storage.get(fullKey);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now >= entry.resetAt) {
      return null; // Window expired
    }

    const allowed = entry.count < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const retryAfter = allowed ? undefined : Math.ceil((entry.resetAt - now) / 1000);

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
      retryAfter,
      total: entry.count,
    };
  }

  /**
   * Get all violations (for monitoring/dashboard)
   */
  getViolations(limit: number = 100): RateLimitViolation[] {
    return this.violations.slice(-limit).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get violation count for a specific key
   */
  getViolationCount(key: string, since?: number): number {
    const fullKey = this.getFullKey(key);
    const cutoff = since || Date.now() - 3600000; // Default: last hour

    return this.violations.filter((v) => v.key === fullKey && v.timestamp >= cutoff).length;
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalKeys: number;
    totalViolations: number;
    violationsLastHour: number;
    config: RateLimitConfig;
  } {
    const oneHourAgo = Date.now() - 3600000;
    const violationsLastHour = this.violations.filter((v) => v.timestamp >= oneHourAgo).length;

    return {
      totalKeys: this.storage.size,
      totalViolations: this.violations.length,
      violationsLastHour,
      config: this.config,
    };
  }

  /**
   * Clear all rate limit data (for testing/reset)
   */
  async clear(): Promise<void> {
    this.storage.clear();
    this.violations = [];
    logger.info('Rate limiter cleared');
  }

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  /**
   * Log a rate limit violation
   */
  private logViolation(key: string, count: number, metadata?: { ip?: string; userId?: string; endpoint?: string }): void {
    const violation: RateLimitViolation = {
      key,
      count,
      maxRequests: this.config.maxRequests,
      timestamp: Date.now(),
      ...metadata,
    };

    this.violations.push(violation);

    // Keep only recent violations
    if (this.violations.length > this.maxViolationsHistory) {
      this.violations = this.violations.slice(-this.maxViolationsHistory);
    }

    logger.warn('Rate limit exceeded', {
      key,
      count,
      maxRequests: this.config.maxRequests,
      ...metadata,
    });
  }

  /**
   * Start cleanup interval to remove expired entries
   */
  private startCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.storage.entries()) {
      if (now >= entry.resetAt) {
        this.storage.delete(key);
        cleaned++;
      }
    }

    // Clean up old violations (keep last 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const before = this.violations.length;
    this.violations = this.violations.filter((v) => v.timestamp >= cutoff);
    const violationsCleaned = before - this.violations.length;

    if (cleaned > 0 || violationsCleaned > 0) {
      logger.debug('Rate limiter cleanup', {
        entriesCleaned: cleaned,
        violationsCleaned,
      });
    }
  }

  /**
   * Stop cleanup interval (for cleanup/testing)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ============================================
// PRE-CONFIGURED LIMITERS
// ============================================

/**
 * Rate limiter for order creation
 * Limits: 10 orders per minute per user
 */
export const orderLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 orders per minute per user
  keyPrefix: 'order',
});

/**
 * Rate limiter for general API calls
 * Limits: 100 API calls per minute
 */
export const apiLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 API calls per minute
  keyPrefix: 'api',
});

/**
 * Rate limiter for authentication attempts
 * Limits: 5 failed login attempts per 15 minutes
 */
export const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 failed login attempts
  keyPrefix: 'auth',
});

/**
 * Rate limiter for password reset requests
 * Limits: 3 password reset requests per hour
 */
export const passwordResetLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 password reset requests per hour
  keyPrefix: 'password-reset',
});

/**
 * Rate limiter for email verification requests
 * Limits: 5 verification emails per hour
 */
export const emailVerificationLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 verification emails per hour
  keyPrefix: 'email-verification',
});

/**
 * Rate limiter for webhook endpoints (by IP)
 * Limits: 50 webhook requests per minute per IP
 */
export const webhookLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // 50 webhook requests per minute per IP
  keyPrefix: 'webhook',
});

/**
 * Rate limiter for ticket scanning
 * Limits: 100 scans per minute per scanner
 */
export const scanLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 scans per minute per scanner
  keyPrefix: 'scan',
});

/**
 * Rate limiter for manual ticket entry
 * Limits: 5 manual lookups per minute per device
 * Prevents brute-force ticket ID guessing
 */
export const manualEntryLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 manual entries per minute
  keyPrefix: 'manual-entry',
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get client identifier from request
 * Uses IP address, user ID, or combination
 */
export function getClientIdentifier(ip?: string, userId?: string, fallback: string = 'anonymous'): string {
  if (userId) {
    return `user:${userId}`;
  }
  if (ip) {
    return `ip:${ip}`;
  }
  return fallback;
}

/**
 * Extract IP address from request headers
 */
export function extractIP(headers: Headers | Record<string, string>): string | undefined {
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    return headers[name] || headers[name.toLowerCase()] || null;
  };

  // Check common IP headers (in order of preference)
  const forwardedFor = getHeader('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = getHeader('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = getHeader('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return undefined;
}

// ============================================
// EXPORTS
// ============================================

export const rateLimiter = {
  RateLimiter,
  orderLimiter,
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  webhookLimiter,
  scanLimiter,
  getClientIdentifier,
  extractIP,
};

export default rateLimiter;
