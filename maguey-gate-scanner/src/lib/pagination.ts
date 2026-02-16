/**
 * Pagination Utilities
 * 
 * Provides reusable pagination helpers for listing endpoints to handle
 * large datasets efficiently. Supports both offset-based and cursor-based
 * pagination strategies.
 * 
 * @example Offset-based pagination
 * ```typescript
 * const result = await getScanLogsPaginated(ticketId, {
 *   page: 1,
 *   pageSize: 20,
 *   sortBy: 'scanned_at',
 *   sortOrder: 'desc',
 * });
 * // result.pagination.totalPages, result.pagination.hasNextPage, etc.
 * ```
 * 
 * @example Cursor-based pagination (infinite scroll / real-time)
 * ```typescript
 * const result = await getRecentScansCursor({
 *   cursor: lastScanId,
 *   limit: 20,
 *   direction: 'forward',
 * });
 * // result.nextCursor for the next page
 * ```
 */

import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

// ============================================
// TYPES - Offset-based Pagination
// ============================================

/**
 * Options for offset-based pagination
 */
export interface PaginationOptions {
  /** Page number (1-indexed). Defaults to 1 */
  page?: number;
  /** Number of items per page. Defaults to 20, max 100 */
  pageSize?: number;
  /** Column to sort by */
  sortBy?: string;
  /** Sort direction. Defaults to 'desc' */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination metadata returned with results
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
  /** Index of first item on current page (1-indexed) */
  startIndex: number;
  /** Index of last item on current page (1-indexed) */
  endIndex: number;
}

/**
 * Paginated result containing data and pagination metadata
 */
export interface PaginatedResult<T> {
  /** Array of items for the current page */
  data: T[];
  /** Pagination metadata */
  pagination: PaginationMeta;
}

// ============================================
// TYPES - Cursor-based Pagination
// ============================================

/**
 * Options for cursor-based pagination (infinite scroll)
 */
export interface CursorPaginationOptions {
  /** Cursor value (usually the ID of the last item) */
  cursor?: string | null;
  /** Number of items to fetch. Defaults to 20, max 100 */
  limit?: number;
  /** Direction to paginate. Defaults to 'forward' */
  direction?: 'forward' | 'backward';
  /** Column to use as cursor. Defaults to 'id' */
  cursorColumn?: string;
  /** Sort column. Defaults to 'created_at' */
  sortBy?: string;
  /** Sort direction. Defaults to 'desc' */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Cursor-based pagination result
 */
export interface CursorPaginatedResult<T> {
  /** Array of items */
  data: T[];
  /** Cursor for fetching the next page (null if no more items) */
  nextCursor: string | null;
  /** Cursor for fetching the previous page (null if at start) */
  previousCursor: string | null;
  /** Whether there are more items in the forward direction */
  hasMore: boolean;
  /** Number of items returned */
  count: number;
}

// ============================================
// CONSTANTS
// ============================================

/** Default page size */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum allowed page size */
export const MAX_PAGE_SIZE = 100;

/** Minimum page number */
export const MIN_PAGE = 1;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Normalize and validate pagination options
 */
export function normalizePaginationOptions(options: PaginationOptions = {}): Required<PaginationOptions> {
  const page = Math.max(MIN_PAGE, Math.floor(options.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE)));
  const sortBy = options.sortBy ?? 'created_at';
  const sortOrder = options.sortOrder ?? 'desc';
  
  return { page, pageSize, sortBy, sortOrder };
}

/**
 * Normalize and validate cursor pagination options
 */
export function normalizeCursorOptions(options: CursorPaginationOptions = {}): Required<CursorPaginationOptions> {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(options.limit ?? DEFAULT_PAGE_SIZE)));
  const cursor = options.cursor ?? null;
  const direction = options.direction ?? 'forward';
  const cursorColumn = options.cursorColumn ?? 'id';
  const sortBy = options.sortBy ?? 'created_at';
  const sortOrder = options.sortOrder ?? 'desc';
  
  return { limit, cursor, direction, cursorColumn, sortBy, sortOrder };
}

// ============================================
// OFFSET-BASED PAGINATION
// ============================================

/**
 * Calculate pagination values from options
 */
export function calculatePagination(
  totalCount: number,
  options: PaginationOptions = {}
): { offset: number; limit: number; meta: Omit<PaginationMeta, 'startIndex' | 'endIndex'> } {
  const { page, pageSize } = normalizePaginationOptions(options);
  
  const totalPages = Math.ceil(totalCount / pageSize);
  const offset = (page - 1) * pageSize;
  
  return {
    offset,
    limit: pageSize,
    meta: {
      page,
      pageSize,
      totalItems: totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Apply pagination to a Supabase query
 * 
 * @param query - Supabase query builder
 * @param options - Pagination options
 * @returns Modified query with range and order applied
 * 
 * @example
 * ```typescript
 * let query = supabase.from('scan_logs').select('*');
 * query = applyPagination(query, { page: 2, pageSize: 10 });
 * const { data } = await query;
 * ```
 */
export function applyPagination<T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  options: PaginationOptions = {}
): T {
  const { page, pageSize, sortBy, sortOrder } = normalizePaginationOptions(options);
  
  const offset = (page - 1) * pageSize;
  const end = offset + pageSize - 1;
  
  // Apply sorting
  let result = query.order(sortBy, { ascending: sortOrder === 'asc' });
  
  // Apply range (offset pagination)
  result = result.range(offset, end);
  
  return result as T;
}

/**
 * Build a paginated response from data and total count
 * 
 * @param data - Array of items for the current page
 * @param totalCount - Total number of items across all pages
 * @param options - Pagination options used for the query
 * @returns Paginated result with metadata
 * 
 * @example
 * ```typescript
 * const { data, count } = await query;
 * const result = buildPaginatedResponse(data, count, { page: 1, pageSize: 20 });
 * // result.pagination.totalPages, etc.
 * ```
 */
export function buildPaginatedResponse<T>(
  data: T[],
  totalCount: number,
  options: PaginationOptions = {}
): PaginatedResult<T> {
  const { page, pageSize } = normalizePaginationOptions(options);
  const { meta } = calculatePagination(totalCount, options);
  
  // Calculate start/end indices (1-indexed for display)
  const startIndex = data.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = data.length > 0 ? startIndex + data.length - 1 : 0;
  
  return {
    data,
    pagination: {
      ...meta,
      startIndex,
      endIndex,
    },
  };
}

// ============================================
// CURSOR-BASED PAGINATION
// ============================================

/**
 * Apply cursor-based pagination to a Supabase query
 * 
 * @param query - Supabase query builder
 * @param options - Cursor pagination options
 * @returns Modified query with cursor filtering applied
 * 
 * @example
 * ```typescript
 * let query = supabase.from('scan_logs').select('*');
 * query = applyCursorPagination(query, { 
 *   cursor: 'abc123', 
 *   limit: 20,
 *   direction: 'forward' 
 * });
 * const { data } = await query;
 * ```
 */
export function applyCursorPagination<T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  options: CursorPaginationOptions = {}
): T {
  const { limit, cursor, direction, cursorColumn, sortBy, sortOrder } = normalizeCursorOptions(options);
  
  // Fetch one extra item to determine if there are more
  const fetchLimit = limit + 1;
  
  // Apply sorting
  let result = query.order(sortBy, { ascending: sortOrder === 'asc' });
  
  // If we have a second sort column (cursorColumn), add it
  if (cursorColumn !== sortBy) {
    result = result.order(cursorColumn, { ascending: sortOrder === 'asc' });
  }
  
  // Apply cursor filter if provided
  if (cursor) {
    if (direction === 'forward') {
      // For forward pagination with desc order, get items "less than" cursor
      if (sortOrder === 'desc') {
        result = result.lt(cursorColumn, cursor);
      } else {
        result = result.gt(cursorColumn, cursor);
      }
    } else {
      // For backward pagination, reverse the comparison
      if (sortOrder === 'desc') {
        result = result.gt(cursorColumn, cursor);
      } else {
        result = result.lt(cursorColumn, cursor);
      }
    }
  }
  
  // Apply limit
  result = result.limit(fetchLimit);
  
  return result as T;
}

/**
 * Build a cursor-paginated response from data
 * 
 * @param data - Array of items (should include one extra item to check for more)
 * @param options - Cursor pagination options used for the query
 * @param cursorExtractor - Function to extract cursor value from an item
 * @returns Cursor-paginated result with next/previous cursors
 * 
 * @example
 * ```typescript
 * const { data } = await query;
 * const result = buildCursorPaginatedResponse(
 *   data, 
 *   { limit: 20 },
 *   (item) => item.id
 * );
 * // result.nextCursor for infinite scroll
 * ```
 */
export function buildCursorPaginatedResponse<T>(
  data: T[],
  options: CursorPaginationOptions = {},
  cursorExtractor: (item: T) => string
): CursorPaginatedResult<T> {
  const { limit, cursor, direction } = normalizeCursorOptions(options);
  
  // Check if we got more items than requested (indicates more pages)
  const hasMore = data.length > limit;
  
  // Trim to requested limit
  const items = hasMore ? data.slice(0, limit) : data;
  
  // For backward pagination, reverse the items
  const finalItems = direction === 'backward' ? items.reverse() : items;
  
  // Extract cursors
  const firstItem = finalItems[0];
  const lastItem = finalItems[finalItems.length - 1];
  
  const nextCursor = hasMore && lastItem ? cursorExtractor(lastItem) : null;
  const previousCursor = cursor && firstItem ? cursorExtractor(firstItem) : null;
  
  return {
    data: finalItems,
    nextCursor,
    previousCursor,
    hasMore,
    count: finalItems.length,
  };
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Type for functions that fetch paginated data
 */
export type PaginatedFetcher<T, P = void> = (
  params: P,
  options: PaginationOptions
) => Promise<PaginatedResult<T>>;

/**
 * Type for functions that fetch cursor-paginated data
 */
export type CursorPaginatedFetcher<T, P = void> = (
  params: P,
  options: CursorPaginationOptions
) => Promise<CursorPaginatedResult<T>>;

// ============================================
// QUERY STRING HELPERS
// ============================================

/**
 * Parse pagination options from URL query parameters
 * 
 * @param searchParams - URLSearchParams or query string
 * @returns Pagination options
 * 
 * @example
 * ```typescript
 * // From URL: ?page=2&pageSize=10&sortBy=scanned_at&sortOrder=desc
 * const options = parsePaginationFromQuery(window.location.search);
 * ```
 */
export function parsePaginationFromQuery(
  searchParams: URLSearchParams | string
): PaginationOptions {
  const params = typeof searchParams === 'string' 
    ? new URLSearchParams(searchParams) 
    : searchParams;
  
  const page = params.get('page');
  const pageSize = params.get('pageSize') ?? params.get('limit');
  const sortBy = params.get('sortBy') ?? params.get('sort');
  const sortOrder = params.get('sortOrder') ?? params.get('order');
  
  return {
    page: page ? parseInt(page, 10) : undefined,
    pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    sortBy: sortBy ?? undefined,
    sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
  };
}

/**
 * Parse cursor pagination options from URL query parameters
 */
export function parseCursorFromQuery(
  searchParams: URLSearchParams | string
): CursorPaginationOptions {
  const params = typeof searchParams === 'string' 
    ? new URLSearchParams(searchParams) 
    : searchParams;
  
  const cursor = params.get('cursor');
  const limit = params.get('limit');
  const direction = params.get('direction');
  
  return {
    cursor: cursor ?? undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    direction: direction === 'forward' || direction === 'backward' ? direction : undefined,
  };
}

/**
 * Build query string from pagination options
 * 
 * @param options - Pagination options
 * @returns Query string (without leading ?)
 * 
 * @example
 * ```typescript
 * const qs = buildPaginationQueryString({ page: 2, pageSize: 10 });
 * // "page=2&pageSize=10"
 * ```
 */
export function buildPaginationQueryString(options: PaginationOptions): string {
  const params = new URLSearchParams();
  
  if (options.page !== undefined) params.set('page', String(options.page));
  if (options.pageSize !== undefined) params.set('pageSize', String(options.pageSize));
  if (options.sortBy !== undefined) params.set('sortBy', options.sortBy);
  if (options.sortOrder !== undefined) params.set('sortOrder', options.sortOrder);
  
  return params.toString();
}

/**
 * Build query string from cursor pagination options
 */
export function buildCursorQueryString(options: CursorPaginationOptions): string {
  const params = new URLSearchParams();
  
  if (options.cursor !== undefined && options.cursor !== null) {
    params.set('cursor', options.cursor);
  }
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.direction !== undefined) params.set('direction', options.direction);
  
  return params.toString();
}

// ============================================
// PAGE NUMBER HELPERS
// ============================================

/**
 * Generate array of page numbers for pagination UI
 * Shows first, last, and pages around current page
 * 
 * @param currentPage - Current page number
 * @param totalPages - Total number of pages
 * @param surroundingPages - Number of pages to show around current page
 * @returns Array of page numbers and ellipsis markers (-1)
 * 
 * @example
 * ```typescript
 * getPageNumbers(5, 10, 2);
 * // [1, -1, 3, 4, 5, 6, 7, -1, 10]
 * // -1 represents "..."
 * ```
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  surroundingPages: number = 2
): number[] {
  if (totalPages <= 0) return [];
  if (totalPages === 1) return [1];
  
  const pages: number[] = [];
  const addPage = (page: number) => {
    if (page >= 1 && page <= totalPages && !pages.includes(page)) {
      pages.push(page);
    }
  };
  
  // Always show first page
  addPage(1);
  
  // Calculate range around current page
  const rangeStart = Math.max(2, currentPage - surroundingPages);
  const rangeEnd = Math.min(totalPages - 1, currentPage + surroundingPages);
  
  // Add ellipsis if there's a gap after first page
  if (rangeStart > 2) {
    pages.push(-1); // -1 represents ellipsis
  }
  
  // Add pages in range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    addPage(i);
  }
  
  // Add ellipsis if there's a gap before last page
  if (rangeEnd < totalPages - 1) {
    pages.push(-1);
  }
  
  // Always show last page
  addPage(totalPages);
  
  return pages;
}

// ============================================
// EXPORTS
// ============================================

export const pagination = {
  // Constants
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE,
  
  // Offset pagination
  normalize: normalizePaginationOptions,
  calculate: calculatePagination,
  apply: applyPagination,
  buildResponse: buildPaginatedResponse,
  
  // Cursor pagination
  normalizeCursor: normalizeCursorOptions,
  applyCursor: applyCursorPagination,
  buildCursorResponse: buildCursorPaginatedResponse,
  
  // Query string helpers
  parseFromQuery: parsePaginationFromQuery,
  parseCursorFromQuery,
  toQueryString: buildPaginationQueryString,
  cursorToQueryString: buildCursorQueryString,
  
  // UI helpers
  getPageNumbers,
};

export default pagination;
