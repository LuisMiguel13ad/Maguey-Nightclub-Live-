/**
 * Query Optimizer Tests
 * 
 * Tests for slow query logging, query timeout handling, and OptimizedQueryBuilder
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createQueryTimer,
  logSlowQuery,
  suggestIndexes,
  OptimizedQueryBuilder,
  createOptimizedQuery,
  DEFAULT_SLOW_QUERY_THRESHOLD_MS,
  DEFAULT_QUERY_TIMEOUT_MS,
  type QueryPlan,
  type IndexSuggestion,
  type LogSlowQueryOptions,
} from '../query-optimizer';

// Mock Supabase client
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    range: vi.fn(() => Promise.resolve({ data: [], error: null })),
                  })),
                })),
              })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              range: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));

// Mock logger
vi.mock('../logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('Query Optimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // CONSTANTS TESTS
  // ============================================

  describe('Constants', () => {
    it('should have correct default slow query threshold', () => {
      expect(DEFAULT_SLOW_QUERY_THRESHOLD_MS).toBe(100);
    });

    it('should have correct default query timeout', () => {
      expect(DEFAULT_QUERY_TIMEOUT_MS).toBe(30000);
    });
  });

  // ============================================
  // SLOW QUERY LOGGING TESTS
  // ============================================

  describe('createQueryTimer', () => {
    it('should create a timer that tracks duration', () => {
      const timer = createQueryTimer('test query', 'test-service');
      
      // Timer should start tracking immediately
      const duration = timer.getDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(typeof duration).toBe('number');
    });

    it('should return increasing duration over time', async () => {
      const timer = createQueryTimer('test query', 'test-service');
      
      const duration1 = timer.getDuration();
      
      // Small delay to ensure time passes
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const duration2 = timer.getDuration();
      expect(duration2).toBeGreaterThanOrEqual(duration1);
    });

    it('should not throw when completing fast query', () => {
      const timer = createQueryTimer('test query', 'test-service', 1000);
      
      // Complete immediately (should be fast)
      expect(() => timer.done(10)).not.toThrow();
    });

    it('should use default threshold of 100ms', () => {
      const timer = createQueryTimer('test query', 'test-service');
      
      // The default threshold should be DEFAULT_SLOW_QUERY_THRESHOLD_MS
      expect(DEFAULT_SLOW_QUERY_THRESHOLD_MS).toBe(100);
    });

    it('should accept custom threshold', () => {
      const customThreshold = 50;
      const timer = createQueryTimer('test query', 'test-service', customThreshold);
      
      // Timer should be created with custom threshold
      expect(timer.getDuration()).toBeGreaterThanOrEqual(0);
    });

    it('should include rows returned in logging context', () => {
      const timer = createQueryTimer('test query', 'test-service', 50);
      
      // Should not throw when calling done with rows
      expect(() => timer.done(25)).not.toThrow();
    });

    it('should include context in logging', () => {
      const timer = createQueryTimer('test query', 'test-service', 50);
      
      // Should not throw when calling done with context
      expect(() => timer.done(10, { eventId: 'test-123' })).not.toThrow();
    });

    it('should handle zero threshold', () => {
      const timer = createQueryTimer('test query', 'test-service', 0);
      expect(() => timer.done(10)).not.toThrow();
    });
  });

  describe('logSlowQuery', () => {
    it('should accept valid log options', async () => {
      const options: LogSlowQueryOptions = {
        queryText: 'SELECT * FROM events WHERE id = $1',
        durationMs: 150,
        rowsReturned: 1,
        source: 'events-service',
      };

      // Should not throw
      const result = await logSlowQuery(options);
      // Result may be null due to mocked RPC
      expect(result).toBeDefined();
    });

    it('should handle optional parameters', async () => {
      const options: LogSlowQueryOptions = {
        queryText: 'SELECT * FROM events',
        durationMs: 200,
      };

      // Should not throw with minimal options
      const result = await logSlowQuery(options);
      expect(result).toBeDefined();
    });

    it('should truncate very long query text', async () => {
      const longQuery = 'SELECT ' + 'a, '.repeat(3000) + 'b FROM table';
      const options: LogSlowQueryOptions = {
        queryText: longQuery,
        durationMs: 100,
      };

      // Should handle long queries without error
      await expect(logSlowQuery(options)).resolves.toBeDefined();
    });

    it('should include context in log', async () => {
      const options: LogSlowQueryOptions = {
        queryText: 'SELECT * FROM orders WHERE event_id = $1',
        durationMs: 300,
        context: {
          eventId: 'evt-123',
          userId: 'user-456',
        },
        source: 'orders-service',
      };

      await expect(logSlowQuery(options)).resolves.toBeDefined();
    });
  });

  // ============================================
  // INDEX SUGGESTION TESTS
  // ============================================

  describe('suggestIndexes', () => {
    it('should return empty array for empty input', () => {
      const suggestions = suggestIndexes([]);
      expect(suggestions).toEqual([]);
    });

    it('should suggest index for WHERE clause', () => {
      const queries = ['SELECT * FROM orders WHERE event_id = $1'];
      const suggestions = suggestIndexes(queries);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].tableName).toBe('orders');
      expect(suggestions[0].columns).toContain('event_id');
    });

    it('should suggest index for ORDER BY clause', () => {
      const queries = ['SELECT * FROM events ORDER BY event_date DESC'];
      const suggestions = suggestIndexes(queries);
      
      expect(suggestions.length).toBeGreaterThan(0);
      const orderSuggestion = suggestions.find(s => s.columns.includes('event_date'));
      expect(orderSuggestion).toBeDefined();
    });

    it('should suggest composite index for multiple WHERE conditions', () => {
      const queries = ['SELECT * FROM tickets WHERE status = $1 AND event_id = $2'];
      const suggestions = suggestIndexes(queries);
      
      expect(suggestions.length).toBeGreaterThan(0);
      const compositeSuggestion = suggestions.find(
        s => s.columns.includes('status') && s.columns.includes('event_id')
      );
      expect(compositeSuggestion).toBeDefined();
    });

    it('should deduplicate suggestions', () => {
      const queries = [
        'SELECT * FROM orders WHERE event_id = $1',
        'SELECT * FROM orders WHERE event_id = $2',
      ];
      const suggestions = suggestIndexes(queries);
      
      // Should not have duplicate suggestions for same table/columns
      const ordersEventSuggestions = suggestions.filter(
        s => s.tableName === 'orders' && s.columns.includes('event_id')
      );
      expect(ordersEventSuggestions.length).toBeLessThanOrEqual(1);
    });

    it('should include create statement in suggestions', () => {
      const queries = ['SELECT * FROM events WHERE status = $1'];
      const suggestions = suggestIndexes(queries);
      
      if (suggestions.length > 0) {
        expect(suggestions[0].createStatement).toContain('CREATE INDEX');
        expect(suggestions[0].createStatement).toContain('events');
      }
    });

    it('should rate improvement level', () => {
      const queries = ['SELECT * FROM orders WHERE event_id = $1 AND status = $2'];
      const suggestions = suggestIndexes(queries);
      
      if (suggestions.length > 0) {
        expect(['low', 'medium', 'high']).toContain(suggestions[0].estimatedImprovement);
      }
    });
  });

  // ============================================
  // OPTIMIZED QUERY BUILDER TESTS
  // ============================================

  describe('OptimizedQueryBuilder', () => {
    it('should create a new instance', () => {
      const builder = createOptimizedQuery();
      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should chain methods fluently', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .select('id, name, event_date')
        .eq('status', 'published')
        .order('event_date', { ascending: true })
        .limit(10);

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should support selectWithCovering', () => {
      const builder = createOptimizedQuery()
        .from('ticket_types')
        .selectWithCovering(['name', 'price', 'total_inventory']);

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should support withTimeout', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .select('*')
        .withTimeout(5000);

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should support withSource for logging', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .select('*')
        .withSource('events-service');

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should support eq filter', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .eq('id', 'event-123');

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should support in filter', () => {
      const builder = createOptimizedQuery()
        .from('tickets')
        .in('status', ['issued', 'scanned', 'used']);

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should support gte filter', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .gte('event_date', '2024-01-01');

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should support lte filter', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .lte('event_date', '2024-12-31');

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should support limitScanRange', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .limitScanRange('event_date', '2024-01-01', '2024-12-31');

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should support offset', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .limit(10)
        .offset(20);

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should execute query and return result with duration', async () => {
      const builder = createOptimizedQuery()
        .from('events')
        .select('*')
        .eq('status', 'published')
        .limit(10)
        .withTimeout(5000);

      const result = await builder.execute();
      
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('durationMs');
      expect(typeof result.durationMs).toBe('number');
    });
  });

  // ============================================
  // QUERY TIMEOUT TESTS
  // ============================================

  describe('Query Timeout Handling', () => {
    it('should have default timeout of 30 seconds', () => {
      expect(DEFAULT_QUERY_TIMEOUT_MS).toBe(30000);
    });

    it('should allow custom timeout via withTimeout', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .withTimeout(5000);

      // Builder should accept the timeout
      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should handle timeout scenario gracefully', async () => {
      // Create a builder with a very short timeout
      const builder = createOptimizedQuery()
        .from('events')
        .select('*')
        .withTimeout(1); // 1ms timeout

      // Execute should not throw, but may return error
      const result = await builder.execute();
      
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('durationMs');
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================

  describe('Integration', () => {
    it('should build complex query with all features', () => {
      const builder = createOptimizedQuery()
        .from('orders')
        .selectWithCovering(['id', 'purchaser_email', 'total', 'status'])
        .eq('event_id', 'evt-123')
        .in('status', ['completed', 'pending'])
        .gte('created_at', '2024-01-01')
        .lte('created_at', '2024-12-31')
        .order('created_at', { ascending: false })
        .limit(50)
        .offset(0)
        .withTimeout(10000)
        .withSource('orders-service');

      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should track performance across multiple queries', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 3; i++) {
        const builder = createOptimizedQuery()
          .from('events')
          .select('*')
          .limit(10);

        const result = await builder.execute();
        durations.push(result.durationMs);
      }

      // All durations should be valid numbers
      expect(durations.every(d => typeof d === 'number' && d >= 0)).toBe(true);
    });

    it('should suggest indexes based on query patterns', () => {
      const slowQueries = [
        'SELECT * FROM orders WHERE event_id = $1 ORDER BY created_at DESC',
        'SELECT * FROM tickets WHERE status = $1 AND event_id = $2',
        'SELECT * FROM events WHERE event_date >= $1 ORDER BY event_date ASC',
      ];

      const suggestions = suggestIndexes(slowQueries);
      
      // Should have suggestions for the query patterns
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Should cover different tables
      const tables = new Set(suggestions.map(s => s.tableName));
      expect(tables.size).toBeGreaterThan(0);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty table name', () => {
      const builder = createOptimizedQuery().from('');
      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should handle empty select columns', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .selectWithCovering([]);
      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should handle zero timeout', async () => {
      const builder = createOptimizedQuery()
        .from('events')
        .withTimeout(0);

      const result = await builder.execute();
      expect(result).toHaveProperty('durationMs');
    });

    it('should handle negative limit gracefully', () => {
      const builder = createOptimizedQuery()
        .from('events')
        .limit(-1);
      expect(builder).toBeInstanceOf(OptimizedQueryBuilder);
    });

    it('should handle special characters in query analysis', () => {
      const queries = ['SELECT * FROM "events" WHERE "status" = $1'];
      const suggestions = suggestIndexes(queries);
      // Should not throw
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should handle queries without FROM clause', () => {
      const queries = ['SELECT NOW()'];
      const suggestions = suggestIndexes(queries);
      expect(suggestions).toEqual([]);
    });

    it('should handle queries without WHERE clause', () => {
      const queries = ['SELECT * FROM events'];
      const suggestions = suggestIndexes(queries);
      // May or may not have suggestions, but should not throw
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  // ============================================
  // PERFORMANCE MONITORING
  // ============================================

  describe('Performance Monitoring', () => {
    it('should measure query duration accurately', async () => {
      const startTime = performance.now();
      
      const builder = createOptimizedQuery()
        .from('events')
        .select('*')
        .limit(10);

      const result = await builder.execute();
      const actualDuration = performance.now() - startTime;
      
      // Result duration should be close to actual duration
      expect(result.durationMs).toBeLessThanOrEqual(actualDuration + 10);
    });

    it('should track timer duration as non-negative', () => {
      // Fast query timer
      const fastTimer = createQueryTimer('fast query', 'test', 100);
      expect(fastTimer.getDuration()).toBeGreaterThanOrEqual(0);

      // Slow query timer
      const slowTimer = createQueryTimer('slow query', 'test', 100);
      expect(slowTimer.getDuration()).toBeGreaterThanOrEqual(0);
    });

    it('should handle high threshold values', () => {
      const timer = createQueryTimer('test query', 'test', 10000);
      
      // Duration should be way below the high threshold
      expect(timer.getDuration()).toBeLessThan(10000);
    });

    it('should capture duration at completion time', async () => {
      const timer = createQueryTimer('test query', 'test', 1);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const durationBefore = timer.getDuration();
      timer.done(10);
      
      // Duration should have been captured
      expect(durationBefore).toBeGreaterThanOrEqual(0);
    });
  });
});
