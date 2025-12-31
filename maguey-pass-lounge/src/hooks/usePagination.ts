/**
 * usePagination Hook
 * 
 * A React hook for managing paginated data fetching with support for:
 * - Offset-based pagination (traditional page numbers)
 * - Cursor-based pagination (infinite scroll)
 * - Loading states
 * - Error handling
 * - Automatic refetch on options change
 * 
 * @example Offset-based pagination
 * ```tsx
 * const { 
 *   data, 
 *   pagination, 
 *   isLoading, 
 *   goToPage, 
 *   nextPage, 
 *   prevPage 
 * } = usePagination(
 *   (options) => getOrdersPaginated(options, filters),
 *   { pageSize: 20 }
 * );
 * ```
 * 
 * @example Cursor-based pagination (infinite scroll)
 * ```tsx
 * const { 
 *   data, 
 *   hasMore, 
 *   loadMore, 
 *   isLoading 
 * } = useCursorPagination(
 *   (options) => getOrdersCursor(options, filters),
 *   { limit: 20 }
 * );
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  PaginationOptions, 
  PaginatedResult, 
  PaginationMeta,
  CursorPaginationOptions,
  CursorPaginatedResult,
} from '@/lib/pagination';
import { 
  normalizePaginationOptions, 
  normalizeCursorOptions,
  getPageNumbers,
  DEFAULT_PAGE_SIZE,
} from '@/lib/pagination';

// ============================================
// TYPES
// ============================================

/**
 * Fetch function type for offset-based pagination
 */
export type PaginatedFetchFn<T> = (
  options: PaginationOptions
) => Promise<PaginatedResult<T>>;

/**
 * Fetch function type for cursor-based pagination
 */
export type CursorFetchFn<T> = (
  options: CursorPaginationOptions
) => Promise<CursorPaginatedResult<T>>;

/**
 * Options for the usePagination hook
 */
export interface UsePaginationOptions {
  /** Initial page number (1-indexed) */
  initialPage?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Column to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
  /** Dependencies that trigger refetch when changed */
  deps?: unknown[];
}

/**
 * Return type for usePagination hook
 */
export interface UsePaginationReturn<T> {
  /** Current page data */
  data: T[];
  /** Pagination metadata */
  pagination: PaginationMeta | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether initial load is in progress */
  isInitialLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Go to a specific page */
  goToPage: (page: number) => void;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  prevPage: () => void;
  /** Go to first page */
  firstPage: () => void;
  /** Go to last page */
  lastPage: () => void;
  /** Refresh current page */
  refresh: () => void;
  /** Update sort options */
  setSort: (sortBy: string, sortOrder?: 'asc' | 'desc') => void;
  /** Update page size */
  setPageSize: (size: number) => void;
  /** Current pagination options */
  options: Required<PaginationOptions>;
  /** Page numbers for pagination UI (includes -1 for ellipsis) */
  pageNumbers: number[];
}

/**
 * Options for useCursorPagination hook
 */
export interface UseCursorPaginationOptions {
  /** Number of items to fetch per request */
  limit?: number;
  /** Column to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
  /** Dependencies that trigger refetch when changed */
  deps?: unknown[];
}

/**
 * Return type for useCursorPagination hook
 */
export interface UseCursorPaginationReturn<T> {
  /** All loaded data (accumulated) */
  data: T[];
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Load more items */
  loadMore: () => Promise<void>;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether initial load is in progress */
  isInitialLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Reset and reload from beginning */
  reset: () => void;
  /** Refresh all data */
  refresh: () => void;
  /** Current cursor */
  cursor: string | null;
  /** Total items loaded */
  totalLoaded: number;
}

// ============================================
// OFFSET-BASED PAGINATION HOOK
// ============================================

/**
 * Hook for offset-based (page number) pagination
 * 
 * @param fetchFn - Function that fetches paginated data
 * @param options - Pagination options
 * @returns Pagination state and controls
 * 
 * @example
 * ```tsx
 * function OrderList() {
 *   const { 
 *     data: orders, 
 *     pagination, 
 *     isLoading,
 *     goToPage,
 *     nextPage,
 *     prevPage,
 *     pageNumbers,
 *   } = usePagination(
 *     (opts) => getOrdersPaginated(opts, { status: 'paid' }),
 *     { pageSize: 20, sortBy: 'created_at', sortOrder: 'desc' }
 *   );
 * 
 *   if (isLoading) return <Spinner />;
 * 
 *   return (
 *     <>
 *       <OrderTable orders={orders} />
 *       <Pagination
 *         currentPage={pagination?.page ?? 1}
 *         totalPages={pagination?.totalPages ?? 1}
 *         onPageChange={goToPage}
 *         pageNumbers={pageNumbers}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function usePagination<T>(
  fetchFn: PaginatedFetchFn<T>,
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const {
    initialPage = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy = 'created_at',
    sortOrder = 'desc',
    fetchOnMount = true,
    deps = [],
  } = options;

  // State
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [paginationOptions, setPaginationOptions] = useState<Required<PaginationOptions>>({
    page: initialPage,
    pageSize,
    sortBy,
    sortOrder,
  });

  // Track if mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const fetchCountRef = useRef(0);

  // Fetch data
  const fetchData = useCallback(async (opts: PaginationOptions) => {
    const fetchId = ++fetchCountRef.current;
    
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFn(opts);
      
      // Only update state if this is the latest fetch and component is mounted
      if (fetchId === fetchCountRef.current && isMountedRef.current) {
        setData(result.data);
        setPagination(result.pagination);
        setIsInitialLoading(false);
      }
    } catch (err) {
      if (fetchId === fetchCountRef.current && isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsInitialLoading(false);
      }
    } finally {
      if (fetchId === fetchCountRef.current && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchFn]);

  // Initial fetch and refetch on deps change
  useEffect(() => {
    if (fetchOnMount) {
      fetchData(paginationOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, ...deps]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Navigation functions
  const goToPage = useCallback((page: number) => {
    const newOptions = { ...paginationOptions, page };
    setPaginationOptions(newOptions);
    fetchData(newOptions);
  }, [paginationOptions, fetchData]);

  const nextPage = useCallback(() => {
    if (pagination && pagination.hasNextPage) {
      goToPage(pagination.page + 1);
    }
  }, [pagination, goToPage]);

  const prevPage = useCallback(() => {
    if (pagination && pagination.hasPreviousPage) {
      goToPage(pagination.page - 1);
    }
  }, [pagination, goToPage]);

  const firstPage = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const lastPage = useCallback(() => {
    if (pagination) {
      goToPage(pagination.totalPages);
    }
  }, [pagination, goToPage]);

  const refresh = useCallback(() => {
    fetchData(paginationOptions);
  }, [paginationOptions, fetchData]);

  const setSort = useCallback((newSortBy: string, newSortOrder: 'asc' | 'desc' = 'asc') => {
    const newOptions = { 
      ...paginationOptions, 
      sortBy: newSortBy, 
      sortOrder: newSortOrder,
      page: 1, // Reset to first page on sort change
    };
    setPaginationOptions(newOptions);
    fetchData(newOptions);
  }, [paginationOptions, fetchData]);

  const setPageSize = useCallback((size: number) => {
    const newOptions = { 
      ...paginationOptions, 
      pageSize: size,
      page: 1, // Reset to first page on page size change
    };
    setPaginationOptions(newOptions);
    fetchData(newOptions);
  }, [paginationOptions, fetchData]);

  // Generate page numbers for UI
  const pageNumbers = pagination 
    ? getPageNumbers(pagination.page, pagination.totalPages)
    : [];

  return {
    data,
    pagination,
    isLoading,
    isInitialLoading,
    error,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    refresh,
    setSort,
    setPageSize,
    options: paginationOptions,
    pageNumbers,
  };
}

// ============================================
// CURSOR-BASED PAGINATION HOOK
// ============================================

/**
 * Hook for cursor-based (infinite scroll) pagination
 * 
 * @param fetchFn - Function that fetches cursor-paginated data
 * @param options - Pagination options
 * @returns Pagination state and controls
 * 
 * @example
 * ```tsx
 * function OrderFeed() {
 *   const { 
 *     data: orders, 
 *     hasMore,
 *     loadMore,
 *     isLoading,
 *     isInitialLoading,
 *   } = useCursorPagination(
 *     (opts) => getOrdersCursor(opts, { status: 'paid' }),
 *     { limit: 20 }
 *   );
 * 
 *   if (isInitialLoading) return <Spinner />;
 * 
 *   return (
 *     <InfiniteScroll
 *       dataLength={orders.length}
 *       next={loadMore}
 *       hasMore={hasMore}
 *       loader={<Spinner />}
 *     >
 *       {orders.map(order => <OrderCard key={order.id} order={order} />)}
 *     </InfiniteScroll>
 *   );
 * }
 * ```
 */
export function useCursorPagination<T>(
  fetchFn: CursorFetchFn<T>,
  options: UseCursorPaginationOptions = {}
): UseCursorPaginationReturn<T> {
  const {
    limit = DEFAULT_PAGE_SIZE,
    sortBy = 'created_at',
    sortOrder = 'desc',
    fetchOnMount = true,
    deps = [],
  } = options;

  // State
  const [data, setData] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track if mounted
  const isMountedRef = useRef(true);
  const fetchCountRef = useRef(0);

  // Fetch initial data
  const fetchInitial = useCallback(async () => {
    const fetchId = ++fetchCountRef.current;
    
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFn({
        limit,
        sortBy,
        sortOrder,
        cursor: null,
        direction: 'forward',
      });
      
      if (fetchId === fetchCountRef.current && isMountedRef.current) {
        setData(result.data);
        setCursor(result.nextCursor);
        setHasMore(result.hasMore);
        setIsInitialLoading(false);
      }
    } catch (err) {
      if (fetchId === fetchCountRef.current && isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsInitialLoading(false);
      }
    } finally {
      if (fetchId === fetchCountRef.current && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchFn, limit, sortBy, sortOrder]);

  // Load more data
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !cursor) return;

    const fetchId = ++fetchCountRef.current;
    
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFn({
        limit,
        sortBy,
        sortOrder,
        cursor,
        direction: 'forward',
      });
      
      if (fetchId === fetchCountRef.current && isMountedRef.current) {
        setData(prev => [...prev, ...result.data]);
        setCursor(result.nextCursor);
        setHasMore(result.hasMore);
      }
    } catch (err) {
      if (fetchId === fetchCountRef.current && isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (fetchId === fetchCountRef.current && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchFn, limit, sortBy, sortOrder, cursor, hasMore, isLoading]);

  // Reset and reload
  const reset = useCallback(() => {
    setData([]);
    setCursor(null);
    setHasMore(true);
    setIsInitialLoading(true);
    fetchInitial();
  }, [fetchInitial]);

  // Refresh all data (reload from beginning)
  const refresh = useCallback(() => {
    reset();
  }, [reset]);

  // Initial fetch
  useEffect(() => {
    if (fetchOnMount) {
      fetchInitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInitial, ...deps]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    hasMore,
    loadMore,
    isLoading,
    isInitialLoading,
    error,
    reset,
    refresh,
    cursor,
    totalLoaded: data.length,
  };
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Hook to manage pagination state in URL query params
 * Useful for shareable/bookmarkable paginated pages
 */
export function usePaginationParams(): {
  options: PaginationOptions;
  setOptions: (options: PaginationOptions) => void;
  toQueryString: () => string;
} {
  const [searchParams, setSearchParams] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });

  const options: PaginationOptions = {
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
    pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined,
    sortBy: searchParams.get('sortBy') ?? undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') ?? undefined,
  };

  const setOptions = useCallback((newOptions: PaginationOptions) => {
    const params = new URLSearchParams();
    
    if (newOptions.page !== undefined) params.set('page', String(newOptions.page));
    if (newOptions.pageSize !== undefined) params.set('pageSize', String(newOptions.pageSize));
    if (newOptions.sortBy !== undefined) params.set('sortBy', newOptions.sortBy);
    if (newOptions.sortOrder !== undefined) params.set('sortOrder', newOptions.sortOrder);
    
    setSearchParams(params);
    
    // Update URL without reload
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({}, '', newUrl);
    }
  }, []);

  const toQueryString = useCallback(() => {
    return searchParams.toString();
  }, [searchParams]);

  return { options, setOptions, toQueryString };
}

// Default export
export default usePagination;
