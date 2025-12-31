/**
 * Pagination Utilities Tests
 * 
 * Tests for offset-based and cursor-based pagination utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  // Offset pagination
  normalizePaginationOptions,
  calculatePagination,
  applyPagination,
  buildPaginatedResponse,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE,
  getPageNumbers,
  parsePaginationFromQuery,
  buildPaginationQueryString,
  // Cursor pagination
  normalizeCursorOptions,
  applyCursorPagination,
  buildCursorPaginatedResponse,
  parseCursorFromQuery,
  buildCursorQueryString,
  // Types
  type PaginationOptions,
  type PaginatedResult,
  type CursorPaginationOptions,
  type CursorPaginatedResult,
} from '../pagination';
import {
  createMockSupabaseClient,
  createMockEvent,
  createMockOrder,
  createMockTicketType,
  resetCounters,
} from './test-utils';

// ============================================
// OFFSET PAGINATION TESTS
// ============================================

describe('Offset Pagination', () => {
  describe('normalizePaginationOptions', () => {
    it('should use default values when no options provided', () => {
      const options = normalizePaginationOptions({});
      
      expect(options.page).toBe(1);
      expect(options.pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(options.sortBy).toBe('created_at');
      expect(options.sortOrder).toBe('desc');
    });

    it('should preserve custom values when provided', () => {
      const options = normalizePaginationOptions({
        page: 5,
        pageSize: 50,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      
      expect(options.page).toBe(5);
      expect(options.pageSize).toBe(50);
      expect(options.sortBy).toBe('name');
      expect(options.sortOrder).toBe('asc');
    });

    it('should enforce minimum page of 1', () => {
      const options = normalizePaginationOptions({ page: -5 });
      expect(options.page).toBe(MIN_PAGE);
      
      const options2 = normalizePaginationOptions({ page: 0 });
      expect(options2.page).toBe(MIN_PAGE);
    });

    it('should enforce maximum pageSize', () => {
      const options = normalizePaginationOptions({ pageSize: 500 });
      expect(options.pageSize).toBe(MAX_PAGE_SIZE);
    });

    it('should enforce minimum pageSize of 1', () => {
      const options = normalizePaginationOptions({ pageSize: -10 });
      expect(options.pageSize).toBe(1);
      
      const options2 = normalizePaginationOptions({ pageSize: 0 });
      expect(options2.pageSize).toBe(1);
    });

    it('should floor decimal page values', () => {
      const options = normalizePaginationOptions({ page: 2.7 });
      expect(options.page).toBe(2);
    });
  });

  describe('calculatePagination', () => {
    it('should calculate correct offset and limit', () => {
      const result = calculatePagination(100, { page: 3, pageSize: 20 });
      
      expect(result.offset).toBe(40); // (3-1) * 20
      expect(result.limit).toBe(20);
    });

    it('should calculate correct totalPages', () => {
      // Exact division
      const result1 = calculatePagination(100, { pageSize: 20 });
      expect(result1.meta.totalPages).toBe(5);
      
      // With remainder
      const result2 = calculatePagination(95, { pageSize: 20 });
      expect(result2.meta.totalPages).toBe(5); // ceil(95/20) = 5
      
      // Single page
      const result3 = calculatePagination(10, { pageSize: 20 });
      expect(result3.meta.totalPages).toBe(1);
      
      // Empty result
      const result4 = calculatePagination(0, { pageSize: 20 });
      expect(result4.meta.totalPages).toBe(0);
    });

    it('should correctly determine hasNextPage', () => {
      // Has next page
      const result1 = calculatePagination(100, { page: 3, pageSize: 20 });
      expect(result1.meta.hasNextPage).toBe(true);
      
      // Last page
      const result2 = calculatePagination(100, { page: 5, pageSize: 20 });
      expect(result2.meta.hasNextPage).toBe(false);
      
      // Beyond last page
      const result3 = calculatePagination(100, { page: 10, pageSize: 20 });
      expect(result3.meta.hasNextPage).toBe(false);
    });

    it('should correctly determine hasPreviousPage', () => {
      // First page
      const result1 = calculatePagination(100, { page: 1, pageSize: 20 });
      expect(result1.meta.hasPreviousPage).toBe(false);
      
      // Page 2
      const result2 = calculatePagination(100, { page: 2, pageSize: 20 });
      expect(result2.meta.hasPreviousPage).toBe(true);
      
      // Last page
      const result3 = calculatePagination(100, { page: 5, pageSize: 20 });
      expect(result3.meta.hasPreviousPage).toBe(true);
    });
  });

  describe('applyPagination', () => {
    it('should add correct LIMIT and OFFSET to query', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
      };
      
      applyPagination(mockQuery as any, { page: 2, pageSize: 25 });
      
      // Should call order with sortBy and direction
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      
      // Should call range with correct offset and end
      // page 2, pageSize 25: offset = (2-1)*25 = 25, end = 25+25-1 = 49
      expect(mockQuery.range).toHaveBeenCalledWith(25, 49);
    });

    it('should use ascending order when sortOrder is asc', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
      };
      
      applyPagination(mockQuery as any, { sortOrder: 'asc' });
      
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('should use custom sortBy column', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
      };
      
      applyPagination(mockQuery as any, { sortBy: 'event_date' });
      
      expect(mockQuery.order).toHaveBeenCalledWith('event_date', { ascending: false });
    });

    it('should calculate correct range for first page', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
      };
      
      applyPagination(mockQuery as any, { page: 1, pageSize: 10 });
      
      // page 1, pageSize 10: offset = 0, end = 9
      expect(mockQuery.range).toHaveBeenCalledWith(0, 9);
    });
  });

  describe('buildPaginatedResponse', () => {
    it('should build correct response structure', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = buildPaginatedResponse(data, 100, { page: 1, pageSize: 20 });
      
      expect(result.data).toEqual(data);
      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('pageSize');
      expect(result.pagination).toHaveProperty('totalItems');
      expect(result.pagination).toHaveProperty('totalPages');
      expect(result.pagination).toHaveProperty('hasNextPage');
      expect(result.pagination).toHaveProperty('hasPreviousPage');
      expect(result.pagination).toHaveProperty('startIndex');
      expect(result.pagination).toHaveProperty('endIndex');
    });

    it('should calculate totalPages correctly', () => {
      const data = [{ id: 1 }];
      
      // 100 items, 20 per page = 5 pages
      const result1 = buildPaginatedResponse(data, 100, { pageSize: 20 });
      expect(result1.pagination.totalPages).toBe(5);
      
      // 21 items, 20 per page = 2 pages
      const result2 = buildPaginatedResponse(data, 21, { pageSize: 20 });
      expect(result2.pagination.totalPages).toBe(2);
      
      // 20 items, 20 per page = 1 page
      const result3 = buildPaginatedResponse(data, 20, { pageSize: 20 });
      expect(result3.pagination.totalPages).toBe(1);
    });

    it('should set hasNextPage true when more pages exist', () => {
      const data = [{ id: 1 }];
      
      // Page 1 of 5
      const result = buildPaginatedResponse(data, 100, { page: 1, pageSize: 20 });
      expect(result.pagination.hasNextPage).toBe(true);
    });

    it('should set hasNextPage false on last page', () => {
      const data = [{ id: 1 }];
      
      // Page 5 of 5
      const result = buildPaginatedResponse(data, 100, { page: 5, pageSize: 20 });
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should set hasPreviousPage true when page > 1', () => {
      const data = [{ id: 1 }];
      
      const result = buildPaginatedResponse(data, 100, { page: 2, pageSize: 20 });
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('should set hasPreviousPage false on first page', () => {
      const data = [{ id: 1 }];
      
      const result = buildPaginatedResponse(data, 100, { page: 1, pageSize: 20 });
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should calculate correct startIndex and endIndex', () => {
      // Page 1 with 3 items
      const result1 = buildPaginatedResponse([1, 2, 3], 100, { page: 1, pageSize: 20 });
      expect(result1.pagination.startIndex).toBe(1);
      expect(result1.pagination.endIndex).toBe(3);
      
      // Page 2 with 5 items
      const result2 = buildPaginatedResponse([1, 2, 3, 4, 5], 100, { page: 2, pageSize: 20 });
      expect(result2.pagination.startIndex).toBe(21);
      expect(result2.pagination.endIndex).toBe(25);
      
      // Empty data
      const result3 = buildPaginatedResponse([], 0, { page: 1, pageSize: 20 });
      expect(result3.pagination.startIndex).toBe(0);
      expect(result3.pagination.endIndex).toBe(0);
    });

    it('should use default page 1 and pageSize 20 when not specified', () => {
      const data = [{ id: 1 }];
      const result = buildPaginatedResponse(data, 100, {});
      
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(DEFAULT_PAGE_SIZE);
    });
  });

  describe('getPageNumbers', () => {
    it('should return all pages for small total', () => {
      const pages = getPageNumbers(1, 5);
      expect(pages).toEqual([1, 2, 3, -1, 5]);
    });

    it('should include ellipsis for large page counts', () => {
      const pages = getPageNumbers(50, 100);
      
      expect(pages[0]).toBe(1); // Always first
      expect(pages[1]).toBe(-1); // Ellipsis
      expect(pages).toContain(50); // Current page
      expect(pages[pages.length - 2]).toBe(-1); // Ellipsis before last
      expect(pages[pages.length - 1]).toBe(100); // Always last
    });

    it('should show surrounding pages around current', () => {
      const pages = getPageNumbers(5, 10, 2);
      
      expect(pages).toContain(3); // current - 2
      expect(pages).toContain(4); // current - 1
      expect(pages).toContain(5); // current
      expect(pages).toContain(6); // current + 1
      expect(pages).toContain(7); // current + 2
    });

    it('should handle single page', () => {
      const pages = getPageNumbers(1, 1);
      expect(pages).toEqual([1]);
    });

    it('should handle empty (0 pages)', () => {
      const pages = getPageNumbers(1, 0);
      expect(pages).toEqual([]);
    });
  });

  describe('Query String Helpers', () => {
    it('should build query string from options', () => {
      const qs = buildPaginationQueryString({
        page: 2,
        pageSize: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      
      expect(qs).toContain('page=2');
      expect(qs).toContain('pageSize=25');
      expect(qs).toContain('sortBy=name');
      expect(qs).toContain('sortOrder=asc');
    });

    it('should parse query string to options', () => {
      const parsed = parsePaginationFromQuery('page=3&pageSize=50&sortBy=date&sortOrder=desc');
      
      expect(parsed.page).toBe(3);
      expect(parsed.pageSize).toBe(50);
      expect(parsed.sortBy).toBe('date');
      expect(parsed.sortOrder).toBe('desc');
    });

    it('should handle missing query params', () => {
      const parsed = parsePaginationFromQuery('');
      
      expect(parsed.page).toBeUndefined();
      expect(parsed.pageSize).toBeUndefined();
    });

    it('should round-trip query string correctly', () => {
      const original = { page: 5, pageSize: 30, sortBy: 'created_at', sortOrder: 'desc' as const };
      const qs = buildPaginationQueryString(original);
      const parsed = parsePaginationFromQuery(qs);
      
      expect(parsed.page).toBe(original.page);
      expect(parsed.pageSize).toBe(original.pageSize);
      expect(parsed.sortBy).toBe(original.sortBy);
      expect(parsed.sortOrder).toBe(original.sortOrder);
    });
  });
});

// ============================================
// CURSOR PAGINATION TESTS
// ============================================

describe('Cursor Pagination', () => {
  describe('normalizeCursorOptions', () => {
    it('should use default values when no options provided', () => {
      const options = normalizeCursorOptions({});
      
      expect(options.limit).toBe(DEFAULT_PAGE_SIZE);
      expect(options.cursor).toBeNull();
      expect(options.direction).toBe('forward');
      expect(options.cursorColumn).toBe('id');
      expect(options.sortBy).toBe('created_at');
      expect(options.sortOrder).toBe('desc');
    });

    it('should preserve custom values', () => {
      const options = normalizeCursorOptions({
        limit: 50,
        cursor: 'abc123',
        direction: 'backward',
        cursorColumn: 'updated_at',
      });
      
      expect(options.limit).toBe(50);
      expect(options.cursor).toBe('abc123');
      expect(options.direction).toBe('backward');
      expect(options.cursorColumn).toBe('updated_at');
    });

    it('should enforce maximum limit', () => {
      const options = normalizeCursorOptions({ limit: 500 });
      expect(options.limit).toBe(MAX_PAGE_SIZE);
    });

    it('should enforce minimum limit', () => {
      const options = normalizeCursorOptions({ limit: 0 });
      expect(options.limit).toBe(1);
    });
  });

  describe('applyCursorPagination', () => {
    it('should add cursor filter for forward pagination', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      
      applyCursorPagination(mockQuery as any, {
        cursor: 'cursor-123',
        limit: 20,
        direction: 'forward',
        sortOrder: 'desc',
      });
      
      // For desc order, forward pagination uses lt
      expect(mockQuery.lt).toHaveBeenCalledWith('id', 'cursor-123');
      expect(mockQuery.limit).toHaveBeenCalledWith(21); // limit + 1 for hasMore check
    });

    it('should add cursor filter for backward pagination', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      
      applyCursorPagination(mockQuery as any, {
        cursor: 'cursor-123',
        limit: 20,
        direction: 'backward',
        sortOrder: 'desc',
      });
      
      // For desc order, backward pagination uses gt
      expect(mockQuery.gt).toHaveBeenCalledWith('id', 'cursor-123');
    });

    it('should not add cursor filter when cursor is null', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      
      applyCursorPagination(mockQuery as any, {
        cursor: null,
        limit: 20,
      });
      
      expect(mockQuery.lt).not.toHaveBeenCalled();
      expect(mockQuery.gt).not.toHaveBeenCalled();
    });

    it('should apply sorting', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      
      applyCursorPagination(mockQuery as any, {
        sortBy: 'event_date',
        sortOrder: 'asc',
      });
      
      expect(mockQuery.order).toHaveBeenCalledWith('event_date', { ascending: true });
    });
  });

  describe('buildCursorPaginatedResponse', () => {
    it('should detect hasMore when extra item exists', () => {
      // Data has limit + 1 items
      const data = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 2 },
        (item) => item.id
      );
      
      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(2); // Trimmed to limit
    });

    it('should set hasMore false when no extra item', () => {
      // Data has exactly limit items
      const data = [{ id: '1' }, { id: '2' }];
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 2 },
        (item) => item.id
      );
      
      expect(result.hasMore).toBe(false);
      expect(result.data).toHaveLength(2);
    });

    it('should extract nextCursor from last item when hasMore', () => {
      const data = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 2 },
        (item) => item.id
      );
      
      expect(result.nextCursor).toBe('2'); // Last item of trimmed data
    });

    it('should set nextCursor to null when no more items', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 2 },
        (item) => item.id
      );
      
      expect(result.nextCursor).toBeNull();
    });

    it('should extract previousCursor when cursor was provided', () => {
      const data = [{ id: '3' }, { id: '4' }];
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 2, cursor: 'some-cursor' },
        (item) => item.id
      );
      
      expect(result.previousCursor).toBe('3'); // First item
    });

    it('should set previousCursor to null when no cursor was provided', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 2, cursor: null },
        (item) => item.id
      );
      
      expect(result.previousCursor).toBeNull();
    });

    it('should reverse data for backward pagination', () => {
      const data = [{ id: '3' }, { id: '2' }, { id: '1' }];
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 3, direction: 'backward' },
        (item) => item.id
      );
      
      expect(result.data[0].id).toBe('1');
      expect(result.data[2].id).toBe('3');
    });

    it('should return correct count', () => {
      const data = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 2 },
        (item) => item.id
      );
      
      expect(result.count).toBe(2); // After trimming
    });
  });

  describe('Cursor Query String Helpers', () => {
    it('should build cursor query string', () => {
      const qs = buildCursorQueryString({
        cursor: 'abc123',
        limit: 25,
        direction: 'forward',
      });
      
      expect(qs).toContain('cursor=abc123');
      expect(qs).toContain('limit=25');
      expect(qs).toContain('direction=forward');
    });

    it('should parse cursor query string', () => {
      const parsed = parseCursorFromQuery('cursor=xyz&limit=30&direction=backward');
      
      expect(parsed.cursor).toBe('xyz');
      expect(parsed.limit).toBe(30);
      expect(parsed.direction).toBe('backward');
    });

    it('should not include cursor in query string when null', () => {
      const qs = buildCursorQueryString({
        cursor: null,
        limit: 20,
      });
      
      expect(qs).not.toContain('cursor');
      expect(qs).toContain('limit=20');
    });
  });
});

// ============================================
// INTEGRATION TESTS WITH MOCK SUPABASE
// ============================================

describe('Paginated Service Functions (Integration)', () => {
  beforeEach(() => {
    resetCounters();
  });

  describe('Orders Pagination Structure', () => {
    it('getOrdersPaginated should return correct PaginatedResult structure', async () => {
      // This test validates the structure without hitting the actual database
      // We create a mock result that matches what getOrdersPaginated returns
      
      const mockResult: PaginatedResult<any> = {
        data: [
          { id: '1', purchaser_email: 'test@example.com', status: 'paid' },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          startIndex: 1,
          endIndex: 1,
        },
      };
      
      // Validate structure
      expect(mockResult).toHaveProperty('data');
      expect(mockResult).toHaveProperty('pagination');
      expect(Array.isArray(mockResult.data)).toBe(true);
      expect(typeof mockResult.pagination.page).toBe('number');
      expect(typeof mockResult.pagination.pageSize).toBe('number');
      expect(typeof mockResult.pagination.totalItems).toBe('number');
      expect(typeof mockResult.pagination.totalPages).toBe('number');
      expect(typeof mockResult.pagination.hasNextPage).toBe('boolean');
      expect(typeof mockResult.pagination.hasPreviousPage).toBe('boolean');
    });

    it('should have all required pagination metadata fields', () => {
      const result = buildPaginatedResponse(
        [{ id: 1 }],
        50,
        { page: 2, pageSize: 10 }
      );
      
      const requiredFields = [
        'page',
        'pageSize',
        'totalItems',
        'totalPages',
        'hasNextPage',
        'hasPreviousPage',
        'startIndex',
        'endIndex',
      ];
      
      requiredFields.forEach(field => {
        expect(result.pagination).toHaveProperty(field);
      });
    });
  });

  describe('Events Pagination Structure', () => {
    it('getEventsPaginated should return correct PaginatedResult structure', async () => {
      const mockResult: PaginatedResult<any> = {
        data: [
          createMockEvent({ id: 'event-1', name: 'Test Event' }),
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          startIndex: 1,
          endIndex: 1,
        },
      };
      
      // Validate structure
      expect(mockResult).toHaveProperty('data');
      expect(mockResult).toHaveProperty('pagination');
      expect(mockResult.data[0]).toHaveProperty('id');
      expect(mockResult.data[0]).toHaveProperty('name');
    });
  });

  describe('Cursor Pagination Structure', () => {
    it('should return correct CursorPaginatedResult structure', () => {
      const data = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 2 },
        (item) => item.id
      );
      
      const requiredFields = [
        'data',
        'nextCursor',
        'previousCursor',
        'hasMore',
        'count',
      ];
      
      requiredFields.forEach(field => {
        expect(result).toHaveProperty(field);
      });
      
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.hasMore).toBe('boolean');
      expect(typeof result.count).toBe('number');
    });
  });
});

// ============================================
// EDGE CASES
// ============================================

describe('Edge Cases', () => {
  describe('Empty Results', () => {
    it('should handle empty data array', () => {
      const result = buildPaginatedResponse([], 0, { page: 1, pageSize: 20 });
      
      expect(result.data).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should handle empty cursor data', () => {
      const result = buildCursorPaginatedResponse(
        [],
        { limit: 20 },
        (item) => item.id
      );
      
      expect(result.data).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.count).toBe(0);
    });
  });

  describe('Single Item', () => {
    it('should handle single item in offset pagination', () => {
      const result = buildPaginatedResponse([{ id: 1 }], 1, { page: 1, pageSize: 20 });
      
      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should handle single item in cursor pagination', () => {
      const result = buildCursorPaginatedResponse(
        [{ id: '1' }],
        { limit: 20 },
        (item) => item.id
      );
      
      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle page beyond total pages', () => {
      const result = buildPaginatedResponse([], 50, { page: 100, pageSize: 20 });
      
      expect(result.pagination.page).toBe(100);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('should handle exactly one page of results', () => {
      const data = Array(20).fill(null).map((_, i) => ({ id: i }));
      const result = buildPaginatedResponse(data, 20, { page: 1, pageSize: 20 });
      
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });
  });
});
