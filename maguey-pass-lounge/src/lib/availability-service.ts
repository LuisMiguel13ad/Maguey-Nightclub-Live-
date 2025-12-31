/**
 * Ticket Availability Service
 * 
 * This service provides batched, efficient queries for ticket availability
 * to avoid N+1 query problems when checking multiple ticket types.
 * 
 * Problem (N+1 Query):
 * ```typescript
 * // BAD: One query per line item (N queries)
 * for (const line of input.lineItems) {
 *   const { data: ticketType } = await client
 *     .from("ticket_types")
 *     .select("total_inventory, name")
 *     .eq("id", line.ticketTypeId)
 *     .single();
 *
 *   const { count: soldCount } = await client
 *     .from("tickets")
 *     .select("id", { count: "exact", head: true })
 *     .eq("ticket_type_id", line.ticketTypeId)
 *     .in("status", ["issued", "used", "scanned"]);
 * }
 * ```
 * 
 * Solution (Batched Query):
 * ```typescript
 * // GOOD: Single query for all ticket types
 * const availability = await checkAvailabilityBatch(ticketTypeIds);
 * ```
 */

import { supabase } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "./logger";
import { startTimer, trackDbQuery, metrics } from "./monitoring";
import { cache, CacheKeys } from "./cache";

const logger = createLogger({ module: 'availability-service' });

// ============================================
// TYPES
// ============================================

export interface TicketTypeAvailability {
  ticketTypeId: string;
  name: string;
  totalInventory: number | null;  // null means unlimited
  ticketsSold: number;
  available: number | null;       // null means unlimited
  isAvailable: boolean;
}

export interface BatchAvailabilityResult {
  ticketTypes: Map<string, TicketTypeAvailability>;
  eventId: string;
  checkedAt: Date;
  fromCache: boolean;
}

export interface AvailabilityCheckInput {
  ticketTypeId: string;
  requestedQuantity: number;
}

export interface AvailabilityCheckResult {
  ticketTypeId: string;
  requestedQuantity: number;
  available: number | null;
  isAvailable: boolean;
  shortfall: number;  // How many tickets short (0 if available)
  name: string;
}

// ============================================
// BATCH AVAILABILITY CHECK
// ============================================

/**
 * Check availability for multiple ticket types in a SINGLE query
 * This fixes the N+1 query problem by batching all ticket type lookups
 * 
 * @param ticketTypeIds - Array of ticket type IDs to check
 * @param options - Optional client and cache settings
 * @returns Map of ticket type ID to availability info
 * 
 * @example
 * ```typescript
 * const ticketTypeIds = lineItems.map(l => l.ticketTypeId);
 * const availability = await checkAvailabilityBatch(ticketTypeIds);
 * 
 * for (const line of lineItems) {
 *   const info = availability.ticketTypes.get(line.ticketTypeId);
 *   if (!info?.isAvailable || (info.available !== null && info.available < line.quantity)) {
 *     throw new Error(`Insufficient inventory for ${info?.name}`);
 *   }
 * }
 * ```
 */
export async function checkAvailabilityBatch(
  ticketTypeIds: string[],
  options: {
    client?: SupabaseClient<any>;
    useCache?: boolean;
    cacheTtlMs?: number;
  } = {}
): Promise<BatchAvailabilityResult> {
  const client = options.client ?? supabase;
  const useCache = options.useCache ?? true;
  const cacheTtlMs = options.cacheTtlMs ?? 30000; // 30 seconds default
  
  const log = logger.child({ 
    operation: 'checkAvailabilityBatch',
    ticketTypeCount: ticketTypeIds.length,
  });
  
  // Deduplicate ticket type IDs
  const uniqueIds = [...new Set(ticketTypeIds)];
  
  if (uniqueIds.length === 0) {
    return {
      ticketTypes: new Map(),
      eventId: '',
      checkedAt: new Date(),
      fromCache: false,
    };
  }
  
  // Try cache first (if enabled)
  if (useCache) {
    const cacheKey = `availability:batch:${uniqueIds.sort().join(',')}`;
    const cached = await cache.get<BatchAvailabilityResult>(cacheKey);
    if (cached) {
      log.debug('Cache hit for batch availability');
      metrics.increment('availability.cache.hit', 1);
      return { ...cached, fromCache: true };
    }
    metrics.increment('availability.cache.miss', 1);
  }
  
  const timer = startTimer();
  
  // SINGLE QUERY: Get all ticket types with their inventory in one query
  // Using .in() to batch the lookup
  const { data: ticketTypes, error: typesError } = await client
    .from('ticket_types')
    .select('id, name, total_inventory, tickets_sold, event_id')
    .in('id', uniqueIds);
  
  trackDbQuery('select', timer(), !typesError, 'ticket_types');
  
  if (typesError) {
    log.error('Failed to fetch ticket types', { error: typesError.message });
    throw new Error(`Failed to check availability: ${typesError.message}`);
  }
  
  // If tickets_sold isn't available on ticket_types table, we need a fallback
  // SINGLE QUERY: Get sold counts for all ticket types
  const soldTimer = startTimer();
  const { data: soldCounts, error: soldError } = await client
    .from('tickets')
    .select('ticket_type_id')
    .in('ticket_type_id', uniqueIds)
    .in('status', ['issued', 'used', 'scanned']);
  
  trackDbQuery('select', soldTimer(), !soldError, 'tickets');
  
  if (soldError) {
    log.warn('Failed to fetch sold counts, using tickets_sold from ticket_types', { 
      error: soldError.message 
    });
  }
  
  // Count sold tickets per type
  const soldByType = new Map<string, number>();
  if (soldCounts) {
    for (const ticket of soldCounts) {
      const count = soldByType.get(ticket.ticket_type_id) ?? 0;
      soldByType.set(ticket.ticket_type_id, count + 1);
    }
  }
  
  // Build result map
  const result: BatchAvailabilityResult = {
    ticketTypes: new Map(),
    eventId: ticketTypes?.[0]?.event_id ?? '',
    checkedAt: new Date(),
    fromCache: false,
  };
  
  for (const ticketType of ticketTypes ?? []) {
    // Use actual sold count from tickets table if available, otherwise use tickets_sold column
    const soldCount = soldByType.get(ticketType.id) ?? ticketType.tickets_sold ?? 0;
    const totalInventory = ticketType.total_inventory;
    
    // Calculate availability
    let available: number | null = null;
    let isAvailable = true;
    
    if (totalInventory !== null) {
      available = Math.max(0, totalInventory - soldCount);
      isAvailable = available > 0;
    }
    
    result.ticketTypes.set(ticketType.id, {
      ticketTypeId: ticketType.id,
      name: ticketType.name,
      totalInventory,
      ticketsSold: soldCount,
      available,
      isAvailable,
    });
  }
  
  // Add missing ticket types (not found in DB)
  for (const id of uniqueIds) {
    if (!result.ticketTypes.has(id)) {
      log.warn('Ticket type not found', { ticketTypeId: id });
      result.ticketTypes.set(id, {
        ticketTypeId: id,
        name: 'Unknown',
        totalInventory: 0,
        ticketsSold: 0,
        available: 0,
        isAvailable: false,
      });
    }
  }
  
  // Cache the result
  if (useCache) {
    const cacheKey = `availability:batch:${uniqueIds.sort().join(',')}`;
    await cache.set(cacheKey, result, cacheTtlMs);
  }
  
  log.debug('Batch availability check complete', {
    ticketTypesFound: ticketTypes?.length ?? 0,
    totalSoldTickets: soldCounts?.length ?? 0,
  });
  
  metrics.increment('availability.batch.check', 1, { 
    ticket_type_count: String(uniqueIds.length) 
  });
  
  return result;
}

/**
 * Check if requested quantities are available for multiple ticket types
 * Returns detailed results for each ticket type
 * 
 * @param checks - Array of ticket type IDs with requested quantities
 * @param options - Optional client override
 * @returns Array of availability check results
 * 
 * @example
 * ```typescript
 * const checks = lineItems.map(l => ({
 *   ticketTypeId: l.ticketTypeId,
 *   requestedQuantity: l.quantity,
 * }));
 * 
 * const results = await checkRequestedAvailability(checks);
 * 
 * const unavailable = results.filter(r => !r.isAvailable);
 * if (unavailable.length > 0) {
 *   throw new InsufficientInventoryError(unavailable);
 * }
 * ```
 */
export async function checkRequestedAvailability(
  checks: AvailabilityCheckInput[],
  options: {
    client?: SupabaseClient<any>;
    useCache?: boolean;
  } = {}
): Promise<AvailabilityCheckResult[]> {
  const ticketTypeIds = checks.map(c => c.ticketTypeId);
  const availability = await checkAvailabilityBatch(ticketTypeIds, options);
  
  return checks.map(check => {
    const info = availability.ticketTypes.get(check.ticketTypeId);
    
    if (!info) {
      return {
        ticketTypeId: check.ticketTypeId,
        requestedQuantity: check.requestedQuantity,
        available: 0,
        isAvailable: false,
        shortfall: check.requestedQuantity,
        name: 'Unknown',
      };
    }
    
    // Calculate if we have enough
    const hasEnough = info.available === null || info.available >= check.requestedQuantity;
    const shortfall = info.available !== null 
      ? Math.max(0, check.requestedQuantity - info.available)
      : 0;
    
    return {
      ticketTypeId: check.ticketTypeId,
      requestedQuantity: check.requestedQuantity,
      available: info.available,
      isAvailable: hasEnough,
      shortfall,
      name: info.name,
    };
  });
}

/**
 * Get availability for a single event (all ticket types)
 * 
 * @param eventId - Event ID to check
 * @param options - Optional client and cache settings
 * @returns Array of availability info for all ticket types
 */
export async function getEventAvailability(
  eventId: string,
  options: {
    client?: SupabaseClient<any>;
    useCache?: boolean;
    cacheTtlMs?: number;
  } = {}
): Promise<TicketTypeAvailability[]> {
  const client = options.client ?? supabase;
  const useCache = options.useCache ?? true;
  const cacheTtlMs = options.cacheTtlMs ?? 60000; // 1 minute default
  
  // Try cache first
  if (useCache) {
    const cacheKey = CacheKeys.eventAvailability(eventId);
    const cached = await cache.get<TicketTypeAvailability[]>(cacheKey);
    if (cached) {
      metrics.increment('availability.event.cache.hit', 1, { event_id: eventId });
      return cached;
    }
    metrics.increment('availability.event.cache.miss', 1, { event_id: eventId });
  }
  
  const timer = startTimer();
  
  // Get all ticket types for the event
  const { data: ticketTypes, error: typesError } = await client
    .from('ticket_types')
    .select('id, name, total_inventory, tickets_sold')
    .eq('event_id', eventId)
    .order('price', { ascending: true });
  
  trackDbQuery('select', timer(), !typesError, 'ticket_types');
  
  if (typesError) {
    throw new Error(`Failed to get event availability: ${typesError.message}`);
  }
  
  if (!ticketTypes || ticketTypes.length === 0) {
    return [];
  }
  
  // Get accurate sold counts
  const ticketTypeIds = ticketTypes.map(t => t.id);
  const soldTimer = startTimer();
  const { data: soldCounts, error: soldError } = await client
    .from('tickets')
    .select('ticket_type_id')
    .in('ticket_type_id', ticketTypeIds)
    .in('status', ['issued', 'used', 'scanned']);
  
  trackDbQuery('select', soldTimer(), !soldError, 'tickets');
  
  // Count sold tickets per type
  const soldByType = new Map<string, number>();
  if (soldCounts) {
    for (const ticket of soldCounts) {
      const count = soldByType.get(ticket.ticket_type_id) ?? 0;
      soldByType.set(ticket.ticket_type_id, count + 1);
    }
  }
  
  // Build results
  const results: TicketTypeAvailability[] = ticketTypes.map(ticketType => {
    const soldCount = soldByType.get(ticketType.id) ?? ticketType.tickets_sold ?? 0;
    const totalInventory = ticketType.total_inventory;
    
    let available: number | null = null;
    let isAvailable = true;
    
    if (totalInventory !== null) {
      available = Math.max(0, totalInventory - soldCount);
      isAvailable = available > 0;
    }
    
    return {
      ticketTypeId: ticketType.id,
      name: ticketType.name,
      totalInventory,
      ticketsSold: soldCount,
      available,
      isAvailable,
    };
  });
  
  // Cache the result
  if (useCache) {
    const cacheKey = CacheKeys.eventAvailability(eventId);
    await cache.set(cacheKey, results, cacheTtlMs);
  }
  
  return results;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate that all requested tickets are available
 * Throws an error if any ticket type has insufficient inventory
 * 
 * @param checks - Array of ticket type IDs with requested quantities
 * @param options - Optional client override
 * @throws Error if any ticket type has insufficient inventory
 * 
 * @example
 * ```typescript
 * try {
 *   await validateAvailability(lineItems.map(l => ({
 *     ticketTypeId: l.ticketTypeId,
 *     requestedQuantity: l.quantity,
 *   })));
 *   // Proceed with order
 * } catch (error) {
 *   // Handle insufficient inventory
 * }
 * ```
 */
export async function validateAvailability(
  checks: AvailabilityCheckInput[],
  options: {
    client?: SupabaseClient<any>;
  } = {}
): Promise<void> {
  const results = await checkRequestedAvailability(checks, options);
  
  const unavailable = results.filter(r => !r.isAvailable);
  
  if (unavailable.length > 0) {
    const messages = unavailable.map(r => 
      `${r.name}: requested ${r.requestedQuantity}, available ${r.available ?? 'unknown'}`
    );
    
    throw new Error(
      `Insufficient inventory for: ${messages.join('; ')}`
    );
  }
}

// ============================================
// EXPORTS
// ============================================

export const availabilityService = {
  checkBatch: checkAvailabilityBatch,
  checkRequested: checkRequestedAvailability,
  getEventAvailability,
  validate: validateAvailability,
};

export default availabilityService;
