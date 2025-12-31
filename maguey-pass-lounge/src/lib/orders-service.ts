import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase, type Order } from "./supabase";
import {
  createTicketData,
  type TicketData,
} from "./ticket-generator";
import {
  generateTicketEmailHTML,
  generateTicketEmailText,
} from "./email-template";
import {
  Result,
  AsyncResult,
  ok,
  err,
  isOk,
  isErr,
} from "./result";
import {
  AppError,
  EventNotFoundError,
  OrderNotFoundError,
  TicketNotFoundError,
  InsufficientInventoryError,
  DatabaseError,
  ValidationError,
} from "./errors";
import { createLogger, type LogContext } from "./logger";
import { 
  trackOrderCreation, 
  trackDbQuery, 
  trackEmailSent,
  startTimer,
  metrics 
} from "./monitoring";
import { 
  executeOrderSaga, 
  type OrderSagaInput, 
  type OrderSagaResult 
} from "./sagas/order-saga";
import type { SagaExecution } from "./sagas/saga-engine";
import { 
  cache, 
  CacheKeys, 
  invalidateEventCaches 
} from "./cache";
import { emailCircuit, CircuitBreakerError } from "./circuit-breaker";
import { queueEmail, registerEmailSender, type QueuedEmail } from "./email-queue";
import { 
  publishTicketIssued, 
  publishTicketConfirmed,
  publishTicketEmailSent,
} from "./events/ticket-events";
import {
  generateCorrelationId,
  createEventMetadata,
} from "./event-store";
import {
  checkAvailabilityBatch,
  checkRequestedAvailability,
  validateAvailability,
  type AvailabilityCheckInput,
  type AvailabilityCheckResult,
  type TicketTypeAvailability,
} from "./availability-service";
import {
  applyPagination,
  buildPaginatedResponse,
  applyCursorPagination,
  buildCursorPaginatedResponse,
  type PaginationOptions,
  type PaginatedResult,
  type CursorPaginationOptions,
  type CursorPaginatedResult,
} from "./pagination";
import { orderLimiter, getClientIdentifier } from "./rate-limiter";
import { RateLimitError } from "./errors";
import { tracer, traceAsync, traceQuery, getCurrentTraceContext } from "./tracing";
import { errorTracker } from "./errors/error-tracker";
import { ErrorSeverity, ErrorCategory } from "./errors/error-types";

// Create module-scoped logger
const logger = createLogger({ module: 'orders-service' });

/**
 * Invalidate availability caches when order is created
 * This ensures users see updated ticket availability after a purchase
 */
async function invalidateAvailabilityCaches(
  eventId: string, 
  ticketTypeIds: string[]
): Promise<void> {
  try {
    // Invalidate event-level availability caches
    await cache.delete(CacheKeys.eventAvailability(eventId));
    
    // Invalidate per-ticket-type availability caches
    for (const ticketTypeId of ticketTypeIds) {
      await cache.delete(`availability:ticket:${ticketTypeId}`);
    }
    
    // Invalidate by prefix for any scanner API availability caches
    await cache.deleteByPrefix('availability:');
    
    logger.debug('Availability caches invalidated', { 
      eventId, 
      ticketTypeCount: ticketTypeIds.length 
    });
    
    metrics.increment('cache.invalidations.availability', 1, { event_id: eventId });
  } catch (error) {
    // Don't fail order creation if cache invalidation fails
    logger.warn('Failed to invalidate availability caches', { eventId, error });
  }
}

type SupabaseTypedClient = SupabaseClient<any>;

const runtimeOrigin =
  typeof window !== "undefined" && window.location
    ? window.location.origin
    : undefined;

function getFrontendUrl(): string {
  return (
    import.meta.env.VITE_FRONTEND_URL ||
    runtimeOrigin ||
    "http://localhost:5173"
  );
}

/**
 * Internal function to actually send email via Resend API
 * Used by both direct sending and queue processing
 */
async function sendEmailDirectly(payload: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const apiKey = import.meta.env.VITE_EMAIL_API_KEY;
  const fromAddress = import.meta.env.VITE_EMAIL_FROM_ADDRESS;

  if (!apiKey || !fromAddress) {
    throw new Error('Email service not configured');
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromAddress,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    let message = `Resend API request failed (${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody?.message) {
        message = errorBody.message;
      } else if (errorBody?.error) {
        message = errorBody.error;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
}

/**
 * Send email via Resend API with circuit breaker protection
 * 
 * The circuit breaker prevents cascading failures when the email service
 * is experiencing issues, allowing orders to complete without blocking
 * on email delivery.
 * 
 * When the circuit is open, emails are queued for later retry.
 */
async function sendEmailViaResend(payload: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const emailTimer = startTimer();
  const apiKey = import.meta.env.VITE_EMAIL_API_KEY;
  const fromAddress = import.meta.env.VITE_EMAIL_FROM_ADDRESS;

  // Demo Mode: Skip email sending if not configured
  if (!apiKey || !fromAddress) {
    logger.info('Email service not configured. Skipping email send.', {
      to: payload.to,
      subject: payload.subject,
    });
    // Track as skipped (not a failure)
    metrics.increment('emails.skipped', 1, { reason: 'not_configured' });
    return;
  }

  if (!payload.to.length) {
    trackEmailSent('ticket', false, emailTimer());
    throw new Error("No recipient email provided for ticket resend.");
  }

  // Check circuit state first - if open, queue immediately
  const circuitState = emailCircuit.getState();
  if (circuitState === 'OPEN') {
    logger.warn('Email circuit is open, queueing email for later retry', {
      to: payload.to,
      subject: payload.subject,
    });
    
    queueEmail({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      metadata: payload.metadata,
    });
    
    metrics.increment('emails.queued', 1, { reason: 'circuit_open' });
    return; // Don't throw - email is queued
  }

  try {
    // Execute through circuit breaker to protect against email service outages
    await emailCircuit.execute(async () => {
      logger.debug('Sending email via Resend', {
        to: payload.to,
        subject: payload.subject,
      });

      await sendEmailDirectly(payload);

      logger.info('Email sent successfully', {
        to: payload.to,
        subject: payload.subject,
      });
    });
    
    // Track successful email send
    trackEmailSent('ticket', true, emailTimer());
  } catch (error) {
    trackEmailSent('ticket', false, emailTimer());
    
    // Handle circuit breaker errors by queueing
    if (error instanceof CircuitBreakerError) {
      logger.warn('Email circuit breaker opened, queueing email for retry', {
        to: payload.to,
        subject: payload.subject,
        circuitState: error.state,
      });
      
      // Queue for later retry
      queueEmail({
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        metadata: payload.metadata,
      });
      
      metrics.increment('emails.queued', 1, { reason: 'circuit_breaker' });
      return; // Don't throw - email is queued
    }
    
    // For other errors, also queue the email
    logger.error('Failed to send email, queueing for retry', {
      error: error instanceof Error ? error.message : String(error),
      to: payload.to,
      subject: payload.subject,
    });
    
    queueEmail({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      metadata: {
        ...payload.metadata,
        originalError: error instanceof Error ? error.message : String(error),
      },
    });
    
    metrics.increment('emails.queued', 1, { reason: 'send_failed' });
    // Don't throw - email is queued for retry
  }
}

/**
 * Get the current status of the email circuit breaker
 * Useful for health checks and monitoring
 */
export function getEmailCircuitStatus() {
  return emailCircuit.getStats();
}

// Register the email sender for queue processing
registerEmailSender(async (queuedEmail: QueuedEmail) => {
  await emailCircuit.execute(async () => {
    await sendEmailDirectly({
      to: queuedEmail.to,
      subject: queuedEmail.subject,
      html: queuedEmail.html,
      text: queuedEmail.text,
    });
  });
});

export interface CheckoutSelectionItem {
  name: string;
  quantity: number;
  price: number;
  fee: number;
}

export type CheckoutSelectionRecord = Record<string, CheckoutSelectionItem>;

export interface OrderLineItem {
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  unitFee: number;
  displayName: string;
}

export interface CreateOrderInput {
  eventId: string;
  purchaserEmail: string;
  purchaserName: string;
  purchaserUserId?: string | null;
  lineItems: OrderLineItem[];
  metadata?: Record<string, unknown>;
  ticketHolderName?: string;
  promoCodeId?: string | null;
}

export interface CreatedOrderResult {
  order: Order;
  lineItems: OrderLineItem[];
  ticketEmailPayloads: TicketData[];
}

export interface CreateOrderOptions {
  client?: SupabaseTypedClient;
  /** Client IP address for rate limiting */
  clientIP?: string;
}

export function mapCheckoutSelectionToLineItems(
  selection: CheckoutSelectionRecord
): OrderLineItem[] {
  return Object.entries(selection)
    .filter(([, item]) => item.quantity > 0)
    .map(([ticketTypeId, item]) => ({
      ticketTypeId,
      quantity: item.quantity,
      unitPrice: item.price,
      unitFee: item.fee,
      displayName: item.name,
    }));
}

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

export async function createOrderWithTickets(
  input: CreateOrderInput,
  options: CreateOrderOptions = {}
): Promise<CreatedOrderResult> {
  return tracer.withSpan('orders.createOrderWithTickets', async (span) => {
    const client = options.client ?? supabase;
    const orderTimer = startTimer(); // Start timing for metrics
    const ticketCount = input.lineItems.reduce((sum, l) => sum + l.quantity, 0);
    
    // Set trace attributes
    span.setAttributes({
      'order.event_id': input.eventId,
      'order.purchaser_email': input.purchaserEmail,
      'order.ticket_count': ticketCount,
      'order.line_item_count': input.lineItems.length,
    });
    
    const orderLogger = logger.child({ 
      eventId: input.eventId, 
      email: input.purchaserEmail,
      ticketCount,
    });
    const done = orderLogger.time('createOrderWithTickets');

    // Track order creation attempt
    metrics.increment('orders.attempts', 1, { event_id: input.eventId });

    if (!input.lineItems.length) {
      orderLogger.warn('Order creation attempted with no line items');
      metrics.increment('orders.validation_failed', 1, { reason: 'no_line_items' });
      span.setError('No line items provided');
      
      const error = new ValidationError('No line items provided', 'lineItems', {
        eventId: input.eventId,
        purchaserEmail: input.purchaserEmail,
        traceId: getCurrentTraceContext()?.traceId,
      });
      
      errorTracker.captureError(error, {
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        context: {
          eventId: input.eventId,
          purchaserEmail: input.purchaserEmail,
          traceId: getCurrentTraceContext()?.traceId,
        },
      });
      
      throw error;
    }

    orderLogger.info('Starting order creation', { 
      lineItemCount: input.lineItems.length,
      ticketTypes: input.lineItems.map(l => l.displayName),
    });

    // Load event data for email generation (outside transaction)
    const event = await traceQuery('orders.loadEvent', async () => {
      const eventQueryTimer = startTimer();
      const { data: eventData, error: eventError } = await client
        .from("events")
        .select(
          "id, name, description, image_url, event_date, event_time, venue_name, venue_address, city"
        )
        .eq("id", input.eventId)
        .single();
      trackDbQuery('select', eventQueryTimer(), !eventError, 'events');
      
      if (eventError || !eventData) {
        span.addEvent('event.load.failed', { error: eventError?.message });
        
        const error = new EventNotFoundError(input.eventId, {
          error: eventError?.message,
          traceId: getCurrentTraceContext()?.traceId,
        });
        
        errorTracker.captureError(error, {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.VALIDATION,
          context: {
            eventId: input.eventId,
            traceId: getCurrentTraceContext()?.traceId,
          },
        });
        
        throw error;
      }
      
      return eventData;
    });

    orderLogger.debug('Event loaded', { eventName: event.name });
    span.addEvent('event.loaded', { event_name: event.name });

  // Calculate totals
  const totals = input.lineItems.reduce(
    (acc, line) => {
      const lineSubtotal = line.unitPrice * line.quantity;
      const lineFees = line.unitFee * line.quantity;
      acc.subtotal += lineSubtotal;
      acc.fees += lineFees;
      acc.total += lineSubtotal + lineFees;
      return acc;
    },
    { subtotal: 0, fees: 0, total: 0 }
  );

  // Prepare line items for atomic function
  const lineItemsJson = input.lineItems.map((line) => ({
    ticket_type_id: line.ticketTypeId,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    unit_fee: line.unitFee,
    display_name: line.displayName,
  }));

  // Get QR signing secret from environment
  const qrSigningSecret = import.meta.env.VITE_QR_SIGNING_SECRET || 
    'your-super-secret-key-change-this-in-production-12345';

    // Call atomic transaction function
    // This function handles:
    // 1. Ticket reservation (atomic with locking)
    // 2. Order creation
    // 3. Ticket creation with QR tokens/signatures
    // All in a single transaction - if anything fails, everything rolls back
    const atomicResult = await traceQuery('orders.createOrderAtomic', async () => {
      const atomicTimer = startTimer();
      const { data: result, error: atomicError } = await client.rpc(
        "create_order_with_tickets_atomic",
        {
          p_event_id: input.eventId,
          p_purchaser_email: input.purchaserEmail,
          p_purchaser_name: input.purchaserName,
          p_user_id: input.purchaserUserId ?? null,
          p_subtotal: totals.subtotal,
          p_fees_total: totals.fees,
          p_total: totals.total,
          p_status: "paid",
          p_metadata: input.metadata ?? {},
          p_promo_code_id: input.promoCodeId ?? null,
          p_line_items: lineItemsJson,
          p_attendee_name: input.ticketHolderName ?? input.purchaserName,
          p_attendee_email: input.purchaserEmail,
          p_qr_signing_secret: qrSigningSecret,
        }
      );
      trackDbQuery('rpc', atomicTimer(), !atomicError, 'create_order_with_tickets_atomic');
      
      if (atomicError || !result || result.length === 0) {
        span.addEvent('order.atomic.failed', { error: atomicError?.message });
        
        const traceContext = getCurrentTraceContext();
        const error = new DatabaseError(
          'create_order_with_tickets_atomic',
          atomicError || undefined,
          {
            eventId: input.eventId,
            purchaserEmail: input.purchaserEmail,
            traceId: traceContext?.traceId,
          }
        );
        
        errorTracker.captureError(error, {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.DATABASE,
          context: {
            eventId: input.eventId,
            purchaserEmail: input.purchaserEmail,
            traceId: traceContext?.traceId,
          },
        });
        
        throw error;
      }
      
      return result;
    });

    const result = atomicResult[0];
    const order = result.order_data as unknown as Order;
    
    span.setAttributes({
      'order.id': order.id,
      'order.status': order.status,
    });
    span.addEvent('order.created', { order_id: order.id });
    
    orderLogger.info('Order created successfully', { 
      orderId: order.id, 
      total: totals.total,
    });

    // Build ticket email payloads from the atomic function result
    // We need to enrich them with event data and generate QR code images
    const ticketEmailPayloads: TicketData[] = [];
    const ticketsData = result.tickets_data as any[] || [];
    const emailPayloads = result.ticket_email_payloads as any[] || [];

    span.addEvent('tickets.generating', { ticket_count: ticketsData.length });

    // Track which line item we're processing
    let ticketIndex = 0;

    // Enrich email payloads with event data and generate QR codes
    for (let i = 0; i < emailPayloads.length; i++) {
    const emailPayload = emailPayloads[i];
    const ticketData = ticketsData[i];
    
    // Find the corresponding line item for display name and pricing
    const lineItem = input.lineItems.find(
      (line) => line.ticketTypeId === ticketData.ticket_type_id
    );

    if (!lineItem) {
      orderLogger.warn('Could not find line item for ticket type', { 
        ticketTypeId: ticketData.ticket_type_id 
      });
      continue;
    }

    // Generate QR code image from the token and signature
    // The QR code should encode the raw payload JSON
    const qrPayload = JSON.stringify({
      token: emailPayload.qrToken,
      signature: emailPayload.qrSignature,
      meta: {
        eventId: event.id,
        orderId: order.id,
        ticketType: lineItem.displayName,
      },
    });

      // Generate QR code image (this happens outside transaction)
      const { generateQrImage } = await import('./ticket-generator');
      const qrCodeDataUrl = await traceAsync('tickets.generateQRCode', async () => {
        return await generateQrImage(qrPayload);
      }, { ticket_index: i });

      ticketEmailPayloads.push({
      ticketId: emailPayload.qrToken || emailPayload.ticketId,
      qrToken: emailPayload.qrToken,
      qrSignature: emailPayload.qrSignature,
      qrCodeDataUrl: qrCodeDataUrl,
      qrCodeUrl: qrCodeDataUrl,
      eventId: event.id,
      eventImage: event.image_url || "",
      eventName: event.name,
      eventDate: event.event_date,
      eventTime: event.event_time,
      venue: event.venue_name || "",
      venueAddress: event.venue_address || event.city || "",
      ticketType: lineItem.displayName,
      ticketHolderName: input.ticketHolderName ?? input.purchaserName ?? "",
      orderId: order.id,
        price: lineItem.unitPrice + lineItem.unitFee,
      });

      ticketIndex++;
    }

    span.addEvent('tickets.generated', { ticket_count: ticketEmailPayloads.length });

    // Auto-convert waitlist entry if customer was on waitlist
    // This happens AFTER transaction completes (idempotent operation)
    try {
      await traceAsync('orders.convertWaitlist', async () => {
        const { autoConvertWaitlistEntry } = await import('./waitlist-service');
        const convertedEntry = await autoConvertWaitlistEntry(
          event.name,
          input.purchaserEmail
        );
        if (convertedEntry) {
          orderLogger.info('Auto-converted waitlist entry');
          span.addEvent('waitlist.converted');
        }
      });
    } catch (error) {
      // Don't fail order creation if waitlist conversion fails
      orderLogger.warn('Failed to auto-convert waitlist entry', { error });
      span.addEvent('waitlist.convert.failed', { error: error instanceof Error ? error.message : String(error) });
      
      // Track error but don't throw
      errorTracker.captureError(
        error instanceof Error ? error : new Error(String(error)),
        {
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.UNKNOWN,
          context: {
            eventId: input.eventId,
            purchaserEmail: input.purchaserEmail,
            traceId: getCurrentTraceContext()?.traceId,
            operation: 'waitlist_conversion',
          },
          tags: {
            handled: 'true',
            nonBlocking: 'true',
          },
        }
      );
    }

  // Publish TicketIssued events for audit trail
  // This happens after transaction completes (async, non-blocking)
  const correlationId = generateCorrelationId();
  const eventMetadata = createEventMetadata({
    actorType: 'system',
    source: 'orders-service',
  });
  
  for (let i = 0; i < ticketsData.length; i++) {
    const ticketData = ticketsData[i];
    const emailPayload = emailPayloads[i];
    const lineItem = input.lineItems.find(
      (line) => line.ticketTypeId === ticketData.ticket_type_id
    );
    
    // Fire and forget - don't block order completion
    publishTicketIssued(
      ticketData.ticket_id,
      {
        orderId: order.id,
        eventId: input.eventId,
        attendeeName: ticketData.attendee_name,
        attendeeEmail: ticketData.attendee_email,
        ticketTypeId: ticketData.ticket_type_id,
        ticketTypeName: lineItem?.displayName || 'Unknown',
        price: ticketData.price,
        feeTotal: ticketData.fee_total,
        qrToken: emailPayload.qrToken,
        qrSignature: emailPayload.qrSignature,
      },
      eventMetadata,
      correlationId
    ).catch((err) => {
      // Log but don't fail - event sourcing is for audit trail
      orderLogger.warn('Failed to publish TicketIssued event', { 
        ticketId: ticketData.ticket_id, 
        error: err 
      });
    });
  }

    done(); // Log timing
    
    // Track successful order creation
    const duration = orderTimer();
    trackOrderCreation(order.id, duration, true, {
      eventId: input.eventId,
      ticketCount: ticketEmailPayloads.length,
      total: totals.total,
    });
    
    // Invalidate availability caches when order is created
    // This ensures users see updated ticket availability
    await traceAsync('orders.invalidateCaches', async () => {
      await invalidateAvailabilityCaches(input.eventId, input.lineItems.map(l => l.ticketTypeId));
    });
    
    orderLogger.info('Order creation complete', { 
      orderId: order.id,
      ticketCount: ticketEmailPayloads.length,
      durationMs: duration,
    });

    span.setOk();
    span.setAttributes({
      'order.duration_ms': duration,
      'order.ticket_count': ticketEmailPayloads.length,
    });

    return {
      order,
      lineItems: input.lineItems,
      ticketEmailPayloads,
    };
  }, {
    attributes: {
      'operation': 'createOrderWithTickets',
    }
  }).catch((error) => {
    // Capture error with full context
    const traceContext = getCurrentTraceContext();
    errorTracker.captureError(error, {
      severity: ErrorSeverity.HIGH,
      category: error instanceof PaymentError ? ErrorCategory.PAYMENT :
                error instanceof InventoryError ? ErrorCategory.INVENTORY :
                error instanceof DatabaseError ? ErrorCategory.DATABASE :
                ErrorCategory.UNKNOWN,
      context: {
        eventId: input.eventId,
        purchaserEmail: input.purchaserEmail,
        ticketCount: input.lineItems.reduce((sum, l) => sum + l.quantity, 0),
        traceId: traceContext?.traceId,
        operation: 'createOrderWithTickets',
      },
      tags: {
        orderCreation: 'true',
      },
    });
    
    throw error;
  });
}

/**
 * Create order with tickets (Result-based version)
 * Uses atomic database transaction - all-or-nothing semantics
 * 
 * @param input - Order creation input
 * @param options - Optional client override
 * @returns Result containing the created order and tickets, or an error
 */
export async function createOrderWithTicketsResult(
  input: CreateOrderInput,
  options: CreateOrderOptions = {}
): AsyncResult<CreatedOrderResult, AppError> {
  const client = options.client ?? supabase;

  // ============================================
  // RATE LIMITING
  // ============================================
  const rateLimitKey = getClientIdentifier(
    options.clientIP,
    input.purchaserUserId || undefined,
    input.purchaserEmail
  );
  
  const rateLimitResult = await orderLimiter.increment(rateLimitKey, {
    userId: input.purchaserUserId || undefined,
    ip: options.clientIP,
    endpoint: 'createOrder',
  });

  if (!rateLimitResult.allowed) {
    logger.warn('Order creation rate limit exceeded', {
      key: rateLimitKey,
      userId: input.purchaserUserId,
      email: input.purchaserEmail,
      retryAfter: rateLimitResult.retryAfter,
    });

    return err(new RateLimitError(
      `Too many order requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
      rateLimitResult.retryAfter,
      {
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt,
      }
    ));
  }

  // Validate input
  if (!input.lineItems.length) {
    return err(new ValidationError("No line items provided", "lineItems"));
  }

  if (!input.eventId) {
    return err(new ValidationError("Event ID is required", "eventId"));
  }

  if (!input.purchaserEmail) {
    return err(new ValidationError("Purchaser email is required", "purchaserEmail"));
  }

  // Load event data
  const { data: event, error: eventError } = await client
    .from("events")
    .select(
      "id, name, description, image_url, event_date, event_time, venue_name, venue_address, city"
    )
    .eq("id", input.eventId)
    .single();

  if (eventError || !event) {
    return err(new EventNotFoundError(input.eventId));
  }

  // Calculate totals
  const totals = input.lineItems.reduce(
    (acc, line) => {
      const lineSubtotal = line.unitPrice * line.quantity;
      const lineFees = line.unitFee * line.quantity;
      acc.subtotal += lineSubtotal;
      acc.fees += lineFees;
      acc.total += lineSubtotal + lineFees;
      return acc;
    },
    { subtotal: 0, fees: 0, total: 0 }
  );

  // Prepare line items for atomic function
  const lineItemsJson = input.lineItems.map((line) => ({
    ticket_type_id: line.ticketTypeId,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    unit_fee: line.unitFee,
    display_name: line.displayName,
  }));

  // Get QR signing secret
  const qrSigningSecret = import.meta.env.VITE_QR_SIGNING_SECRET || 
    'your-super-secret-key-change-this-in-production-12345';

  // Call atomic transaction function
  const { data: atomicResult, error: atomicError } = await client.rpc(
    "create_order_with_tickets_atomic",
    {
      p_event_id: input.eventId,
      p_purchaser_email: input.purchaserEmail,
      p_purchaser_name: input.purchaserName,
      p_subtotal: totals.subtotal,
      p_fees_total: totals.fees,
      p_total: totals.total,
      p_line_items: lineItemsJson,
      p_user_id: input.purchaserUserId ?? null,
      p_status: "paid",
      p_metadata: input.metadata ?? {},
      p_promo_code_id: input.promoCodeId ?? null,
      p_attendee_name: input.ticketHolderName ?? input.purchaserName,
      p_attendee_email: input.purchaserEmail,
      p_qr_signing_secret: qrSigningSecret,
    }
  );

  if (atomicError) {
    // Check for specific error types
    if (atomicError.message?.includes('Not enough tickets')) {
      const match = atomicError.message.match(/for (.+?)\. Requested: (\d+), Available: (\d+)/);
      if (match) {
        return err(new InsufficientInventoryError(
          match[1],
          parseInt(match[2]),
          parseInt(match[3])
        ));
      }
    }
    return err(new DatabaseError('createOrderWithTickets', atomicError));
  }

  if (!atomicResult || atomicResult.length === 0) {
    return err(new DatabaseError('createOrderWithTickets', new Error('No result from atomic function')));
  }

  const result = atomicResult[0];
  const order = result.order_data as unknown as Order;

  // Build ticket email payloads
  const ticketEmailPayloads: TicketData[] = [];
  const ticketsData = result.tickets_data as any[] || [];
  const emailPayloads = result.ticket_email_payloads as any[] || [];

  for (let i = 0; i < emailPayloads.length; i++) {
    const emailPayload = emailPayloads[i];
    const ticketData = ticketsData[i];
    
    const lineItem = input.lineItems.find(
      (line) => line.ticketTypeId === ticketData.ticket_type_id
    );

    if (!lineItem) continue;

    const qrPayload = JSON.stringify({
      token: emailPayload.qrToken,
      signature: emailPayload.qrSignature,
      meta: {
        eventId: event.id,
        orderId: order.id,
        ticketType: lineItem.displayName,
      },
    });

    const { generateQrImage } = await import('./ticket-generator');
    const qrCodeDataUrl = await generateQrImage(qrPayload);

    ticketEmailPayloads.push({
      ticketId: emailPayload.qrToken || emailPayload.ticketId,
      qrToken: emailPayload.qrToken,
      qrSignature: emailPayload.qrSignature,
      qrCodeDataUrl,
      qrCodeUrl: qrCodeDataUrl,
      eventId: event.id,
      eventImage: event.image_url || "",
      eventName: event.name,
      eventDate: event.event_date,
      eventTime: event.event_time,
      venue: event.venue_name || "",
      venueAddress: event.venue_address || event.city || "",
      ticketType: lineItem.displayName,
      ticketHolderName: input.ticketHolderName ?? input.purchaserName ?? "",
      orderId: order.id,
      price: lineItem.unitPrice + lineItem.unitFee,
    });
  }

  // Auto-convert waitlist entry (best effort)
  try {
    const { autoConvertWaitlistEntry } = await import('./waitlist-service');
    await autoConvertWaitlistEntry(event.name, input.purchaserEmail);
  } catch {
    // Ignore waitlist conversion errors
  }

  return ok({
    order,
    lineItems: input.lineItems,
    ticketEmailPayloads,
  });
}

// ============================================
// SAGA-BASED ORDER CREATION
// ============================================

/**
 * Options for saga-based order creation
 */
export interface CreateOrderWithSagaOptions {
  client?: SupabaseTypedClient;
  /** Persist saga execution to database for debugging/recovery */
  persistSaga?: boolean;
  /** Callback for saga state changes */
  onSagaStateChange?: (execution: SagaExecution<unknown>) => void | Promise<void>;
}

/**
 * Create order with tickets using the Saga pattern
 * 
 * This version uses a saga orchestrator that automatically handles
 * compensation (rollback) if any step fails. The saga flow is:
 * 
 * 1. Load Event Data (no compensation needed)
 * 2. Reserve Inventory → Release Inventory on failure
 * 3. Create Order Record → Cancel Order on failure
 * 4. Generate Tickets → Cancel Tickets on failure
 * 5. Send Confirmation Email (optional, no compensation)
 * 6. Update Waitlist (optional, no compensation)
 * 
 * If step 3 fails, the saga will automatically:
 * - Release the reserved inventory (step 2 compensation)
 * 
 * @param input - Order creation input
 * @param options - Optional configuration
 * @returns Result containing the created order and tickets, or an error with compensation details
 * 
 * @example
 * const result = await createOrderWithSaga({
 *   eventId: 'event-123',
 *   purchaserEmail: 'user@example.com',
 *   purchaserName: 'John Doe',
 *   lineItems: [{ ticketTypeId: 'ga', quantity: 2, unitPrice: 25, unitFee: 5, displayName: 'GA' }],
 * });
 * 
 * if (result.success) {
 *   console.log('Order created:', result.order.id);
 * } else {
 *   console.error('Order failed:', result.error);
 *   console.log('Compensated steps:', result.compensatedSteps);
 * }
 */
export async function createOrderWithSaga(
  input: CreateOrderInput,
  options: CreateOrderWithSagaOptions = {}
): Promise<OrderSagaResult> {
  const orderLogger = logger.child({ 
    eventId: input.eventId, 
    email: input.purchaserEmail,
    mode: 'saga',
  });
  
  const ticketCount = input.lineItems.reduce((sum, l) => sum + l.quantity, 0);
  
  // Track saga order creation attempt
  metrics.increment('orders.saga.attempts', 1, { event_id: input.eventId });

  // Validate input
  if (!input.lineItems.length) {
    orderLogger.warn('Order creation attempted with no line items');
    metrics.increment('orders.saga.validation_failed', 1, { reason: 'no_line_items' });
    return {
      success: false,
      lineItems: input.lineItems,
      ticketEmailPayloads: [],
      sagaId: '',
      durationMs: 0,
      error: new Error('No line items provided'),
    };
  }

  orderLogger.info('Starting saga-based order creation', {
    lineItemCount: input.lineItems.length,
    ticketCount,
  });

  // Prepare saga input
  const sagaInput: OrderSagaInput = {
    eventId: input.eventId,
    purchaserEmail: input.purchaserEmail,
    purchaserName: input.purchaserName,
    purchaserUserId: input.purchaserUserId,
    lineItems: input.lineItems,
    metadata: input.metadata,
    ticketHolderName: input.ticketHolderName,
    promoCodeId: input.promoCodeId,
  };

  // Prepare saga state change handler
  const onStateChange = async (execution: SagaExecution<unknown>) => {
    // Log state changes
    orderLogger.debug('Saga state changed', {
      status: execution.status,
      currentStep: execution.currentStep,
      stepsCompleted: execution.stepsCompleted,
    });

    // Persist to database if enabled
    if (options.persistSaga) {
      try {
        await persistSagaExecution(execution, options.client ?? supabase);
      } catch (error) {
        orderLogger.warn('Failed to persist saga execution', { error });
      }
    }

    // Call user callback if provided
    if (options.onSagaStateChange) {
      await options.onSagaStateChange(execution);
    }
  };

  // Execute the saga
  const result = await executeOrderSaga(sagaInput, {
    client: options.client,
    onStateChange,
  });

  // Track result
  if (result.success) {
    trackOrderCreation(result.order?.id || '', result.durationMs, true, {
      eventId: input.eventId,
      ticketCount: result.ticketEmailPayloads.length,
      total: result.order?.total ?? 0,
    });
    
    metrics.increment('orders.saga.completed', 1, { event_id: input.eventId });
    
    // Invalidate availability caches when order is created
    await invalidateAvailabilityCaches(input.eventId, input.lineItems.map(l => l.ticketTypeId));
    
    orderLogger.info('Saga-based order creation complete', {
      orderId: result.order?.id,
      ticketCount: result.ticketEmailPayloads.length,
      sagaId: result.sagaId,
      durationMs: result.durationMs,
    });
  } else {
    trackOrderCreation('', result.durationMs, false, {
      eventId: input.eventId,
      ticketCount: 0,
    });
    
    metrics.increment('orders.saga.failed', 1, { 
      event_id: input.eventId,
      compensated: result.compensatedSteps?.length ? 'true' : 'false',
    });
    
    orderLogger.error('Saga-based order creation failed', {
      error: result.error?.message,
      compensatedSteps: result.compensatedSteps,
      sagaId: result.sagaId,
      durationMs: result.durationMs,
    });
  }

  return result;
}

/**
 * Persist saga execution state to database
 */
async function persistSagaExecution(
  execution: SagaExecution<unknown>,
  client: SupabaseTypedClient
): Promise<void> {
  const { error } = await client
    .from('saga_executions')
    .upsert({
      saga_id: execution.sagaId,
      saga_name: execution.sagaName,
      status: execution.status,
      steps_completed: execution.stepsCompleted,
      current_step: execution.currentStep,
      context_snapshot: execution.contextSnapshot,
      error_details: execution.errorDetails,
      compensation_errors: execution.compensationErrors,
      started_at: execution.startedAt.toISOString(),
      completed_at: execution.completedAt?.toISOString(),
    }, {
      onConflict: 'saga_id',
    });

  if (error) {
    throw error;
  }
}

/**
 * Get saga execution details by saga ID
 */
export async function getSagaExecution(
  sagaId: string,
  client: SupabaseTypedClient = supabase
): Promise<SagaExecution<unknown> | null> {
  const { data, error } = await client
    .from('saga_executions')
    .select('*')
    .eq('saga_id', sagaId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    sagaId: data.saga_id,
    sagaName: data.saga_name,
    status: data.status,
    stepsCompleted: data.steps_completed,
    currentStep: data.current_step,
    contextSnapshot: data.context_snapshot,
    errorDetails: data.error_details,
    compensationErrors: data.compensation_errors,
    startedAt: new Date(data.started_at),
    completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
  };
}

/**
 * Get recent saga executions for an event
 */
export async function getRecentSagaExecutions(
  options: {
    sagaName?: string;
    status?: string;
    limit?: number;
  } = {},
  client: SupabaseTypedClient = supabase
): Promise<Array<{
  sagaId: string;
  sagaName: string;
  status: string;
  stepsCompleted: string[];
  errorDetails?: { step: string; message: string };
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}>> {
  let query = client
    .from('saga_executions')
    .select('saga_id, saga_name, status, steps_completed, error_details, started_at, completed_at, duration_ms')
    .order('started_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (options.sagaName) {
    query = query.eq('saga_name', options.sagaName);
  }

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map(row => ({
    sagaId: row.saga_id,
    sagaName: row.saga_name,
    status: row.status,
    stepsCompleted: row.steps_completed,
    errorDetails: row.error_details,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    durationMs: row.duration_ms,
  }));
}

export interface InsertTicketsParams {
  order: Order;
  event: {
    id: string;
    name: string;
    description?: string | null;
    image_url?: string | null;
    event_date: string;
    event_time: string;
    venue_name?: string | null;
    venue_address?: string | null;
    city?: string | null;
  };
  ticketTypeId: string;
  displayName: string;
  quantity: number;
  unitPrice: number;
  unitFee: number;
  attendeeName?: string | null;
  attendeeEmail?: string | null;
  client?: SupabaseTypedClient;
}

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
export interface BatchInsertTicketsParams {
  order: Order;
  event: InsertTicketsParams['event'];
  lineItems: Array<{
    ticketTypeId: string;
    displayName: string;
    quantity: number;
    unitPrice: number;
    unitFee: number;
  }>;
  attendeeName?: string | null;
  attendeeEmail?: string | null;
  client?: SupabaseTypedClient;
}

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

/**
 * Resend ticket email (Demo Mode: skips if email service not configured)
 */
export async function resendTicket(
  orderId: string,
  ticketId?: string
): Promise<void> {
  const client = supabase;

  const { data: order, error: orderError } = await client
    .from("orders")
    .select("id, purchaser_email, purchaser_name, event_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error(
      orderError?.message ?? `Order ${orderId} could not be found.`
    );
  }

  const { data: event, error: eventError } = await client
    .from("events")
    .select(
      "id, name, image_url, event_date, event_time, venue_name, venue_address, city"
    )
    .eq("id", order.event_id)
    .single();

  if (eventError || !event) {
    throw new Error(
      eventError?.message ??
        `Event ${order.event_id} associated with order ${orderId} was not found.`
    );
  }

  let ticketQuery = client
    .from("tickets")
    .select(
      "id, order_id, attendee_name, attendee_email, price, fee_total, qr_token, qr_signature, qr_code_url, ticket_type_id, ticket_types(name)"
    )
    .eq("order_id", order.id);

  if (ticketId) {
    ticketQuery = ticketQuery.eq("id", ticketId);
  }

  const { data: ticketsData, error: ticketsError } = await ticketQuery;

  if (ticketsError || !ticketsData || ticketsData.length === 0) {
    throw new Error(
      ticketsError?.message ??
        (ticketId
          ? `Ticket ${ticketId} was not found for order ${orderId}.`
          : `No tickets found for order ${orderId}.`)
    );
  }

  const ticketPayloads: TicketData[] = ticketsData.map((ticket) => ({
    ticketId: ticket.qr_token ?? ticket.id,
    qrToken: ticket.qr_token ?? ticket.id,
    qrSignature: ticket.qr_signature ?? "",
    qrCodeDataUrl: ticket.qr_code_url ?? "",
    qrCodeUrl: ticket.qr_code_url ?? "",
    eventId: event.id,
    eventImage: event.image_url || "",
    eventName: event.name,
    eventDate: event.event_date,
    eventTime: event.event_time,
    venue: event.venue_name || "",
    venueAddress: event.venue_address || event.city || "",
    ticketType:
      ticket.ticket_types?.name ?? ticket.ticket_type_id ?? "General Admission",
    ticketHolderName:
      ticket.attendee_name ??
      order.purchaser_name ??
      "Ticket Holder",
    orderId: order.id,
    price:
      Number(ticket.price ?? 0) + Number(ticket.fee_total ?? 0),
  }));

  const subject =
    ticketPayloads.length === 1
      ? `Your ticket for ${ticketPayloads[0].eventName}`
      : `Your tickets for ${ticketPayloads[0].eventName}`;

  const customerName =
    order.purchaser_name ||
    ticketPayloads[0].ticketHolderName ||
    "Guest";

  const recipients = new Set<string>();
  if (ticketId && ticketsData[0]?.attendee_email) {
    recipients.add(ticketsData[0].attendee_email);
  }
  if (order.purchaser_email) {
    recipients.add(order.purchaser_email);
  }

  if (!recipients.size) {
    throw new Error(
      "No recipient email found for this order. Ensure purchaser_email or attendee_email is set."
    );
  }

  await sendEmailViaResend({
    to: Array.from(recipients),
    subject,
    html: generateTicketEmailHTML(
      ticketPayloads,
      customerName,
      order.id,
      getFrontendUrl()
    ),
    text: generateTicketEmailText(
      ticketPayloads,
      customerName,
      order.id,
      getFrontendUrl()
    ),
  });
}

/**
 * Placeholder: request Stripe refund or mark order as refunded.
 * TODO: integrate with Stripe or payment provider.
 */
export async function requestRefund(orderId: string): Promise<void> {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (!apiUrl) {
    throw new Error(
      "VITE_API_URL is not configured. Cannot initiate refund workflow."
    );
  }

  const response = await fetch(`${apiUrl}/orders/${orderId}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    let message = `Failed to request refund (status ${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody?.message) {
        message = errorBody.message;
      } else if (errorBody?.error) {
        message = errorBody.error;
      }
    } catch {
      // ignore JSON parsing errors
    }
    throw new Error(message);
  }

  // Backend is responsible for Stripe refund and updating order status.
}

export interface OrdersQueryOptions {
  limit?: number;
  offset?: number;
  status?: string;
}

export interface AdminOrderRow {
  id: string;
  purchaser_email: string;
  purchaser_name: string | null;
  total: number;
  status: string;
  created_at: string;
}

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
 * Extended order row with event info for paginated results
 */
export interface PaginatedOrderRow extends AdminOrderRow {
  event_id: string;
  event?: {
    id: string;
    name: string;
    event_date: string;
  } | null;
  ticket_count?: number;
}

/**
 * Filter options for paginated order queries
 */
export interface OrderFilters {
  /** Filter by order status */
  status?: string | null;
  /** Filter by event ID */
  eventId?: string | null;
  /** Filter by purchaser email (partial match) */
  email?: string | null;
  /** Filter by date range - start */
  dateFrom?: string | null;
  /** Filter by date range - end */
  dateTo?: string | null;
}

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

export interface TicketsQueryOptions {
  status?: "all" | "scanned" | "pending" | "refunded";
  limit?: number;
  offset?: number;
}

export interface AdminTicketRow {
  id: string;
  order_id: string;
  attendee_name: string | null;
  attendee_email: string | null;
  status: string;
  issued_at: string | null;
  scanned_at: string | null;
  qr_token: string | null;
  ticket_type_id: string;
  events: { name: string } | null;
  ticket_types: { name: string } | null;
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

export interface DashboardStats {
  totalEvents: number;
  totalOrders: number;
  totalRevenue: number;
  ticketsIssued: number;
  ticketsScanned: number;
}

export async function getDashboardStats(
  client: SupabaseTypedClient = supabase
): Promise<DashboardStats> {
  const [eventsRes, ordersRes, ticketsRes] = await Promise.all([
    client.from("events").select("id", { count: "exact", head: true }),
    client
      .from("orders")
      .select("total, status", { count: "exact" }),
    client
      .from("tickets")
      .select("status"),
  ]);

  if (eventsRes.error) {
    throw eventsRes.error;
  }
  if (ordersRes.error) {
    throw ordersRes.error;
  }
  if (ticketsRes.error) {
    throw ticketsRes.error;
  }

  const totalRevenue =
    ordersRes.data?.reduce((sum, order) => {
      const value = Number((order as any).total ?? 0);
      return sum + value;
    }, 0) ?? 0;

  const ticketsIssued = ticketsRes.data?.length ?? 0;
  const ticketsScanned =
    ticketsRes.data?.filter((ticket) => ticket.status === "scanned")
      .length ?? 0;

  return {
    totalEvents: eventsRes.count ?? 0,
    totalOrders: ordersRes.count ?? 0,
    totalRevenue,
    ticketsIssued,
    ticketsScanned,
  };
}

export interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  totalTicketsIssued: number;
  totalTicketsScanned: number;
}

export interface OrderReportRow {
  orderId: string;
  purchaserName: string | null;
  purchaserEmail: string | null;
  total: number;
  status: string;
  created_at: string;
  ticketCount: number;
}

export interface SummaryRange {
  start?: string;
  end?: string;
}

export async function getOrderSummary(
  range?: SummaryRange
): Promise<OrderSummary> {
  const filters = (query: any) => {
    if (range?.start) query = query.gte("created_at", range.start);
    if (range?.end) query = query.lte("created_at", range.end);
    return query;
  };

  const [ordersRes, ticketsRes] = await Promise.all([
    filters(
      supabase
        .from("orders")
        .select("id,total,created_at", { count: "exact" })
    ),
    supabase.from("tickets").select("status"),
  ]);

  if (ordersRes.error) {
    console.error("getOrderSummary orders error:", ordersRes.error);
  }
  if (ticketsRes.error) {
    console.error("getOrderSummary tickets error:", ticketsRes.error);
  }

  const orders = ordersRes.data ?? [];
  const tickets = ticketsRes.data ?? [];

  const totalRevenue = orders.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const ticketsIssued = tickets.length;
  const ticketsScanned = tickets.filter((t) => t.status === "scanned").length;

  return {
    totalOrders: ordersRes.count ?? 0,
    totalRevenue,
    totalTicketsIssued: ticketsIssued,
    totalTicketsScanned: ticketsScanned,
  };
}

export async function getOrderReportRows(
  range?: SummaryRange
): Promise<OrderReportRow[]> {
  let query = supabase
    .from("orders")
    .select("id, purchaser_name, purchaser_email, total, status, created_at, tickets(id)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(100);

  if (range?.start) query = query.gte("created_at", range.start);
  if (range?.end) query = query.lte("created_at", range.end);

  const { data, error } = await query;
  if (error) {
    console.error("getOrderReportRows error:", error);
    return [];
  }

  return (
    data?.map((row) => ({
      orderId: row.id,
      purchaserName: row.purchaser_name,
      purchaserEmail: row.purchaser_email,
      total: row.total ?? 0,
      status: row.status ?? "unknown",
      created_at: row.created_at,
      ticketCount: row.tickets?.length ?? 0,
    })) ?? []
  );
}

export interface UserTicket {
  id: string;
  ticket_id: string;
  order_id: string;
  event_id: string;
  event_name: string;
  event_image: string | null;
  event_date: string;
  event_time: string;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  ticket_type: string;
  ticket_type_name: string;
  ticket_category?: 'general' | 'vip' | 'service' | 'section';
  section_name?: string | null;
  section_description?: string | null;
  status: string;
  price: number;
  fee: number;
  total: number;
  attendee_name: string | null;
  attendee_email: string | null;
  issued_at: string;
  checked_in_at: string | null;
  expires_at: string;
  qr_code_url: string | null;
  qr_code_value: string | null;
}

/**
 * Get all tickets for a user (by email or user ID)
 */
export async function getUserTickets(
  userEmail: string,
  userId?: string | null
): Promise<UserTicket[]> {
  try {
    // Query tickets directly by attendee_email (matches RLS policy requirement)
    // RLS policy: attendee_email = current_setting('request.jwt.claims')::json->>'email'
    // This bypasses the orders table RLS check and queries tickets directly
    // Query tickets WITHOUT orders join to avoid RLS policy issues
    // The orders RLS policy queries auth.users which regular users can't access
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        events (
          id,
          name,
          image_url,
          event_date,
          event_time,
          venue_name,
          venue_address,
          city
        ),
        ticket_types (
          code,
          name,
          description
        )
      `)
      .eq('attendee_email', userEmail) // RLS policy requires this to match logged-in user's email
      .order('issued_at', { ascending: false });

    if (error) {
      console.error('[getUserTickets] Error fetching tickets:', error);
      console.error('[getUserTickets] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map to UserTicket interface (handle nested structure from joins)
    // Note: orders join removed to avoid RLS policy issues
    return data.map((item: any) => {
      const event = item.events || {};
      const ticketType = item.ticket_types || {};
      
      // Derive category from ticket_type code
      const category = ticketType.code === 'VIP' ? 'vip' : 
                      ticketType.code === 'GA' ? 'general' : 'general';
      
      return {
        id: item.id || item.ticket_id,
        ticket_id: item.ticket_id,
        order_id: item.order_id,
        event_id: item.event_id,
        event_name: event.name || '',
        event_image: event.image_url || null,
        event_date: event.event_date || '',
        event_time: event.event_time || '',
        venue_name: event.venue_name || null,
        venue_address: event.venue_address || null,
        city: event.city || null,
        ticket_type: item.ticket_type || ticketType.code || '',
        ticket_type_name: item.ticket_type_name || ticketType.name || '',
        ticket_category: category,
        section_name: ticketType.name || null,
        section_description: ticketType.description || null,
        status: item.status || 'issued',
        price: typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0),
        fee: typeof item.fee === 'string' ? parseFloat(item.fee) : (item.fee || 0),
        total: typeof item.total === 'string' ? parseFloat(item.total) : (item.total || 0),
        attendee_name: item.attendee_name || null, // No order join, use ticket's attendee_name
        attendee_email: item.attendee_email || userEmail, // Use ticket's attendee_email or fallback to userEmail
        issued_at: item.issued_at || item.created_at,
        checked_in_at: item.checked_in_at || null,
        expires_at: item.expires_at || item.event_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default to 30 days from now if not set
        qr_code_url: item.qr_code_url || null,
        qr_code_value: item.qr_code_value || item.ticket_id || null,
      };
    });
  } catch (error) {
    console.error('Error in getUserTickets:', error);
    return [];
  }
}

/**
 * Get a single ticket by ticket_id
 */
export async function getTicketById(ticketId: string): Promise<UserTicket | null> {
  try {
    // Query ticket WITHOUT orders join to avoid RLS policy issues
    // The orders RLS policy queries auth.users which regular users can't access
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        events (
          id,
          name,
          image_url,
          event_date,
          event_time,
          venue_name,
          venue_address,
          city
        ),
        ticket_types (
          code,
          name,
          description
        )
      `)
      .eq('ticket_id', ticketId)
      .single();

    if (error || !data) {
      console.error('[getTicketById] Error fetching ticket:', error);
      if (error) {
        console.error('[getTicketById] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }
      return null;
    }

    const event = data.events || {};
    const ticketType = data.ticket_types || {};
    
    // Derive category from ticket_type code
    const category = ticketType.code === 'VIP' ? 'vip' : 
                    ticketType.code === 'GA' ? 'general' : 'general';

    return {
      id: data.id || data.ticket_id,
      ticket_id: data.ticket_id,
      order_id: data.order_id,
      event_id: data.event_id,
      event_name: event.name || '',
      event_image: event.image_url || null,
      event_date: event.event_date || '',
      event_time: event.event_time || '',
      venue_name: event.venue_name || null,
      venue_address: event.venue_address || null,
      city: event.city || null,
      ticket_type: data.ticket_type || ticketType.code || '',
      ticket_type_name: data.ticket_type_name || ticketType.name || '',
      ticket_category: category,
      section_name: ticketType.name || null,
      section_description: ticketType.description || null,
      status: data.status || 'issued',
      price: typeof data.price === 'string' ? parseFloat(data.price) : (data.price || 0),
      fee: typeof data.fee === 'string' ? parseFloat(data.fee) : (data.fee || 0),
      total: typeof data.total === 'string' ? parseFloat(data.total) : (data.total || 0),
      attendee_name: data.attendee_name || null, // No order join, use ticket's attendee_name
      attendee_email: data.attendee_email || null, // Use ticket's attendee_email
      issued_at: data.issued_at || data.created_at,
      checked_in_at: data.checked_in_at || null,
      expires_at: data.expires_at || data.event_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      qr_code_url: data.qr_code_url || null,
      qr_code_value: data.qr_code_value || data.ticket_id || null,
    };
  } catch (error) {
    console.error('Error in getTicketById:', error);
    return null;
  }
}


