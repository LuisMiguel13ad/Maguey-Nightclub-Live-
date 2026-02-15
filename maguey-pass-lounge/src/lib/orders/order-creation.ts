import { supabase, type Order } from "../supabase";
import type { TicketData } from "../ticket-generator";
import {
  AppError,
  EventNotFoundError,
  DatabaseError,
  ValidationError,
  InsufficientInventoryError,
  RateLimitError,
} from "../errors";
import { createLogger } from "../logger";
import {
  trackOrderCreation,
  trackDbQuery,
  startTimer,
  metrics,
} from "../monitoring";
import {
  executeOrderSaga,
  type OrderSagaInput,
  type OrderSagaResult,
} from "../sagas/order-saga";
import type { SagaExecution } from "../sagas/saga-engine";
import { cache, CacheKeys } from "../cache";
import { tracer, traceAsync, traceQuery, getCurrentTraceContext } from "../tracing";
import { errorTracker } from "../errors/error-tracker";
import { ErrorSeverity, ErrorCategory } from "../errors/error-types";
import { orderLimiter, getClientIdentifier } from "../rate-limiter";
import { ok, err, type AsyncResult } from "../result";
import type {
  CreateOrderInput,
  CreatedOrderResult,
  CreateOrderOptions,
  OrderLineItem,
  CreateOrderWithSagaOptions,
  CheckoutSelectionRecord,
  SupabaseTypedClient,
} from "./types";

// Create module-scoped logger
const logger = createLogger({ module: 'orders/order-creation' });

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

    // Call atomic transaction function
    // This function handles:
    // 1. Ticket reservation (atomic with locking)
    // 2. Order creation
    // 3. Ticket creation with QR tokens/signatures (signed server-side)
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
      const { generateQrImage } = await import('../ticket-generator');
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
        const { autoConvertWaitlistEntry } = await import('../waitlist-service');
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
  const {
    publishTicketIssued,
    generateCorrelationId,
    createEventMetadata
  } = await import('../events/ticket-events').then(m => ({
    ...m,
    generateCorrelationId: () => (m as any).generateCorrelationId?.() ?? crypto.randomUUID(),
    createEventMetadata: (opts: any) => (m as any).createEventMetadata?.(opts) ?? opts
  })).catch(() => ({
    publishTicketIssued: async () => {},
    generateCorrelationId: () => crypto.randomUUID(),
    createEventMetadata: (opts: any) => opts
  }));

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
      category: error instanceof Error && error.name === 'PaymentError' ? ErrorCategory.PAYMENT :
                error instanceof InsufficientInventoryError ? ErrorCategory.INVENTORY :
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

  // Call atomic transaction function (QR signing secret read server-side by DB)
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

    const { generateQrImage } = await import('../ticket-generator');
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
    const { autoConvertWaitlistEntry } = await import('../waitlist-service');
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
