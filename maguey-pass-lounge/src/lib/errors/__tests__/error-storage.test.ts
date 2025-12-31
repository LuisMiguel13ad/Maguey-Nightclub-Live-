/**
 * Error Storage Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorStorage } from '../error-storage';
import { ErrorSeverity, ErrorCategory } from '../error-types';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('ErrorStorage', () => {
  let storage: ErrorStorage;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      rpc: vi.fn(),
      single: vi.fn(),
    };

    storage = new ErrorStorage(mockSupabase as unknown as SupabaseClient);
  });

  describe('storeError', () => {
    it('should store error event', async () => {
      const mockInsert = vi.fn().mockResolvedValue({
        data: { id: 'test-id' },
        error: null,
      });

      mockSupabase.insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-id' },
            error: null,
          }),
        }),
      });

      mockSupabase.rpc.mockResolvedValue({ error: null });

      const error = {
        id: 'error-id',
        fingerprint: 'fingerprint-123',
        message: 'Test error',
        stack: 'Error stack',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        context: { userId: 'user-123' },
        tags: { type: 'test' },
        timestamp: new Date(),
        handled: false,
        serviceName: 'test-service',
      };

      const errorId = await storage.storeError(error);

      expect(errorId).toBe('test-id');
      expect(mockSupabase.from).toHaveBeenCalledWith('error_events');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      mockSupabase.insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Storage error' },
          }),
        }),
      });

      const error = {
        id: 'error-id',
        fingerprint: 'fingerprint-123',
        message: 'Test error',
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.MEDIUM,
        context: {},
        tags: {},
        timestamp: new Date(),
        handled: false,
        serviceName: 'test-service',
      };

      await expect(storage.storeError(error)).rejects.toThrow();
    });
  });

  describe('getErrorGroups', () => {
    it('should fetch error groups with filters', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          fingerprint: 'fp-1',
          message: 'Error 1',
          status: 'open',
          severity: 'high',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockGroups,
                error: null,
              }),
            }),
          }),
        }),
      });

      const groups = await storage.getErrorGroups({
        status: 'open',
        severity: ErrorSeverity.HIGH,
        limit: 10,
      });

      expect(groups).toEqual(mockGroups);
      expect(mockSupabase.from).toHaveBeenCalledWith('error_groups');
    });
  });

  describe('getErrorEvents', () => {
    it('should fetch error events by fingerprint', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          message: 'Error occurred',
          created_at: new Date().toISOString(),
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockEvents,
        error: null,
      });

      const events = await storage.getErrorEvents('fingerprint-123', 50);

      expect(events.length).toBeGreaterThan(0);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_error_events', {
        p_fingerprint: 'fingerprint-123',
        p_limit: 50,
      });
    });
  });

  describe('updateErrorGroupStatus', () => {
    it('should update error group status', async () => {
      mockSupabase.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      await storage.updateErrorGroupStatus('fingerprint-123', 'resolved', 'admin@example.com');

      expect(mockSupabase.from).toHaveBeenCalledWith('error_groups');
      expect(mockSupabase.update).toHaveBeenCalled();
    });
  });

  describe('getErrorStats', () => {
    it('should fetch error statistics', async () => {
      const mockStats = [
        {
          hour: new Date().toISOString(),
          service_name: 'test-service',
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.LOW,
          error_count: 10,
          affected_users: 5,
          unique_errors: 2,
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockStats,
              error: null,
            }),
          }),
        }),
      });

      const stats = await storage.getErrorStats(24);

      expect(stats).toEqual(mockStats);
      expect(mockSupabase.from).toHaveBeenCalledWith('error_stats');
    });
  });
});
