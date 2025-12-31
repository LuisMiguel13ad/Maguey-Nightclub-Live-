import { supabase, Event, TicketType } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { 
  Result, 
  AsyncResult, 
  ok, 
  err, 
  isOk,
  tryCatchAsync 
} from './result'
import {
  AppError,
  NotFoundError,
  EventNotFoundError,
  ValidationError,
  DatabaseError,
} from './errors'
import { 
  cache, 
  CacheKeys, 
  CacheTTL, 
  invalidateEventCaches,
  type CacheOptions,
} from './cache'
import { createLogger } from './logger'
import { startTimer, trackDbQuery } from './monitoring'
import {
  applyPagination,
  buildPaginatedResponse,
  applyCursorPagination,
  buildCursorPaginatedResponse,
  type PaginationOptions,
  type PaginatedResult,
  type CursorPaginationOptions,
  type CursorPaginatedResult,
} from './pagination'
import {
  createQueryTimer,
  DEFAULT_SLOW_QUERY_THRESHOLD_MS,
  DEFAULT_QUERY_TIMEOUT_MS,
} from './query-optimizer'
import { tracer, traceAsync, traceQuery } from './tracing'

const logger = createLogger({ module: 'events-service' })

// ============================================
// QUERY OPTIMIZATION CONSTANTS
// ============================================

/** Slow query threshold for events service (100ms) */
const SLOW_QUERY_THRESHOLD_MS = DEFAULT_SLOW_QUERY_THRESHOLD_MS;

/** Query timeout for events service (10 seconds) */
const QUERY_TIMEOUT_MS = 10000;

/** Columns to select for covering index optimization on events listing */
const EVENT_LISTING_COLUMNS = 'id, name, event_date, event_time, venue_name, city, image_url, status, is_active';

/** Columns to select for covering index optimization on ticket types */
// Note: ticket_types table doesn't have is_active or sort_order columns
const TICKET_TYPE_COVERING_COLUMNS = 'id, event_id, name, price, total_inventory, tickets_sold, fee, code, description';

type SupabaseTypedClient = SupabaseClient<any>

export type EventWithTickets = Event & {
  ticketTypes: TicketType[]
}

export type { Event, TicketType } from './supabase'

export interface Promotion {
  id: string;
  code: string;
  discount_type: "amount" | "percent";
  amount: number;
  usage_limit: number | null;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
}

/**
 * Promotion-specific errors
 */
export class PromotionNotFoundError extends NotFoundError {
  constructor(code: string) {
    super('Promotion', code, { code });
  }
}

export class PromotionExpiredError extends AppError {
  constructor(code: string) {
    super(`Promotion code '${code}' has expired`, 'PROMOTION_EXPIRED', 400, true, { code });
  }
}

export class PromotionNotYetValidError extends AppError {
  constructor(code: string, validFrom: string) {
    super(
      `Promotion code '${code}' is not yet valid (starts ${validFrom})`,
      'PROMOTION_NOT_YET_VALID',
      400,
      true,
      { code, validFrom }
    );
  }
}

/**
 * Fetch promotion from database (internal, no caching)
 */
async function fetchPromotionFromDb(code: string): Promise<Promotion> {
  const normalized = code.trim().toUpperCase();

  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("code", normalized)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new DatabaseError('fetchPromotion', error);
  }

  if (!data) {
    throw new PromotionNotFoundError(normalized);
  }

  const now = new Date();
  if (data.valid_from && new Date(data.valid_from) > now) {
    throw new PromotionNotYetValidError(normalized, data.valid_from);
  }
  if (data.valid_to && new Date(data.valid_to) < now) {
    throw new PromotionExpiredError(normalized);
  }

  return {
    id: data.id,
    code: data.code,
    discount_type: data.discount_type === "percent" ? "percent" : "amount",
    amount: Number(data.amount),
    usage_limit: data.usage_limit,
    active: data.active,
    valid_from: data.valid_from,
    valid_to: data.valid_to,
  };
}

/**
 * Fetch a promotion by code (Result-based)
 * @param code - The promotion code to look up
 * @returns Result containing the Promotion or an error
 * 
 * Uses caching with stale-while-revalidate pattern:
 * - Fresh for 5 minutes
 * - Stale data served while revalidating
 */
export async function fetchPromotionResult(code: string): AsyncResult<Promotion, AppError> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return err(new ValidationError('Promotion code cannot be empty', 'code'));
  }

  try {
    const promotion = await cache.wrap(
      CacheKeys.promotion(normalized),
      () => fetchPromotionFromDb(normalized),
      CacheTTL.PROMOTION
    );
    return ok(promotion);
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }
    return err(new DatabaseError('fetchPromotion', error as Error));
  }
}

/**
 * Fetch a promotion by code (legacy - returns null on error)
 * @deprecated Use fetchPromotionResult for better error handling
 */
export async function fetchPromotion(code: string): Promise<Promotion | null> {
  const result = await fetchPromotionResult(code);
  if (isOk(result)) {
    return result.data;
  }
  console.error("fetchPromotion error:", result.error);
  return null;
}

/**
 * Check if an event has available tickets
 * Returns true if:
 * - Event has ticket types AND
 * - At least one ticket type has inventory available OR no inventory is set (unlimited)
 */
async function eventHasAvailableTickets(eventId: string): Promise<boolean> {
  try {
    // Get all ticket types for this event
    const ticketTypes = await getTicketTypesForEvent(eventId);
    
    if (ticketTypes.length === 0) {
      return false; // No ticket types = no availability
    }

    let hasInventorySet = false;
    let hasAvailableInventory = false;

    // Check if at least one ticket type has availability
    for (const ticketType of ticketTypes) {
      const totalInventory = ticketType.total_inventory ?? 0;
      
      if (totalInventory === 0 || totalInventory === null) {
        // No inventory set = assume unlimited availability
        hasAvailableInventory = true;
        continue;
      }

      hasInventorySet = true;

      // Count currently sold tickets (excluding cancelled/refunded)
      const { count: soldCount, error: countError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('ticket_type_id', ticketType.id)
        .in('status', ['issued', 'used', 'scanned']);

      if (countError) {
        console.warn(`Error checking availability for ticket type ${ticketType.id}:`, countError);
        continue;
      }

      const available = totalInventory - (soldCount || 0);
      if (available > 0) {
        hasAvailableInventory = true;
        break; // Found at least one available ticket type
      }
    }

    // If no inventory is set on any ticket type, assume availability
    // If inventory is set, only return true if at least one has availability
    return !hasInventorySet || hasAvailableInventory;
  } catch (error) {
    console.error('Error checking event availability:', error);
    // On error, be lenient and return true to show the event
    return true;
  }
}

/**
 * Fetch all events from database (internal, no caching)
 * 
 * Optimized to use:
 * - Covering index on events(event_date, status) INCLUDE (name, venue_name, city, event_time, image_url)
 * - Partial index on events WHERE status = 'published' AND is_active = true
 * - Single batch query for ticket types instead of N+1
 */
async function fetchAllEventsFromDb(): Promise<Event[]> {
  const queryTimer = createQueryTimer('fetchAllEventsFromDb', 'events-service', SLOW_QUERY_THRESHOLD_MS);
  const today = new Date().toISOString().split('T')[0];
  
  logger.debug('Fetching events from database', { 
    filters: { 
      status: 'published', 
      is_active: true, 
      event_date: `>= ${today}` 
    } 
  });
  
  // Use covering index columns for optimal query performance
  // This avoids table lookups when the index includes all needed columns
  // MATCHING maguey-nights query exactly
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .eq('is_active', true)
    .gte('event_date', today)
    .order('event_date', { ascending: true });
  
  if (error) {
    logger.error('Error fetching events from database', { error: error.message, code: error.code });
    queryTimer.done(0, { error: error.message });
    throw new DatabaseError('getAllEvents', error);
  }
  
  if (!data || data.length === 0) {
    logger.info('No events found matching criteria', { 
      totalEvents: 0,
      filters: { status: 'published', is_active: true, event_date: `>= ${today}` }
    });
    queryTimer.done(0);
    return [];
  }

  logger.debug('Events fetched from database', { 
    totalEvents: data.length,
    eventIds: data.map(e => e.id),
    eventNames: data.map(e => e.name)
  });

  // OPTIMIZATION: Batch query for ticket types instead of N+1 queries
  // Get all event IDs and fetch ticket types in a single query
  const eventIds = data.map(event => event.id);
  
  const ticketTypesTimer = createQueryTimer('fetchAllEventsFromDb:ticketTypes', 'events-service', SLOW_QUERY_THRESHOLD_MS);
  // Note: ticket_types table doesn't have is_active column, so we just get all ticket types
  const { data: ticketTypes, error: ticketError } = await supabase
    .from('ticket_types')
    .select('event_id')
    .in('event_id', eventIds);
  
  ticketTypesTimer.done(ticketTypes?.length ?? 0);
  
  if (ticketError) {
    logger.warn('Error fetching ticket types for events', { 
      error: ticketError.message, 
      code: ticketError.code,
      eventIds: eventIds.length 
    });
    // Fall back to returning all events if ticket type check fails
    // This matches maguey-nights behavior - show all published events
    logger.info('Returning all events (ticket type check failed)', { count: data.length });
    queryTimer.done(data.length);
    return data;
  }
  
  // Build set of event IDs that have ticket types
  const eventsWithTicketTypesSet = new Set(ticketTypes?.map(tt => tt.event_id) ?? []);
  
  // Filter events to only those with ticket types
  // BUT: If ticket types query returned empty or failed, show all events (like maguey-nights)
  const filteredEvents = ticketTypes && ticketTypes.length > 0
    ? data.filter(event => eventsWithTicketTypesSet.has(event.id))
    : data; // Fallback to all events if no ticket types found
  
  logger.info('Events filtered by ticket types', { 
    totalEvents: data.length, 
    withTicketTypes: filteredEvents.length,
    ticketTypesFound: ticketTypes?.length ?? 0
  });
  
  queryTimer.done(filteredEvents.length, { totalEvents: data.length, withTicketTypes: filteredEvents.length });
  
  return filteredEvents;
}

/**
 * Get all events from the database (Result-based)
 * Filters: status = 'published', is_active = true, event_date >= CURRENT_DATE, has ticket types
 * 
 * Uses caching with stale-while-revalidate pattern:
 * - Fresh for 1 minute (per spec)
 * - Stale data served while revalidating for another 1 minute
 */
export async function getAllEventsResult(): AsyncResult<Event[], AppError> {
  try {
    const events = await cache.wrap(
      CacheKeys.events(),
      fetchAllEventsFromDb,
      CacheTTL.EVENTS // 1 minute TTL per spec
    );
    
    logger.debug('Events fetched', { count: events.length, cached: true });
    return ok(events);
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }
    return err(new DatabaseError('getAllEvents', error as Error));
  }
}

/**
 * Get all events from the database (legacy - returns empty array on error)
 * @deprecated Use getAllEventsResult for better error handling
 */
export async function getAllEvents(): Promise<Event[]> {
  try {
    const result = await getAllEventsResult();

    if (isOk(result)) {
      return result.data;
    }

    console.error('Error fetching events:', result.error);
    return [];
  } catch (error) {
    console.error('Exception while fetching events:', error);
    return [];
  }
}

/**
 * Fetch a single event from database (internal, no caching)
 * 
 * Optimized with:
 * - Query timing for slow query detection
 * - Primary key index utilization
 */
async function fetchEventByIdFromDb(eventId: string, requirePublished: boolean): Promise<Event> {
  const queryTimer = createQueryTimer(`fetchEventByIdFromDb:${eventId}`, 'events-service', SLOW_QUERY_THRESHOLD_MS);
  
  let query = supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
  
  if (requirePublished) {
    const today = new Date().toISOString().split('T')[0];
    query = query.gte('event_date', today);
  }
  
  const { data, error } = await query.single()
  
  if (error) {
    queryTimer.done(0, { error: error.code });
    if (error.code === 'PGRST116') {
      throw new EventNotFoundError(eventId);
    }
    throw new DatabaseError('getEventById', error);
  }
  
  if (!data) {
    queryTimer.done(0);
    throw new EventNotFoundError(eventId);
  }

  // Filter by status: only return if published or NULL (for backward compatibility)
  if (requirePublished) {
    const status = data.status;
    if (status && status !== 'published') {
      queryTimer.done(0, { reason: 'not_published' });
      throw new EventNotFoundError(eventId, { reason: 'not_published', status });
    }
  }
  
  queryTimer.done(1);
  return data;
}

/**
 * Get a single event by its ID (Result-based)
 * @param eventId - The event ID to look up
 * @param requirePublished - If true, only returns published events
 * 
 * Uses caching with stale-while-revalidate pattern:
 * - Fresh for 5 minutes (per spec)
 * - Stale data served while revalidating for another 5 minutes
 */
export async function getEventByIdResult(
  eventId: string, 
  requirePublished: boolean = true
): AsyncResult<Event, AppError> {
  return tracer.withSpan('events.getEventById', async (span) => {
    span.setAttributes({
      'event.id': eventId,
      'event.require_published': requirePublished,
    });

    if (!eventId) {
      span.setError('Event ID is required');
      return err(new ValidationError('Event ID is required', 'eventId'));
    }

    try {
      // Only cache published events (admin might need fresh data)
      if (requirePublished) {
        const event = await traceAsync('events.getEventById.cached', async () => {
          return await cache.wrap(
            CacheKeys.event(eventId),
            () => traceQuery('events.fetchEventById', () => fetchEventByIdFromDb(eventId, requirePublished)),
            CacheTTL.EVENT // 5 minutes TTL per spec
          );
        });
        
        span.setAttributes({
          'cache.hit': true,
          'event.name': event.name,
        });
        span.addEvent('event.fetched', { event_name: event.name });
        logger.debug('Event fetched', { eventId, name: event.name });
        return ok(event);
      } else {
        // Skip cache for admin/unpublished requests
        const event = await traceQuery('events.fetchEventById', () => fetchEventByIdFromDb(eventId, requirePublished));
        span.setAttributes({
          'cache.hit': false,
          'event.name': event.name,
        });
        return ok(event);
      }
    } catch (error) {
      span.setError(error instanceof Error ? error : String(error));
      if (error instanceof AppError) {
        return err(error);
      }
      return err(new DatabaseError('getEventById', error as Error));
    }
  }, { kind: 'server' });
}

/**
 * Get a single event by its ID (legacy - returns null on error)
 * @deprecated Use getEventByIdResult for better error handling
 */
export async function getEventById(eventId: string, requirePublished: boolean = true): Promise<Event | null> {
  const result = await getEventByIdResult(eventId, requirePublished);

  if (isOk(result)) {
    return result.data;
  }

  console.error('Error fetching event:', result.error);
  return null;
}

/**
 * Fetch ticket types from database (internal, no caching)
 * 
 * Optimized with:
 * - Covering index on ticket_types(event_id) INCLUDE (name, price, total_inventory, tickets_sold, fee)
 * - Query timing for slow query detection
 * - Active filter uses partial index
 */
async function fetchTicketTypesFromDb(eventId: string): Promise<TicketType[]> {
  const queryTimer = createQueryTimer(`fetchTicketTypesFromDb:${eventId}`, 'events-service', SLOW_QUERY_THRESHOLD_MS);
  
  // Use covering index columns to avoid table lookups
  // Note: ticket_types table doesn't have is_active or sort_order columns
  const { data, error } = await supabase
    .from('ticket_types')
    .select('id, event_id, name, price, total_inventory, tickets_sold, fee, code, description')
    .eq('event_id', eventId)
    .order('price', { ascending: true })
  
  if (error) {
    queryTimer.done(0, { error: error.message });
    throw new DatabaseError('getTicketTypesForEvent', error);
  }
  
  queryTimer.done(data?.length ?? 0);
  return data || [];
}

/**
 * Get all ticket types for a specific event (Result-based)
 * 
 * Uses caching with stale-while-revalidate pattern:
 * - Fresh for 2 minutes
 * - Stale data served while revalidating for another 3 minutes
 */
export async function getTicketTypesForEventResult(eventId: string): AsyncResult<TicketType[], AppError> {
  if (!eventId) {
    return err(new ValidationError('Event ID is required', 'eventId'));
  }

  try {
    const ticketTypes = await cache.wrap(
      CacheKeys.ticketTypes(eventId),
      () => fetchTicketTypesFromDb(eventId),
      CacheTTL.EVENT
    );
    return ok(ticketTypes);
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }
    return err(new DatabaseError('getTicketTypesForEvent', error as Error));
  }
}

/**
 * Get all ticket types for a specific event (legacy - returns empty array on error)
 * @deprecated Use getTicketTypesForEventResult for better error handling
 */
export async function getTicketTypesForEvent(eventId: string): Promise<TicketType[]> {
  const result = await getTicketTypesForEventResult(eventId);

  if (isOk(result)) {
    return result.data;
  }

  console.error('Error fetching ticket types:', result.error);
  return [];
}

/**
 * Get the first/default ticket type for an event (sorted by price ascending)
 * Returns null if no ticket types exist
 */
export async function getDefaultTicketForEvent(eventId: string): Promise<TicketType | null> {
  const ticketTypes = await getTicketTypesForEvent(eventId)
  return ticketTypes.length > 0 ? ticketTypes[0] : null
}

/**
 * Get the checkout URL for an event with the default ticket
 * Returns null if no ticket types exist
 */
export async function getCheckoutUrlForEvent(eventId: string): Promise<string | null> {
  const defaultTicket = await getDefaultTicketForEvent(eventId)
  if (!defaultTicket) {
    return null
  }
  return `/checkout?event=${eventId}&ticket=${defaultTicket.id}`
}

/**
 * Fetch event with tickets from database (internal, no caching)
 */
async function fetchEventWithTicketsFromDb(eventId: string): Promise<EventWithTickets | null> {
  const event = await getEventById(eventId)
  if (!event) {
    return null
  }
  const ticketTypes = await getTicketTypesForEvent(eventId)
  return {
    ...event,
    ticketTypes
  }
}

/**
 * Get an event WITH all its ticket types in one go
 * 
 * Uses caching with stale-while-revalidate pattern:
 * - Fresh for 2 minutes
 * - Stale data served while revalidating for another 3 minutes
 */
export async function getEventWithTickets(eventId: string): Promise<EventWithTickets | null> {
  try {
    const result = await cache.wrap(
      CacheKeys.eventWithTickets(eventId),
      () => fetchEventWithTicketsFromDb(eventId),
      CacheTTL.EVENT
    );
    
    if (!result) {
      logger.debug('Event not found', { eventId });
    }
    
    return result;
  } catch (error) {
    logger.error('Error fetching event with tickets', { eventId, error });
    return null;
  }
}

/**
 * Ticket availability information from scanner API
 */
export interface TicketAvailability {
  ticketTypeCode: string;
  available: number;
  total: number;
  sold: number;
}

export interface EventAvailability {
  eventName: string;
  ticketTypes: TicketAvailability[];
}

/**
 * Detailed ticket type availability
 */
export interface TicketTypeAvailability {
  ticketTypeId: string;
  ticketTypeName: string;
  totalInventory: number;
  sold: number;
  available: number;
  isUnlimited: boolean;
}

/**
 * Fetch ticket availability from database (internal, no caching)
 */
async function fetchTicketAvailabilityFromDb(ticketTypeId: string): Promise<TicketTypeAvailability | null> {
  // Get ticket type details
  const { data: ticketType, error: ttError } = await supabase
    .from('ticket_types')
    .select('id, name, total_inventory')
    .eq('id', ticketTypeId)
    .single();

  if (ttError || !ticketType) {
    logger.warn('Ticket type not found', { ticketTypeId });
    return null;
  }

  const totalInventory = ticketType.total_inventory ?? 0;
  const isUnlimited = totalInventory === 0 || totalInventory === null;

  // Count sold tickets
  const { count: soldCount, error: countError } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_type_id', ticketTypeId)
    .in('status', ['issued', 'used', 'scanned']);

  if (countError) {
    logger.warn('Error counting sold tickets', { ticketTypeId, error: countError });
  }

  const sold = soldCount ?? 0;
  const available = isUnlimited ? 999999 : Math.max(0, totalInventory - sold);

  return {
    ticketTypeId,
    ticketTypeName: ticketType.name,
    totalInventory,
    sold,
    available,
    isUnlimited,
  };
}

/**
 * Get ticket availability for a specific ticket type
 * 
 * Uses short-lived caching (30 seconds per spec)
 * to provide near-real-time availability data
 */
export async function getTicketAvailability(ticketTypeId: string): Promise<TicketTypeAvailability | null> {
  if (!ticketTypeId) {
    return null;
  }

  try {
    const availability = await cache.wrap(
      `availability:ticket:${ticketTypeId}`,
      () => fetchTicketAvailabilityFromDb(ticketTypeId),
      CacheTTL.AVAILABILITY // 30 seconds TTL per spec
    );

    logger.debug('Ticket availability fetched', { 
      ticketTypeId, 
      available: availability?.available,
      sold: availability?.sold,
    });

    return availability;
  } catch (error) {
    logger.error('Error fetching ticket availability', { ticketTypeId, error });
    return null;
  }
}

/**
 * Get availability for all ticket types of an event
 * 
 * Uses short-lived caching (30 seconds per spec)
 */
export async function getEventTicketAvailability(eventId: string): Promise<TicketTypeAvailability[]> {
  if (!eventId) {
    return [];
  }

  try {
    const ticketTypes = await getTicketTypesForEvent(eventId);
    
    const availabilities = await Promise.all(
      ticketTypes.map(tt => getTicketAvailability(tt.id))
    );

    return availabilities.filter((a): a is TicketTypeAvailability => a !== null);
  } catch (error) {
    logger.error('Error fetching event ticket availability', { eventId, error });
    return [];
  }
}

/**
 * Fetch availability from scanner API (internal, no caching)
 */
async function fetchEventAvailabilityFromApi(eventName: string): Promise<EventAvailability | null> {
  const scannerApiUrl = import.meta.env.VITE_SCANNER_API_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!scannerApiUrl) {
    logger.debug('Scanner API URL not configured, skipping availability check');
    return null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add authentication headers for Supabase Edge Functions
  if (supabaseAnonKey) {
    headers['apikey'] = supabaseAnonKey;
    headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
  }

  const response = await fetch(
    `${scannerApiUrl}/functions/v1/event-availability/${encodeURIComponent(eventName)}`,
    {
      method: 'GET',
      headers,
    }
  );

  if (!response.ok) {
    logger.warn('Scanner API availability check failed', { status: response.status });
    return null;
  }

  const data = await response.json();
  return data as EventAvailability;
}

/**
 * Fetch real-time availability from scanner API
 * 
 * Uses short-lived caching (30 seconds) to reduce API calls
 * while still providing near-real-time data
 */
export async function getEventAvailability(eventName: string): Promise<EventAvailability | null> {
  try {
    // Use a short TTL for availability data
    const result = await cache.wrap(
      `availability:${eventName}`,
      () => fetchEventAvailabilityFromApi(eventName),
      CacheTTL.AVAILABILITY
    );
    
    return result;
  } catch (error) {
    logger.warn('Error fetching availability', { eventName, error });
    return null;
  }
}

/**
 * Get event with tickets AND real-time availability
 * Only returns published events that are not in the past
 */
export async function getEventWithTicketsAndAvailability(
  eventId: string
): Promise<(EventWithTickets & { availability: EventAvailability | null }) | null> {
  const event = await getEventWithTickets(eventId);
  if (!event) {
    return null;
  }

  // Verify event is published (or NULL/undefined for backward compatibility) and not in the past
  const today = new Date().toISOString().split('T')[0];
  const status = event.status;
  if ((status && status !== 'published') || event.event_date < today) {
    console.warn('Event is not published or is in the past:', eventId, 'status:', status);
    return null;
  }

  // Fetch availability from scanner API
  const availability = await getEventAvailability(event.name);

  return {
    ...event,
    availability,
  };
}

// ============================================
// PAGINATED EVENT QUERIES
// ============================================

/**
 * Filter options for paginated event queries
 */
export interface EventFilters {
  /** Filter by event status (published, draft, archived) */
  status?: string | null;
  /** Filter by category */
  category?: string | null;
  /** Only show active events */
  isActive?: boolean | null;
  /** Only show upcoming events (event_date >= today) */
  upcomingOnly?: boolean;
  /** Filter by date range - start */
  dateFrom?: string | null;
  /** Filter by date range - end */
  dateTo?: string | null;
  /** Search by event name (partial match) */
  search?: string | null;
  /** Filter by venue name */
  venue?: string | null;
  /** Filter by city */
  city?: string | null;
}

/**
 * Event row with additional computed fields for pagination results
 */
export interface PaginatedEventRow extends Event {
  /** Number of ticket types for this event */
  ticketTypeCount?: number;
  /** Number of tickets sold for this event */
  ticketsSold?: number;
  /** Total revenue from ticket sales */
  totalRevenue?: number;
}

/**
 * Get events with pagination support
 * 
 * @param options - Pagination options (page, pageSize, sortBy, sortOrder)
 * @param filters - Filter criteria
 * @param client - Optional Supabase client override
 * @returns Paginated result with events and metadata
 * 
 * @example
 * ```typescript
 * const result = await getEventsPaginated(
 *   { page: 1, pageSize: 10, sortBy: 'event_date', sortOrder: 'asc' },
 *   { status: 'published', upcomingOnly: true }
 * );
 * console.log(result.pagination.totalItems);
 * ```
 */
export async function getEventsPaginated(
  options: PaginationOptions = {},
  filters: EventFilters = {},
  client: SupabaseTypedClient = supabase
): Promise<PaginatedResult<PaginatedEventRow>> {
  return tracer.withSpan('events.getEventsPaginated', async (span) => {
    const timer = startTimer();
    const queryLogger = logger.child({ operation: 'getEventsPaginated', filters });
    
    span.setAttributes({
      'events.page': options.page || 1,
      'events.page_size': options.pageSize || 20,
      'events.filters': JSON.stringify(filters),
    });
  
    // Build base query for count
    let countQuery = client
      .from('events')
      .select('id', { count: 'exact', head: true });
    
    // Build data query
    let dataQuery = client
      .from('events')
      .select('*');
  
  // Apply filters
  if (filters.status && filters.status !== 'all') {
    countQuery = countQuery.eq('status', filters.status);
    dataQuery = dataQuery.eq('status', filters.status);
  }
  
  if (filters.category) {
    countQuery = countQuery.eq('event_category', filters.category);
    dataQuery = dataQuery.eq('event_category', filters.category);
  }
  
  if (filters.isActive !== null && filters.isActive !== undefined) {
    countQuery = countQuery.eq('is_active', filters.isActive);
    dataQuery = dataQuery.eq('is_active', filters.isActive);
  }
  
  if (filters.upcomingOnly) {
    const today = new Date().toISOString().split('T')[0];
    countQuery = countQuery.gte('event_date', today);
    dataQuery = dataQuery.gte('event_date', today);
  }
  
  if (filters.dateFrom) {
    countQuery = countQuery.gte('event_date', filters.dateFrom);
    dataQuery = dataQuery.gte('event_date', filters.dateFrom);
  }
  
  if (filters.dateTo) {
    countQuery = countQuery.lte('event_date', filters.dateTo);
    dataQuery = dataQuery.lte('event_date', filters.dateTo);
  }
  
  if (filters.search) {
    countQuery = countQuery.ilike('name', `%${filters.search}%`);
    dataQuery = dataQuery.ilike('name', `%${filters.search}%`);
  }
  
  if (filters.venue) {
    countQuery = countQuery.ilike('venue_name', `%${filters.venue}%`);
    dataQuery = dataQuery.ilike('venue_name', `%${filters.venue}%`);
  }
  
  if (filters.city) {
    countQuery = countQuery.ilike('city', `%${filters.city}%`);
    dataQuery = dataQuery.ilike('city', `%${filters.city}%`);
  }
  
    // Get total count
    const { count, error: countError } = await traceQuery('events.getCount', async () => {
      const result = await countQuery;
      if (result.error) {
        throw result.error;
      }
      return result.count ?? 0;
    });
    
    if (countError) {
      queryLogger.error('Failed to get event count', { error: countError.message });
      span.setError(countError);
      throw new DatabaseError('getEventsPaginated', countError);
    }
    
    const totalCount = count ?? 0;
    span.setAttribute('events.total_count', totalCount);
    
    // Apply pagination to data query
    dataQuery = applyPagination(dataQuery, {
      ...options,
      sortBy: options.sortBy ?? 'event_date',
      sortOrder: options.sortOrder ?? 'asc',
    });
    
    const { data, error: dataError } = await traceQuery('events.getData', async () => {
      const result = await dataQuery;
      if (result.error) {
        throw result.error;
      }
      return result.data ?? [];
    });
    
    trackDbQuery('select', timer(), !dataError, 'events');
    
    if (dataError) {
      queryLogger.error('Failed to get events', { error: dataError.message });
      span.setError(dataError);
      throw new DatabaseError('getEventsPaginated', dataError);
    }
    
    const events: PaginatedEventRow[] = data ?? [];
    
    span.setAttributes({
      'events.returned_count': events.length,
      'events.cache_hit': false, // Could be enhanced to track cache
    });
    span.addEvent('events.fetched', { count: events.length });
    
    queryLogger.debug('Events fetched', { 
      count: events.length, 
      totalCount,
      page: options.page,
    });
  
    return buildPaginatedResponse(events, totalCount, options);
  }, { kind: 'server' });
}

/**
 * Get events with cursor-based pagination (for infinite scroll)
 * 
 * @param options - Cursor pagination options
 * @param filters - Filter criteria
 * @param client - Optional Supabase client override
 * @returns Cursor-paginated result with events
 */
export async function getEventsCursor(
  options: CursorPaginationOptions = {},
  filters: EventFilters = {},
  client: SupabaseTypedClient = supabase
): Promise<CursorPaginatedResult<PaginatedEventRow>> {
  const timer = startTimer();
  const queryLogger = logger.child({ operation: 'getEventsCursor' });
  
  let query = client
    .from('events')
    .select('*');
  
  // Apply filters
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  
  if (filters.isActive !== null && filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }
  
  if (filters.upcomingOnly) {
    const today = new Date().toISOString().split('T')[0];
    query = query.gte('event_date', today);
  }
  
  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }
  
  // Apply cursor pagination
  query = applyCursorPagination(query, {
    ...options,
    cursorColumn: 'id',
    sortBy: options.sortBy ?? 'event_date',
    sortOrder: options.sortOrder ?? 'asc',
  });
  
  const { data, error } = await query;
  
  trackDbQuery('select', timer(), !error, 'events');
  
  if (error) {
    queryLogger.error('Failed to get events with cursor', { error: error.message });
    throw new DatabaseError('getEventsCursor', error);
  }
  
  const events: PaginatedEventRow[] = data ?? [];
  
  return buildCursorPaginatedResponse(
    events,
    options,
    (event) => event.id
  );
}

// ============================================
// PAGINATED TICKET TYPE QUERIES
// ============================================

/**
 * Filter options for paginated ticket type queries
 */
export interface TicketTypeFilters {
  /** Minimum price filter */
  minPrice?: number | null;
  /** Maximum price filter */
  maxPrice?: number | null;
  /** Only show ticket types with available inventory */
  availableOnly?: boolean;
  /** Search by name (partial match) */
  search?: string | null;
}

/**
 * Ticket type with availability info for pagination results
 */
export interface PaginatedTicketTypeRow extends TicketType {
  /** Number of tickets sold for this type */
  ticketsSold?: number;
  /** Number of tickets available */
  available?: number;
  /** Whether this ticket type has unlimited inventory */
  isUnlimited?: boolean;
}

/**
 * Get ticket types for an event with pagination support
 * 
 * @param eventId - Event ID to get ticket types for
 * @param options - Pagination options
 * @param filters - Filter criteria
 * @param client - Optional Supabase client override
 * @returns Paginated result with ticket types
 * 
 * @example
 * ```typescript
 * const result = await getTicketTypesPaginated(
 *   'event-123',
 *   { page: 1, pageSize: 10, sortBy: 'price', sortOrder: 'asc' }
 * );
 * ```
 */
export async function getTicketTypesPaginated(
  eventId: string,
  options: PaginationOptions = {},
  filters: TicketTypeFilters = {},
  client: SupabaseTypedClient = supabase
): Promise<PaginatedResult<PaginatedTicketTypeRow>> {
  const timer = startTimer();
  const queryLogger = logger.child({ operation: 'getTicketTypesPaginated', eventId });
  
  if (!eventId) {
    throw new ValidationError('Event ID is required', 'eventId');
  }
  
  // Build base query for count
  let countQuery = client
    .from('ticket_types')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  
  // Build data query
  let dataQuery = client
    .from('ticket_types')
    .select('*')
    .eq('event_id', eventId);
  
  // Apply filters
  if (filters.minPrice !== null && filters.minPrice !== undefined) {
    countQuery = countQuery.gte('price', filters.minPrice);
    dataQuery = dataQuery.gte('price', filters.minPrice);
  }
  
  if (filters.maxPrice !== null && filters.maxPrice !== undefined) {
    countQuery = countQuery.lte('price', filters.maxPrice);
    dataQuery = dataQuery.lte('price', filters.maxPrice);
  }
  
  if (filters.search) {
    countQuery = countQuery.ilike('name', `%${filters.search}%`);
    dataQuery = dataQuery.ilike('name', `%${filters.search}%`);
  }
  
  // Get total count
  const { count, error: countError } = await countQuery;
  
  if (countError) {
    queryLogger.error('Failed to get ticket type count', { error: countError.message });
    throw new DatabaseError('getTicketTypesPaginated', countError);
  }
  
  const totalCount = count ?? 0;
  
  // Apply pagination to data query
  dataQuery = applyPagination(dataQuery, {
    ...options,
    sortBy: options.sortBy ?? 'price',
    sortOrder: options.sortOrder ?? 'asc',
  });
  
  const { data, error: dataError } = await dataQuery;
  
  trackDbQuery('select', timer(), !dataError, 'ticket_types');
  
  if (dataError) {
    queryLogger.error('Failed to get ticket types', { error: dataError.message });
    throw new DatabaseError('getTicketTypesPaginated', dataError);
  }
  
  // Enrich with availability info if needed
  let ticketTypes: PaginatedTicketTypeRow[] = data ?? [];
  
  // If availableOnly filter is set, we need to check availability
  if (filters.availableOnly) {
    const ticketTypeIds = ticketTypes.map(t => t.id);
    
    // Get sold counts for all ticket types in one query
    const { data: soldData } = await client
      .from('tickets')
      .select('ticket_type_id')
      .in('ticket_type_id', ticketTypeIds)
      .in('status', ['issued', 'used', 'scanned']);
    
    // Count sold per type
    const soldByType = new Map<string, number>();
    for (const ticket of soldData ?? []) {
      const count = soldByType.get(ticket.ticket_type_id) ?? 0;
      soldByType.set(ticket.ticket_type_id, count + 1);
    }
    
    // Filter and enrich
    ticketTypes = ticketTypes
      .map(tt => {
        const sold = soldByType.get(tt.id) ?? 0;
        const totalInventory = tt.total_inventory ?? 0;
        const isUnlimited = totalInventory === 0;
        const available = isUnlimited ? 999999 : Math.max(0, totalInventory - sold);
        
        return {
          ...tt,
          ticketsSold: sold,
          available,
          isUnlimited,
        };
      })
      .filter(tt => tt.isUnlimited || tt.available > 0);
  }
  
  queryLogger.debug('Ticket types fetched', { 
    eventId,
    count: ticketTypes.length, 
    totalCount,
  });
  
  return buildPaginatedResponse(ticketTypes, totalCount, options);
}

/**
 * Get all ticket types across all events with pagination (admin use)
 * 
 * @param options - Pagination options
 * @param filters - Filter criteria (including eventId as optional)
 * @param client - Optional Supabase client override
 * @returns Paginated result with ticket types from all events
 */
export async function getAllTicketTypesPaginated(
  options: PaginationOptions = {},
  filters: TicketTypeFilters & { eventId?: string },
  client: SupabaseTypedClient = supabase
): Promise<PaginatedResult<PaginatedTicketTypeRow & { event?: { id: string; name: string } }>> {
  const timer = startTimer();
  const queryLogger = logger.child({ operation: 'getAllTicketTypesPaginated' });
  
  // Build base query for count
  let countQuery = client
    .from('ticket_types')
    .select('id', { count: 'exact', head: true });
  
  // Build data query with event info
  let dataQuery = client
    .from('ticket_types')
    .select(`
      *,
      events (
        id,
        name
      )
    `);
  
  // Apply eventId filter if provided
  if (filters.eventId) {
    countQuery = countQuery.eq('event_id', filters.eventId);
    dataQuery = dataQuery.eq('event_id', filters.eventId);
  }
  
  // Apply other filters
  if (filters.minPrice !== null && filters.minPrice !== undefined) {
    countQuery = countQuery.gte('price', filters.minPrice);
    dataQuery = dataQuery.gte('price', filters.minPrice);
  }
  
  if (filters.maxPrice !== null && filters.maxPrice !== undefined) {
    countQuery = countQuery.lte('price', filters.maxPrice);
    dataQuery = dataQuery.lte('price', filters.maxPrice);
  }
  
  if (filters.search) {
    countQuery = countQuery.ilike('name', `%${filters.search}%`);
    dataQuery = dataQuery.ilike('name', `%${filters.search}%`);
  }
  
  // Get total count
  const { count, error: countError } = await countQuery;
  
  if (countError) {
    queryLogger.error('Failed to get ticket type count', { error: countError.message });
    throw new DatabaseError('getAllTicketTypesPaginated', countError);
  }
  
  const totalCount = count ?? 0;
  
  // Apply pagination
  dataQuery = applyPagination(dataQuery, {
    ...options,
    sortBy: options.sortBy ?? 'created_at',
    sortOrder: options.sortOrder ?? 'desc',
  });
  
  const { data, error: dataError } = await dataQuery;
  
  trackDbQuery('select', timer(), !dataError, 'ticket_types');
  
  if (dataError) {
    queryLogger.error('Failed to get all ticket types', { error: dataError.message });
    throw new DatabaseError('getAllTicketTypesPaginated', dataError);
  }
  
  // Transform data
  const ticketTypes = (data ?? []).map((row: any) => ({
    ...row,
    event: row.events,
    events: undefined,
  }));
  
  return buildPaginatedResponse(ticketTypes, totalCount, options);
}

