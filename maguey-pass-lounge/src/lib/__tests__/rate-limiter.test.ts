/**
 * Rate Limiter Tests
 * 
 * Tests for rate limiting functionality including:
 * - RateLimiter class behavior
 * - Pre-configured limiters
 * - Violation tracking
 * - Window expiration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RateLimiter,
  orderLimiter,
  apiLimiter,
  authLimiter,
  webhookLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  scanLimiter,
  getClientIdentifier,
  extractIP,
  type RateLimitConfig,
  type RateLimitResult,
} from '../rate-limiter';

// Mock logger to avoid console output during tests
vi.mock('../logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('Rate Limiter', () => {
  // ============================================
  // RATE LIMITER CLASS TESTS
  // ============================================

  describe('RateLimiter Class', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = new RateLimiter({
        windowMs: 60000,  // 1 minute
        maxRequests: 10,  // 10 requests
      });
    });

    afterEach(() => {
      limiter.destroy();
    });

    describe('check()', () => {
      it('should return allowed=true when under limit', async () => {
        const result = await limiter.check('test-key');
        
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(10);
        expect(result.total).toBe(0);
        expect(result.resetAt).toBeGreaterThan(Date.now());
      });

      it('should return allowed=false when limit exceeded', async () => {
        const key = 'test-key';
        
        // Increment 11 times (exceeding limit of 10)
        for (let i = 0; i < 11; i++) {
          await limiter.increment(key);
        }
        
        const result = await limiter.check(key);
        
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.total).toBe(11);
        expect(result.retryAfter).toBeDefined();
        expect(result.retryAfter).toBeGreaterThan(0);
      });

      it('should return correct remaining count', async () => {
        const key = 'test-key';
        
        // Increment 3 times
        await limiter.increment(key);
        await limiter.increment(key);
        await limiter.increment(key);
        
        const result = await limiter.check(key);
        
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(7); // 10 - 3 = 7
        expect(result.total).toBe(3);
      });

      it('should set resetAt timestamp correctly', async () => {
        const key = 'test-key';
        const before = Date.now();
        
        await limiter.increment(key);
        const result = await limiter.check(key);
        const after = Date.now();
        
        // resetAt should be approximately windowMs in the future
        const expectedReset = before + 60000;
        const actualReset = result.resetAt;
        
        expect(actualReset).toBeGreaterThanOrEqual(expectedReset - 100); // Allow 100ms tolerance
        expect(actualReset).toBeLessThanOrEqual(after + 60000 + 100);
      });

      it('should track different keys independently', async () => {
        const key1 = 'key-1';
        const key2 = 'key-2';
        
        // Increment key1 5 times
        for (let i = 0; i < 5; i++) {
          await limiter.increment(key1);
        }
        
        // Increment key2 3 times
        for (let i = 0; i < 3; i++) {
          await limiter.increment(key2);
        }
        
        const result1 = await limiter.check(key1);
        const result2 = await limiter.check(key2);
        
        expect(result1.total).toBe(5);
        expect(result1.remaining).toBe(5);
        expect(result2.total).toBe(3);
        expect(result2.remaining).toBe(7);
      });

      it('should reset after window expires', async () => {
        const key = 'test-key';
        const shortWindowLimiter = new RateLimiter({
          windowMs: 100,  // 100ms window
          maxRequests: 5,
        });
        
        // Exceed limit
        for (let i = 0; i < 6; i++) {
          await shortWindowLimiter.increment(key);
        }
        
        // Check immediately (should be blocked)
        const result1 = await shortWindowLimiter.check(key);
        expect(result1.allowed).toBe(false);
        
        // Wait for window to expire
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Check again (should be allowed)
        const result2 = await shortWindowLimiter.check(key);
        expect(result2.allowed).toBe(true);
        expect(result2.remaining).toBe(5);
        
        shortWindowLimiter.destroy();
      });

      it('should handle skip mode', async () => {
        const skipLimiter = new RateLimiter({
          windowMs: 60000,
          maxRequests: 10,
          skip: true,
        });
        
        const result = await skipLimiter.check('any-key');
        
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(10);
        
        // Even after many increments, should still allow
        for (let i = 0; i < 100; i++) {
          await skipLimiter.increment('any-key');
        }
        
        const result2 = await skipLimiter.check('any-key');
        expect(result2.allowed).toBe(true);
        
        skipLimiter.destroy();
      });
    });

    describe('increment()', () => {
      it('should increment counter and return correct result', async () => {
        const key = 'test-key';
        
        const result1 = await limiter.increment(key);
        expect(result1.allowed).toBe(true);
        expect(result1.total).toBe(1);
        expect(result1.remaining).toBe(9);
        
        const result2 = await limiter.increment(key);
        expect(result2.allowed).toBe(true);
        expect(result2.total).toBe(2);
        expect(result2.remaining).toBe(8);
      });

      it('should return allowed=false when limit exceeded after increment', async () => {
        const key = 'test-key';
        
        // Increment up to limit
        for (let i = 0; i < 10; i++) {
          const result = await limiter.increment(key);
          expect(result.allowed).toBe(true);
        }
        
        // Next increment should exceed limit
        const result = await limiter.increment(key);
        expect(result.allowed).toBe(false);
        expect(result.total).toBe(11);
        expect(result.remaining).toBe(0);
        expect(result.retryAfter).toBeDefined();
      });

      it('should include metadata in violation logs', async () => {
        const key = 'test-key';
        
        // Exceed limit with metadata
        for (let i = 0; i < 11; i++) {
          await limiter.increment(key, {
            ip: '192.168.1.1',
            userId: 'user-123',
            endpoint: '/api/orders',
          });
        }
        
        const violations = limiter.getViolations(1);
        expect(violations.length).toBeGreaterThan(0);
        expect(violations[0].ip).toBe('192.168.1.1');
        expect(violations[0].userId).toBe('user-123');
        expect(violations[0].endpoint).toBe('/api/orders');
      });
    });

    describe('reset()', () => {
      it('should reset rate limit for a key', async () => {
        const key = 'test-key';
        
        // Increment several times
        for (let i = 0; i < 5; i++) {
          await limiter.increment(key);
        }
        
        const beforeReset = await limiter.check(key);
        expect(beforeReset.total).toBe(5);
        
        // Reset
        await limiter.reset(key);
        
        const afterReset = await limiter.check(key);
        expect(afterReset.total).toBe(0);
        expect(afterReset.remaining).toBe(10);
      });
    });

    describe('getStatus()', () => {
      it('should return current status for a key', async () => {
        const key = 'test-key';
        
        await limiter.increment(key);
        await limiter.increment(key);
        
        const status = await limiter.getStatus(key);
        
        expect(status).not.toBeNull();
        expect(status?.total).toBe(2);
        expect(status?.remaining).toBe(8);
        expect(status?.allowed).toBe(true);
      });

      it('should return null for non-existent key', async () => {
        const status = await limiter.getStatus('non-existent-key');
        expect(status).toBeNull();
      });

      it('should return null for expired window', async () => {
        const shortWindowLimiter = new RateLimiter({
          windowMs: 50,
          maxRequests: 5,
        });
        
        await shortWindowLimiter.increment('test-key');
        
        // Wait for window to expire
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const status = await shortWindowLimiter.getStatus('test-key');
        expect(status).toBeNull();
        
        shortWindowLimiter.destroy();
      });
    });

    describe('getViolations()', () => {
      it('should return recent violations', async () => {
        const key = 'test-key';
        
        // Create violations
        for (let i = 0; i < 15; i++) {
          await limiter.increment(key);
        }
        
        const violations = limiter.getViolations();
        expect(violations.length).toBeGreaterThan(0);
        
        // Check that violations are sorted by timestamp (most recent first)
        for (let i = 1; i < violations.length; i++) {
          expect(violations[i - 1].timestamp).toBeGreaterThanOrEqual(violations[i].timestamp);
        }
      });

      it('should respect limit parameter', async () => {
        const key = 'test-key';
        
        // Create many violations
        for (let i = 0; i < 20; i++) {
          await limiter.increment(key);
        }
        
        const violations = limiter.getViolations(5);
        expect(violations.length).toBeLessThanOrEqual(5);
      });

      it('should return empty array when no violations', async () => {
        const violations = limiter.getViolations();
        expect(violations).toEqual([]);
      });
    });

    describe('getViolationCount()', () => {
      it('should return violation count for a key', async () => {
        const key = 'test-key';
        
        // Create violations
        for (let i = 0; i < 12; i++) {
          await limiter.increment(key);
        }
        
        const count = limiter.getViolationCount(key);
        expect(count).toBeGreaterThan(0);
      });

      it('should respect since parameter', async () => {
        const key = 'test-key';
        const since = Date.now();
        
        // Create violations
        for (let i = 0; i < 12; i++) {
          await limiter.increment(key);
        }
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const count = limiter.getViolationCount(key, since);
        expect(count).toBeGreaterThan(0);
      });

      it('should return 0 for key with no violations', async () => {
        const count = limiter.getViolationCount('no-violations-key');
        expect(count).toBe(0);
      });
    });

    describe('getStats()', () => {
      it('should return correct statistics', async () => {
        const key1 = 'key-1';
        const key2 = 'key-2';
        
        // Create some activity
        await limiter.increment(key1);
        await limiter.increment(key2);
        
        // Create violations
        for (let i = 0; i < 12; i++) {
          await limiter.increment(key1);
        }
        
        const stats = limiter.getStats();
        
        expect(stats.totalKeys).toBe(2);
        expect(stats.totalViolations).toBeGreaterThan(0);
        expect(stats.violationsLastHour).toBeGreaterThan(0);
        expect(stats.config.windowMs).toBe(60000);
        expect(stats.config.maxRequests).toBe(10);
      });
    });

    describe('clear()', () => {
      it('should clear all rate limit data', async () => {
        const key = 'test-key';
        
        // Create some activity
        await limiter.increment(key);
        for (let i = 0; i < 12; i++) {
          await limiter.increment(key);
        }
        
        // Clear
        await limiter.clear();
        
        // Check that everything is cleared
        const stats = limiter.getStats();
        expect(stats.totalKeys).toBe(0);
        expect(stats.totalViolations).toBe(0);
        
        const status = await limiter.getStatus(key);
        expect(status).toBeNull();
      });
    });

    describe('keyPrefix', () => {
      it('should prefix keys when keyPrefix is set', async () => {
        const prefixedLimiter = new RateLimiter({
          windowMs: 60000,
          maxRequests: 10,
          keyPrefix: 'test-prefix',
        });
        
        await prefixedLimiter.increment('my-key');
        
        // Check that key is prefixed internally
        const stats = prefixedLimiter.getStats();
        expect(stats.totalKeys).toBe(1);
        
        // Different prefix should be separate
        const otherLimiter = new RateLimiter({
          windowMs: 60000,
          maxRequests: 10,
          keyPrefix: 'other-prefix',
        });
        
        await otherLimiter.increment('my-key');
        expect(otherLimiter.getStats().totalKeys).toBe(1);
        
        prefixedLimiter.destroy();
        otherLimiter.destroy();
      });
    });
  });

  // ============================================
  // PRE-CONFIGURED LIMITERS TESTS
  // ============================================

  describe('Pre-configured Limiters', () => {
    describe('orderLimiter', () => {
      it('should allow 10 requests per minute', async () => {
        const key = 'user-123';
        
        // First 10 should be allowed
        for (let i = 0; i < 10; i++) {
          const result = await orderLimiter.increment(key);
          expect(result.allowed).toBe(true);
          expect(result.remaining).toBe(10 - i - 1);
        }
        
        // 11th should be blocked
        const result = await orderLimiter.increment(key);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });

      it('should have correct configuration', () => {
        const config = orderLimiter['config'];
        expect(config.windowMs).toBe(60000); // 1 minute
        expect(config.maxRequests).toBe(10);
        expect(config.keyPrefix).toBe('order');
      });
    });

    describe('apiLimiter', () => {
      it('should allow 100 requests per minute', async () => {
        const key = 'api-user';
        
        // First 100 should be allowed
        for (let i = 0; i < 100; i++) {
          const result = await apiLimiter.increment(key);
          expect(result.allowed).toBe(true);
        }
        
        // 101st should be blocked
        const result = await apiLimiter.increment(key);
        expect(result.allowed).toBe(false);
      });

      it('should have correct configuration', () => {
        const config = apiLimiter['config'];
        expect(config.windowMs).toBe(60000); // 1 minute
        expect(config.maxRequests).toBe(100);
        expect(config.keyPrefix).toBe('api');
      });
    });

    describe('authLimiter', () => {
      it('should allow 5 requests per 15 minutes', async () => {
        const key = 'ip-192.168.1.1';
        
        // First 5 should be allowed
        for (let i = 0; i < 5; i++) {
          const result = await authLimiter.increment(key);
          expect(result.allowed).toBe(true);
          expect(result.remaining).toBe(5 - i - 1);
        }
        
        // 6th should be blocked
        const result = await authLimiter.increment(key);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });

      it('should have correct configuration', () => {
        const config = authLimiter['config'];
        expect(config.windowMs).toBe(15 * 60 * 1000); // 15 minutes
        expect(config.maxRequests).toBe(5);
        expect(config.keyPrefix).toBe('auth');
      });
    });

    describe('webhookLimiter', () => {
      it('should allow 50 requests per minute', async () => {
        const key = 'ip-192.168.1.1';
        
        // First 50 should be allowed
        for (let i = 0; i < 50; i++) {
          const result = await webhookLimiter.increment(key);
          expect(result.allowed).toBe(true);
        }
        
        // 51st should be blocked
        const result = await webhookLimiter.increment(key);
        expect(result.allowed).toBe(false);
      });
    });

    describe('passwordResetLimiter', () => {
      it('should allow 3 requests per hour', async () => {
        const key = 'user-123';
        
        // First 3 should be allowed
        for (let i = 0; i < 3; i++) {
          const result = await passwordResetLimiter.increment(key);
          expect(result.allowed).toBe(true);
        }
        
        // 4th should be blocked
        const result = await passwordResetLimiter.increment(key);
        expect(result.allowed).toBe(false);
      });
    });

    describe('emailVerificationLimiter', () => {
      it('should allow 5 requests per hour', async () => {
        const key = 'user-123';
        
        // First 5 should be allowed
        for (let i = 0; i < 5; i++) {
          const result = await emailVerificationLimiter.increment(key);
          expect(result.allowed).toBe(true);
        }
        
        // 6th should be blocked
        const result = await emailVerificationLimiter.increment(key);
        expect(result.allowed).toBe(false);
      });
    });

    describe('scanLimiter', () => {
      it('should allow 100 requests per minute', async () => {
        const key = 'scanner-123';
        
        // First 100 should be allowed
        for (let i = 0; i < 100; i++) {
          const result = await scanLimiter.increment(key);
          expect(result.allowed).toBe(true);
        }
        
        // 101st should be blocked
        const result = await scanLimiter.increment(key);
        expect(result.allowed).toBe(false);
      });
    });
  });

  // ============================================
  // HELPER FUNCTIONS TESTS
  // ============================================

  describe('Helper Functions', () => {
    describe('getClientIdentifier', () => {
      it('should prioritize userId over IP', () => {
        const identifier = getClientIdentifier('192.168.1.1', 'user-123');
        expect(identifier).toBe('user:user-123');
      });

      it('should use IP when userId not provided', () => {
        const identifier = getClientIdentifier('192.168.1.1');
        expect(identifier).toBe('ip:192.168.1.1');
      });

      it('should use fallback when neither provided', () => {
        const identifier = getClientIdentifier(undefined, undefined, 'anonymous');
        expect(identifier).toBe('anonymous');
      });
    });

    describe('extractIP', () => {
      it('should extract IP from x-forwarded-for header', () => {
        const headers = new Headers({
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        });
        
        const ip = extractIP(headers);
        expect(ip).toBe('192.168.1.1');
      });

      it('should extract IP from x-real-ip header', () => {
        const headers = new Headers({
          'x-real-ip': '192.168.1.2',
        });
        
        const ip = extractIP(headers);
        expect(ip).toBe('192.168.1.2');
      });

      it('should extract IP from cf-connecting-ip header', () => {
        const headers = new Headers({
          'cf-connecting-ip': '192.168.1.3',
        });
        
        const ip = extractIP(headers);
        expect(ip).toBe('192.168.1.3');
      });

      it('should handle case-insensitive headers', () => {
        // Test with lowercase (most common)
        const headers1 = {
          'x-forwarded-for': '192.168.1.4',
        };
        const ip1 = extractIP(headers1);
        expect(ip1).toBe('192.168.1.4');
        
        // Test with mixed case (Headers object handles case-insensitivity)
        const headers2 = new Headers({
          'X-Forwarded-For': '192.168.1.5',
        });
        const ip2 = extractIP(headers2);
        expect(ip2).toBe('192.168.1.5');
      });

      it('should return undefined when no IP headers found', () => {
        const headers = new Headers();
        const ip = extractIP(headers);
        expect(ip).toBeUndefined();
      });
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('should handle concurrent increments', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      });
      
      const key = 'concurrent-key';
      const promises = [];
      
      // Create 15 concurrent increments
      for (let i = 0; i < 15; i++) {
        promises.push(limiter.increment(key));
      }
      
      const results = await Promise.all(promises);
      
      // At least some should be blocked
      const blocked = results.filter(r => !r.allowed);
      expect(blocked.length).toBeGreaterThan(0);
      
      // Final count should be at least 10 (some may have been blocked)
      const finalStatus = await limiter.getStatus(key);
      expect(finalStatus?.total).toBeGreaterThanOrEqual(10);
      
      limiter.destroy();
    });

    it('should handle very short windows', async () => {
      const limiter = new RateLimiter({
        windowMs: 10,  // 10ms window
        maxRequests: 3,
      });
      
      const key = 'short-window-key';
      
      // Should allow first 3
      for (let i = 0; i < 3; i++) {
        const result = await limiter.increment(key);
        expect(result.allowed).toBe(true);
      }
      
      // 4th should be blocked
      const result = await limiter.increment(key);
      expect(result.allowed).toBe(false);
      
      limiter.destroy();
    });

    it('should handle empty key strings', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      });
      
      const result = await limiter.increment('');
      expect(result.allowed).toBe(true);
      
      limiter.destroy();
    });

    it('should handle special characters in keys', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      });
      
      const specialKey = 'key:with:colons:and/slashes';
      const result = await limiter.increment(specialKey);
      expect(result.allowed).toBe(true);
      
      const status = await limiter.getStatus(specialKey);
      expect(status?.total).toBe(1);
      
      limiter.destroy();
    });
  });
});
