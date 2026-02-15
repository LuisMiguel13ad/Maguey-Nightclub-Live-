import { supabase } from "../supabase";
import {
  checkAvailabilityBatch,
  checkRequestedAvailability,
  type AvailabilityCheckInput,
  type AvailabilityCheckResult,
  type TicketTypeAvailability,
} from "../availability-service";
import { InsufficientInventoryError } from "../errors";
import type { OrderLineItem, SupabaseTypedClient } from "./types";

// ============================================
// BATCH AVAILABILITY CHECK (N+1 FIX)
// ============================================

/**
 * Check ticket availability for multiple line items using a SINGLE batch query
 *
 * This function fixes the N+1 query problem where each line item would
 * previously require separate queries for ticket_types and tickets tables.
 *
 * OLD (N+1 problem):
 * ```typescript
 * for (const line of input.lineItems) {
 *   // Query 1: Get ticket type (runs N times)
 *   const { data: ticketType } = await client
 *     .from("ticket_types")
 *     .select("total_inventory, name")
 *     .eq("id", line.ticketTypeId)
 *     .single();
 *
 *   // Query 2: Count sold tickets (runs N times)
 *   const { count: soldCount } = await client
 *     .from("tickets")
 *     .select("id", { count: "exact", head: true })
 *     .eq("ticket_type_id", line.ticketTypeId)
 *     .in("status", ["issued", "used", "scanned"]);
 * }
 * ```
 *
 * NEW (Batched):
 * ```typescript
 * const availability = await checkLineItemsAvailability(lineItems);
 * // Only 2 queries total, regardless of number of line items
 * ```
 *
 * @param lineItems - Array of line items with ticketTypeId and quantity
 * @param options - Optional client override
 * @returns Array of availability check results
 */
export async function checkLineItemsAvailability(
  lineItems: OrderLineItem[],
  options: { client?: SupabaseTypedClient } = {}
): Promise<AvailabilityCheckResult[]> {
  const checks: AvailabilityCheckInput[] = lineItems.map(line => ({
    ticketTypeId: line.ticketTypeId,
    requestedQuantity: line.quantity,
  }));

  return checkRequestedAvailability(checks, {
    client: options.client,
    useCache: true,
  });
}

/**
 * Validate that all line items have sufficient inventory
 * Throws InsufficientInventoryError if any ticket type is unavailable
 *
 * @param lineItems - Array of line items to validate
 * @param options - Optional client override
 * @throws InsufficientInventoryError if inventory is insufficient
 */
export async function validateLineItemsAvailability(
  lineItems: OrderLineItem[],
  options: { client?: SupabaseTypedClient } = {}
): Promise<void> {
  const results = await checkLineItemsAvailability(lineItems, options);

  const unavailable = results.filter(r => !r.isAvailable);

  if (unavailable.length > 0) {
    // Find the first unavailable item for detailed error
    const first = unavailable[0];
    throw new InsufficientInventoryError(
      first.name,
      first.requestedQuantity,
      first.available ?? 0
    );
  }
}

/**
 * Get availability for all ticket types associated with line items
 * Returns a Map for efficient lookup by ticketTypeId
 *
 * @param lineItems - Array of line items
 * @param options - Optional client override
 * @returns Map of ticketTypeId to availability info
 */
export async function getLineItemsAvailabilityMap(
  lineItems: OrderLineItem[],
  options: { client?: SupabaseTypedClient } = {}
): Promise<Map<string, TicketTypeAvailability>> {
  const ticketTypeIds = lineItems.map(l => l.ticketTypeId);
  const result = await checkAvailabilityBatch(ticketTypeIds, {
    client: options.client,
    useCache: true,
  });

  return result.ticketTypes;
}
