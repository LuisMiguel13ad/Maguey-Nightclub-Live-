import { supabase } from "../supabase";
import { createTicketData, type TicketData } from "../ticket-generator";
import { createLogger } from "../logger";
import { trackDbQuery, startTimer, metrics } from "../monitoring";
import type { InsertTicketsParams, BatchInsertTicketsParams, SupabaseTypedClient } from "./types";

// Create module-scoped logger
const logger = createLogger({ module: 'orders/ticket-insertion' });

/**
 * Generate a human-readable ticket ID (e.g., MGY-PF-20250115-ABC123)
 */
function generateHumanReadableTicketId(eventId: string, orderId: string, index: number): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MGY-${eventId.slice(0, 2).toUpperCase()}-${dateStr}-${shortOrderId}-${randomSuffix}`;
}

/**
 * Insert tickets for an order - OPTIMIZED to avoid N+1 queries
 *
 * BEFORE (N+1 pattern):
 * - For loop with await inside: N sequential createTicketData calls
 * - Total: N async operations + 1 INSERT = slow for large orders
 *
 * AFTER (Batched):
 * - Generate all ticket data in PARALLEL using Promise.all
 * - Single bulk INSERT for all tickets
 * - Total: 1 parallel batch + 1 INSERT = fast regardless of quantity
 *
 * @param params - Ticket insertion parameters
 * @returns Created tickets and email payloads
 */
export async function insertTicketsForOrder(
  params: InsertTicketsParams
): Promise<{ ticketEmailPayloads: TicketData[]; queryCount: number }> {
  const client = params.client ?? supabase;
  const issuedAt = new Date().toISOString();
  let queryCount = 0;

  const insertLogger = logger.child({
    operation: 'insertTicketsForOrder',
    orderId: params.order.id,
    eventId: params.event.id,
    quantity: params.quantity,
  });

  const startTime = Date.now();

  // ============================================
  // PHASE 1: Generate all ticket data in PARALLEL
  // BEFORE: Sequential loop with N awaits
  // AFTER: Single Promise.all for all tickets
  // ============================================

  insertLogger.debug('Generating ticket data in parallel', { quantity: params.quantity });

  // Create array of indices for parallel processing
  const ticketIndices = Array.from({ length: params.quantity }, (_, i) => i);

  // Generate all ticket data in parallel (no N+1 here!)
  const ticketDataPromises = ticketIndices.map(async (index) => {
    const ticketData = await createTicketData({
      eventId: params.event.id,
      eventImage: params.event.image_url || "",
      eventName: params.event.name,
      eventDate: params.event.event_date,
      eventTime: params.event.event_time,
      venue: params.event.venue_name || "",
      venueAddress: params.event.venue_address || params.event.city || "",
      ticketType: params.displayName,
      ticketHolderName: params.attendeeName ?? params.order.purchaser_name ?? "",
      orderId: params.order.id,
      price: params.unitPrice + params.unitFee,
    });

    const humanReadableTicketId = generateHumanReadableTicketId(
      params.event.id,
      params.order.id,
      index
    );

    return { ticketData, humanReadableTicketId, index };
  });

  // Wait for ALL ticket data to be generated in parallel
  const generatedTickets = await Promise.all(ticketDataPromises);

  insertLogger.debug('Ticket data generated', {
    ticketCount: generatedTickets.length,
    parallelDurationMs: Date.now() - startTime,
  });

  // ============================================
  // PHASE 2: Build ticket rows and email payloads
  // ============================================

  const ticketEmailPayloads: TicketData[] = [];
  const ticketRows: Record<string, unknown>[] = [];

  const attendeeName = params.attendeeName ?? params.order.purchaser_name ?? "";
  const attendeeEmail = params.attendeeEmail ?? params.order.purchaser_email ?? "";

  for (const { ticketData, humanReadableTicketId } of generatedTickets) {
    ticketEmailPayloads.push(ticketData);

    ticketRows.push({
      // Primary identifier - scanner searches by THIS (UUID)
      qr_token: ticketData.qrToken,

      // UUID foreign keys
      event_id: params.event.id,
      ticket_type_id: params.ticketTypeId,

      // Attendee info
      attendee_name: attendeeName,
      attendee_email: attendeeEmail,

      // Order reference
      order_id: params.order.id,

      // Status and pricing
      status: "issued",
      issued_at: issuedAt,
      price: params.unitPrice,
      fee_total: params.unitFee,

      // QR code data
      qr_signature: ticketData.qrSignature,
      qr_code_url: ticketData.qrCodeDataUrl,
      qr_code_value: ticketData.qrToken,

      // Human-readable ID (display only)
      ticket_id: humanReadableTicketId,
    });
  }

  if (!ticketRows.length) {
    return { ticketEmailPayloads, queryCount: 0 };
  }

  // ============================================
  // PHASE 3: Single bulk INSERT for all tickets
  // ============================================

  const insertTimer = startTimer();
  const { error: insertError } = await client
    .from("tickets")
    .insert(ticketRows);

  queryCount = 1; // Single INSERT query
  trackDbQuery('insert', insertTimer(), !insertError, 'tickets');

  if (insertError) {
    insertLogger.error('Failed to insert tickets', { error: insertError.message });
    throw new Error(
      `insertTicketsForOrder: failed inserting tickets: ${insertError.message}`
    );
  }

  const totalDurationMs = Date.now() - startTime;

  insertLogger.info('Tickets inserted successfully (batched)', {
    ticketCount: ticketRows.length,
    queryCount,
    totalDurationMs,
  });

  // Track metrics
  metrics.increment('tickets.inserted', ticketRows.length, {
    event_id: params.event.id,
    batched: 'true',
  });
  metrics.timing('tickets.insert.duration', totalDurationMs);

  return { ticketEmailPayloads, queryCount };
}

/**
 * Insert tickets for MULTIPLE line items in a single batch operation
 *
 * This is the fully optimized version that handles multiple ticket types
 * in a single database operation.
 *
 * BEFORE (N+1 pattern for M line items with N tickets each):
 * - M * N sequential createTicketData calls
 * - M INSERT queries (one per line item)
 * - Total: M*N + M = O(M*N) operations
 *
 * AFTER (Batched):
 * - 1 parallel batch for all M*N tickets
 * - 1 single INSERT for all tickets
 * - Total: 2 operations (constant!)
 *
 * @param params - Array of line items with ticket info
 * @returns All created tickets and query stats
 */
export async function insertTicketsForOrderBatch(
  params: BatchInsertTicketsParams
): Promise<{
  ticketEmailPayloads: TicketData[];
  queryCount: number;
  ticketCount: number;
}> {
  const client = params.client ?? supabase;
  const issuedAt = new Date().toISOString();

  const batchLogger = logger.child({
    operation: 'insertTicketsForOrderBatch',
    orderId: params.order.id,
    eventId: params.event.id,
    lineItemCount: params.lineItems.length,
  });

  const startTime = Date.now();

  // Calculate total tickets
  const totalTickets = params.lineItems.reduce((sum, li) => sum + li.quantity, 0);

  batchLogger.info('Starting batch ticket insertion', {
    lineItemCount: params.lineItems.length,
    totalTickets,
  });

  // ============================================
  // PHASE 1: Flatten all line items into ticket specs
  // ============================================

  interface TicketSpec {
    lineItem: typeof params.lineItems[0];
    index: number;
    globalIndex: number;
  }

  const ticketSpecs: TicketSpec[] = [];
  let globalIndex = 0;

  for (const lineItem of params.lineItems) {
    for (let i = 0; i < lineItem.quantity; i++) {
      ticketSpecs.push({
        lineItem,
        index: i,
        globalIndex: globalIndex++,
      });
    }
  }

  // ============================================
  // PHASE 2: Generate ALL ticket data in PARALLEL
  // ============================================

  batchLogger.debug('Generating all ticket data in parallel', { ticketCount: ticketSpecs.length });

  const ticketDataPromises = ticketSpecs.map(async ({ lineItem, globalIndex }) => {
    const ticketData = await createTicketData({
      eventId: params.event.id,
      eventImage: params.event.image_url || "",
      eventName: params.event.name,
      eventDate: params.event.event_date,
      eventTime: params.event.event_time,
      venue: params.event.venue_name || "",
      venueAddress: params.event.venue_address || params.event.city || "",
      ticketType: lineItem.displayName,
      ticketHolderName: params.attendeeName ?? params.order.purchaser_name ?? "",
      orderId: params.order.id,
      price: lineItem.unitPrice + lineItem.unitFee,
    });

    const humanReadableTicketId = generateHumanReadableTicketId(
      params.event.id,
      params.order.id,
      globalIndex
    );

    return { ticketData, humanReadableTicketId, lineItem };
  });

  const generatedTickets = await Promise.all(ticketDataPromises);

  batchLogger.debug('All ticket data generated', {
    ticketCount: generatedTickets.length,
    parallelDurationMs: Date.now() - startTime,
  });

  // ============================================
  // PHASE 3: Build all ticket rows
  // ============================================

  const ticketEmailPayloads: TicketData[] = [];
  const ticketRows: Record<string, unknown>[] = [];

  const attendeeName = params.attendeeName ?? params.order.purchaser_name ?? "";
  const attendeeEmail = params.attendeeEmail ?? params.order.purchaser_email ?? "";

  for (const { ticketData, humanReadableTicketId, lineItem } of generatedTickets) {
    ticketEmailPayloads.push(ticketData);

    ticketRows.push({
      qr_token: ticketData.qrToken,
      event_id: params.event.id,
      ticket_type_id: lineItem.ticketTypeId,
      attendee_name: attendeeName,
      attendee_email: attendeeEmail,
      order_id: params.order.id,
      status: "issued",
      issued_at: issuedAt,
      price: lineItem.unitPrice,
      fee_total: lineItem.unitFee,
      qr_signature: ticketData.qrSignature,
      qr_code_url: ticketData.qrCodeDataUrl,
      qr_code_value: ticketData.qrToken,
      ticket_id: humanReadableTicketId,
    });
  }

  if (!ticketRows.length) {
    return { ticketEmailPayloads, queryCount: 0, ticketCount: 0 };
  }

  // ============================================
  // PHASE 4: SINGLE bulk INSERT for ALL tickets
  // ============================================

  const insertTimer = startTimer();
  const { error: insertError } = await client
    .from("tickets")
    .insert(ticketRows);

  const queryCount = 1; // Single INSERT for all tickets!
  trackDbQuery('insert', insertTimer(), !insertError, 'tickets');

  if (insertError) {
    batchLogger.error('Failed to batch insert tickets', { error: insertError.message });
    throw new Error(
      `insertTicketsForOrderBatch: failed inserting tickets: ${insertError.message}`
    );
  }

  const totalDurationMs = Date.now() - startTime;

  batchLogger.info('Batch ticket insertion complete', {
    lineItemCount: params.lineItems.length,
    ticketCount: ticketRows.length,
    queryCount,
    totalDurationMs,
    avgMsPerTicket: (totalDurationMs / ticketRows.length).toFixed(2),
  });

  // Track metrics
  metrics.increment('tickets.batch_inserted', ticketRows.length, {
    event_id: params.event.id,
    line_item_count: String(params.lineItems.length),
  });
  metrics.timing('tickets.batch_insert.duration', totalDurationMs);

  return {
    ticketEmailPayloads,
    queryCount,
    ticketCount: ticketRows.length,
  };
}
