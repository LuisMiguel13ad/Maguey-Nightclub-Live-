import { supabase } from "../supabase";
import { createLogger } from "../logger";
import { trackDbQuery, startTimer } from "../monitoring";
import { DatabaseError } from "../errors";
import {
  applyPagination,
  buildPaginatedResponse,
  applyCursorPagination,
  buildCursorPaginatedResponse,
  type PaginationOptions,
  type PaginatedResult,
  type CursorPaginationOptions,
  type CursorPaginatedResult,
} from "../pagination";
import type {
  OrdersQueryOptions,
  AdminOrderRow,
  PaginatedOrderRow,
  OrderFilters,
  TicketsQueryOptions,
  AdminTicketRow,
  SupabaseTypedClient,
} from "./types";

// Create module-scoped logger
const logger = createLogger({ module: 'orders/queries' });

export async function getOrders(
  options: OrdersQueryOptions = {},
  client: SupabaseTypedClient = supabase
): Promise<AdminOrderRow[]> {
  let query = client
    .from("orders")
    .select("id, purchaser_email, purchaser_name, total, status, created_at")
    .order("created_at", { ascending: false });

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  if (typeof options.limit === "number") {
    query = query.limit(options.limit);
  }

  if (typeof options.offset === "number" && typeof options.limit === "number") {
    query = query.range(
      options.offset,
      options.offset + options.limit - 1
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ============================================
// PAGINATED ORDER QUERIES
// ============================================

/**
 * Get orders with pagination support
 *
 * @param options - Pagination options (page, pageSize, sortBy, sortOrder)
 * @param filters - Filter criteria
 * @param client - Optional Supabase client override
 * @returns Paginated result with orders and metadata
 *
 * @example
 * ```typescript
 * const result = await getOrdersPaginated(
 *   { page: 1, pageSize: 20, sortBy: 'created_at', sortOrder: 'desc' },
 *   { status: 'paid', eventId: 'event-123' }
 * );
 * console.log(result.pagination.totalPages);
 * ```
 */
export async function getOrdersPaginated(
  options: PaginationOptions = {},
  filters: OrderFilters = {},
  client: SupabaseTypedClient = supabase
): Promise<PaginatedResult<PaginatedOrderRow>> {
  const timer = startTimer();
  const queryLogger = logger.child({ operation: 'getOrdersPaginated', filters });

  // Build base query with count
  let countQuery = client
    .from('orders')
    .select('id', { count: 'exact', head: true });

  let dataQuery = client
    .from('orders')
    .select(`
      id,
      purchaser_email,
      purchaser_name,
      total,
      status,
      created_at,
      event_id,
      events (
        id,
        name,
        event_date
      )
    `);

  // Apply filters to both queries
  if (filters.status && filters.status !== 'all') {
    countQuery = countQuery.eq('status', filters.status);
    dataQuery = dataQuery.eq('status', filters.status);
  }

  if (filters.eventId) {
    countQuery = countQuery.eq('event_id', filters.eventId);
    dataQuery = dataQuery.eq('event_id', filters.eventId);
  }

  if (filters.email) {
    countQuery = countQuery.ilike('purchaser_email', `%${filters.email}%`);
    dataQuery = dataQuery.ilike('purchaser_email', `%${filters.email}%`);
  }

  if (filters.dateFrom) {
    countQuery = countQuery.gte('created_at', filters.dateFrom);
    dataQuery = dataQuery.gte('created_at', filters.dateFrom);
  }

  if (filters.dateTo) {
    countQuery = countQuery.lte('created_at', filters.dateTo);
    dataQuery = dataQuery.lte('created_at', filters.dateTo);
  }

  // Get total count
  const { count, error: countError } = await countQuery;

  if (countError) {
    queryLogger.error('Failed to get order count', { error: countError.message });
    throw new DatabaseError('getOrdersPaginated', countError);
  }

  const totalCount = count ?? 0;

  // Apply pagination to data query
  dataQuery = applyPagination(dataQuery, {
    ...options,
    sortBy: options.sortBy ?? 'created_at',
  });

  const { data, error: dataError } = await dataQuery;

  trackDbQuery('select', timer(), !dataError, 'orders');

  if (dataError) {
    queryLogger.error('Failed to get orders', { error: dataError.message });
    throw new DatabaseError('getOrdersPaginated', dataError);
  }

  // Transform data to match interface
  const orders: PaginatedOrderRow[] = (data ?? []).map((row: any) => ({
    id: row.id,
    purchaser_email: row.purchaser_email,
    purchaser_name: row.purchaser_name,
    total: row.total,
    status: row.status,
    created_at: row.created_at,
    event_id: row.event_id,
    event: row.events,
  }));

  queryLogger.debug('Orders fetched', {
    count: orders.length,
    totalCount,
    page: options.page,
  });

  return buildPaginatedResponse(orders, totalCount, options);
}

/**
 * Get orders for a specific event with pagination
 *
 * @param eventId - Event ID to filter by
 * @param options - Pagination options
 * @param filters - Additional filters (status, email, etc.)
 * @param client - Optional Supabase client override
 * @returns Paginated result with orders
 */
export async function getEventOrdersPaginated(
  eventId: string,
  options: PaginationOptions = {},
  filters: Omit<OrderFilters, 'eventId'> = {},
  client: SupabaseTypedClient = supabase
): Promise<PaginatedResult<PaginatedOrderRow>> {
  return getOrdersPaginated(options, { ...filters, eventId }, client);
}

/**
 * Get orders for a specific user (by email) with pagination
 *
 * @param email - User's email address
 * @param options - Pagination options
 * @param client - Optional Supabase client override
 * @returns Paginated result with user's orders
 *
 * @example
 * ```typescript
 * const result = await getUserOrdersPaginated(
 *   'user@example.com',
 *   { page: 1, pageSize: 10 }
 * );
 * ```
 */
export async function getUserOrdersPaginated(
  email: string,
  options: PaginationOptions = {},
  client: SupabaseTypedClient = supabase
): Promise<PaginatedResult<PaginatedOrderRow>> {
  const timer = startTimer();
  const queryLogger = logger.child({ operation: 'getUserOrdersPaginated', email });

  // Get total count for this user
  const { count, error: countError } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('purchaser_email', email);

  if (countError) {
    queryLogger.error('Failed to get user order count', { error: countError.message });
    throw new DatabaseError('getUserOrdersPaginated', countError);
  }

  const totalCount = count ?? 0;

  // Build data query with event info
  let dataQuery = client
    .from('orders')
    .select(`
      id,
      purchaser_email,
      purchaser_name,
      total,
      status,
      created_at,
      event_id,
      events (
        id,
        name,
        event_date
      )
    `)
    .eq('purchaser_email', email);

  // Apply pagination
  dataQuery = applyPagination(dataQuery, {
    ...options,
    sortBy: options.sortBy ?? 'created_at',
  });

  const { data, error: dataError } = await dataQuery;

  trackDbQuery('select', timer(), !dataError, 'orders');

  if (dataError) {
    queryLogger.error('Failed to get user orders', { error: dataError.message });
    throw new DatabaseError('getUserOrdersPaginated', dataError);
  }

  // Transform data
  const orders: PaginatedOrderRow[] = (data ?? []).map((row: any) => ({
    id: row.id,
    purchaser_email: row.purchaser_email,
    purchaser_name: row.purchaser_name,
    total: row.total,
    status: row.status,
    created_at: row.created_at,
    event_id: row.event_id,
    event: row.events,
  }));

  return buildPaginatedResponse(orders, totalCount, options);
}

/**
 * Get orders with cursor-based pagination (for infinite scroll)
 *
 * @param options - Cursor pagination options
 * @param filters - Filter criteria
 * @param client - Optional Supabase client override
 * @returns Cursor-paginated result with orders
 *
 * @example
 * ```typescript
 * // Initial load
 * const first = await getOrdersCursor({ limit: 20 });
 *
 * // Load more
 * const next = await getOrdersCursor({
 *   cursor: first.nextCursor,
 *   limit: 20
 * });
 * ```
 */
export async function getOrdersCursor(
  options: CursorPaginationOptions = {},
  filters: OrderFilters = {},
  client: SupabaseTypedClient = supabase
): Promise<CursorPaginatedResult<PaginatedOrderRow>> {
  const timer = startTimer();
  const queryLogger = logger.child({ operation: 'getOrdersCursor' });

  let query = client
    .from('orders')
    .select(`
      id,
      purchaser_email,
      purchaser_name,
      total,
      status,
      created_at,
      event_id,
      events (
        id,
        name,
        event_date
      )
    `);

  // Apply filters
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.eventId) {
    query = query.eq('event_id', filters.eventId);
  }

  if (filters.email) {
    query = query.ilike('purchaser_email', `%${filters.email}%`);
  }

  // Apply cursor pagination
  query = applyCursorPagination(query, {
    ...options,
    cursorColumn: 'id',
    sortBy: options.sortBy ?? 'created_at',
  });

  const { data, error } = await query;

  trackDbQuery('select', timer(), !error, 'orders');

  if (error) {
    queryLogger.error('Failed to get orders with cursor', { error: error.message });
    throw new DatabaseError('getOrdersCursor', error);
  }

  // Transform data
  const orders: PaginatedOrderRow[] = (data ?? []).map((row: any) => ({
    id: row.id,
    purchaser_email: row.purchaser_email,
    purchaser_name: row.purchaser_name,
    total: row.total,
    status: row.status,
    created_at: row.created_at,
    event_id: row.event_id,
    event: row.events,
  }));

  return buildCursorPaginatedResponse(
    orders,
    options,
    (order) => order.id
  );
}

export async function getTickets(
  options: TicketsQueryOptions = {},
  client: SupabaseTypedClient = supabase
): Promise<AdminTicketRow[]> {
  let query = client
    .from("tickets")
    .select(
      "id, order_id, attendee_name, attendee_email, status, issued_at, scanned_at, qr_token, ticket_type_id, events(name), ticket_types(name)"
    )
    .order("issued_at", { ascending: false });

  if (options.status && options.status !== "all") {
    if (options.status === "scanned") {
      query = query.eq("status", "scanned");
    } else if (options.status === "pending") {
      query = query.neq("status", "scanned").neq("status", "refunded");
    } else if (options.status === "refunded") {
      query = query.eq("status", "refunded");
    }
  }

  if (typeof options.limit === "number") {
    query = query.limit(options.limit);
  }

  if (typeof options.offset === "number" && typeof options.limit === "number") {
    query = query.range(
      options.offset,
      options.offset + options.limit - 1
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
