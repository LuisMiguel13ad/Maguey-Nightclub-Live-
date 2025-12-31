/**
 * Order Creation Saga
 * 
 * Implements the order creation flow using the Saga pattern.
 * Each step has a corresponding compensation action that will be
 * executed in reverse order if a later step fails.
 * 
 * Flow:
 * 1. Load Event Data (no compensation needed)
 * 2. Reserve Inventory → Release Inventory
 * 3. Create Order Record → Cancel Order
 * 4. Generate Tickets → Cancel Tickets
 * 5. Send Confirmation Email (no compensation - idempotent)
 * 6. Update Waitlist (no compensation - idempotent)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase, type Order } from "../supabase";
import { createTicketData, type TicketData, generateQrImage } from "../ticket-generator";
import { generateTicketEmailHTML, generateTicketEmailText } from "../email-template";
import { createLogger } from "../logger";
import { startTimer, trackDbQuery, trackEmailSent, metrics } from "../monitoring";
import { 
  SagaOrchestrator, 
  SagaBuilder, 
  noOpCompensation,
  type SagaStep,
  type SagaResult,
  type SagaExecution,
} from "./saga-engine";

// ============================================
// TYPES
// ============================================

export interface OrderLineItem {
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  unitFee: number;
  displayName: string;
}

export interface OrderSagaInput {
  eventId: string;
  purchaserEmail: string;
  purchaserName: string;
  purchaserUserId?: string | null;
  lineItems: OrderLineItem[];
  metadata?: Record<string, unknown>;
  ticketHolderName?: string;
  promoCodeId?: string | null;
}

export interface OrderSagaContext {
  // Input
  input: OrderSagaInput;
  client: SupabaseClient<any>;
  qrSigningSecret: string;
  frontendUrl: string;
  
  // Computed
  totals?: {
    subtotal: number;
    fees: number;
    total: number;
  };
  lineItemsJson?: Array<{
    ticket_type_id: string;
    quantity: number;
    unit_price: number;
    unit_fee: number;
    display_name: string;
  }>;
  
  // Step outputs
  event?: {
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
  reservationId?: string;
  reservedTickets?: Array<{
    ticket_type_id: string;
    quantity: number;
  }>;
  order?: Order;
  ticketsData?: any[];
  emailPayloads?: any[];
  ticketEmailPayloads?: TicketData[];
  emailSent?: boolean;
  waitlistConverted?: boolean;
  
  // Error tracking
  failureReason?: string;
}

export interface OrderSagaResult {
  success: boolean;
  order?: Order;
  lineItems: OrderLineItem[];
  ticketEmailPayloads: TicketData[];
  sagaId: string;
  durationMs: number;
  error?: Error;
  compensatedSteps?: string[];
}

// ============================================
// LOGGER
// ============================================

const logger = createLogger({ module: 'order-saga' });

// ============================================
// SAGA STEPS
// ============================================

/**
 * Step 1: Load Event Data
 * No compensation needed - just a read operation
 */
const LoadEventStep: SagaStep<OrderSagaContext> = {
  name: 'LoadEvent',
  
  async execute(context: OrderSagaContext): Promise<OrderSagaContext> {
    const stepLogger = logger.child({ step: 'LoadEvent', eventId: context.input.eventId });
    const timer = startTimer();
    
    const { data: event, error } = await context.client
      .from("events")
      .select("id, name, description, image_url, event_date, event_time, venue_name, venue_address, city")
      .eq("id", context.input.eventId)
      .single();
    
    trackDbQuery('select', timer(), !error, 'events');
    
    if (error || !event) {
      stepLogger.error('Failed to load event', error);
      throw new Error(`Event not found: ${context.input.eventId}`);
    }
    
    stepLogger.debug('Event loaded', { eventName: event.name });
    
    // Calculate totals
    const totals = context.input.lineItems.reduce(
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
    
    // Prepare line items for database
    const lineItemsJson = context.input.lineItems.map((line) => ({
      ticket_type_id: line.ticketTypeId,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      unit_fee: line.unitFee,
      display_name: line.displayName,
    }));
    
    return {
      ...context,
      event,
      totals,
      lineItemsJson,
    };
  },
  
  async compensate(): Promise<void> {
    // No compensation needed for read operation
  },
};

/**
 * Step 2: Reserve Inventory
 * Compensation: Release the reserved tickets
 */
const ReserveInventoryStep: SagaStep<OrderSagaContext> = {
  name: 'ReserveInventory',
  
  async execute(context: OrderSagaContext): Promise<OrderSagaContext> {
    const stepLogger = logger.child({ step: 'ReserveInventory' });
    const timer = startTimer();
    
    if (!context.lineItemsJson) {
      throw new Error('Line items not prepared');
    }
    
    // Call the reservation RPC
    // This atomically checks and reserves tickets
    const { data, error } = await context.client.rpc('check_and_reserve_tickets', {
      p_event_id: context.input.eventId,
      p_line_items: context.lineItemsJson,
    });
    
    trackDbQuery('rpc', timer(), !error, 'check_and_reserve_tickets');
    
    if (error) {
      stepLogger.error('Failed to reserve inventory', error);
      
      // Check for specific error types
      if (error.message?.includes('Not enough tickets') || 
          error.message?.includes('Insufficient inventory')) {
        throw new Error(`Insufficient inventory: ${error.message}`);
      }
      
      throw new Error(`Inventory reservation failed: ${error.message}`);
    }
    
    stepLogger.debug('Inventory reserved', { reservationId: data?.reservation_id });
    
    return {
      ...context,
      reservationId: data?.reservation_id,
      reservedTickets: context.lineItemsJson.map(item => ({
        ticket_type_id: item.ticket_type_id,
        quantity: item.quantity,
      })),
    };
  },
  
  async compensate(context: OrderSagaContext): Promise<void> {
    const stepLogger = logger.child({ step: 'ReserveInventory', action: 'compensate' });
    
    if (!context.reservationId && !context.reservedTickets) {
      stepLogger.debug('No reservation to release');
      return;
    }
    
    try {
      const timer = startTimer();
      
      // Release the reserved tickets
      const { error } = await context.client.rpc('release_reserved_tickets', {
        p_event_id: context.input.eventId,
        p_reservation_id: context.reservationId,
        p_line_items: context.lineItemsJson,
      });
      
      trackDbQuery('rpc', timer(), !error, 'release_reserved_tickets');
      
      if (error) {
        stepLogger.warn('Failed to release inventory', error);
        // Don't throw - compensation should be best-effort
      } else {
        stepLogger.info('Inventory released successfully');
      }
      
    } catch (error) {
      stepLogger.warn('Error during inventory release', { error });
    }
  },
};

/**
 * Step 3: Create Order Record
 * Compensation: Cancel the order (set status to 'cancelled')
 */
const CreateOrderStep: SagaStep<OrderSagaContext> = {
  name: 'CreateOrder',
  
  async execute(context: OrderSagaContext): Promise<OrderSagaContext> {
    const stepLogger = logger.child({ step: 'CreateOrder' });
    const timer = startTimer();
    
    if (!context.totals) {
      throw new Error('Totals not calculated');
    }
    
    // Create order record
    const { data: order, error } = await context.client
      .from('orders')
      .insert({
        event_id: context.input.eventId,
        purchaser_email: context.input.purchaserEmail,
        purchaser_name: context.input.purchaserName,
        user_id: context.input.purchaserUserId ?? null,
        subtotal: context.totals.subtotal,
        fees_total: context.totals.fees,
        total: context.totals.total,
        status: 'pending', // Will be updated to 'paid' after tickets are created
        metadata: context.input.metadata ?? {},
        promo_code_id: context.input.promoCodeId ?? null,
      })
      .select()
      .single();
    
    trackDbQuery('insert', timer(), !error, 'orders');
    
    if (error || !order) {
      stepLogger.error('Failed to create order', error);
      throw new Error(`Order creation failed: ${error?.message ?? 'Unknown error'}`);
    }
    
    stepLogger.info('Order created', { orderId: order.id });
    
    return {
      ...context,
      order: order as Order,
    };
  },
  
  async compensate(context: OrderSagaContext): Promise<void> {
    const stepLogger = logger.child({ step: 'CreateOrder', action: 'compensate' });
    
    if (!context.order?.id) {
      stepLogger.debug('No order to cancel');
      return;
    }
    
    try {
      const timer = startTimer();
      
      // Cancel the order
      const { error } = await context.client
        .from('orders')
        .update({ 
          status: 'cancelled',
          metadata: {
            ...(context.order.metadata as Record<string, unknown> || {}),
            cancelled_at: new Date().toISOString(),
            cancelled_reason: 'saga_compensation',
            failure_reason: context.failureReason,
          }
        })
        .eq('id', context.order.id);
      
      trackDbQuery('update', timer(), !error, 'orders');
      
      if (error) {
        stepLogger.warn('Failed to cancel order', error);
      } else {
        stepLogger.info('Order cancelled', { orderId: context.order.id });
      }
      
    } catch (error) {
      stepLogger.warn('Error during order cancellation', { error });
    }
  },
};

/**
 * Step 4: Generate Tickets
 * Compensation: Cancel all tickets (set status to 'cancelled')
 * 
 * OPTIMIZED: Uses batched operations instead of N+1 queries
 * - Prepares all ticket data synchronously first
 * - Generates all QR codes in parallel using Promise.all
 * - Inserts all tickets in a single batch INSERT
 */
const GenerateTicketsStep: SagaStep<OrderSagaContext> = {
  name: 'GenerateTickets',
  
  async execute(context: OrderSagaContext): Promise<OrderSagaContext> {
    const stepLogger = logger.child({ step: 'GenerateTickets', orderId: context.order?.id });
    
    if (!context.order || !context.event) {
      throw new Error('Order or event not available');
    }
    
    const issuedAt = new Date().toISOString();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const shortOrderId = context.order.id.slice(0, 8).toUpperCase();
    
    // ============================================
    // PHASE 1: Prepare all ticket data (synchronous, no N+1)
    // ============================================
    interface TicketPrepData {
      lineItem: typeof context.input.lineItems[0];
      index: number;
      ticketId: string;
    }
    
    const ticketsToCreate: TicketPrepData[] = [];
    let ticketIndex = 0;
    
    // Flatten line items into individual tickets (synchronous)
    for (const lineItem of context.input.lineItems) {
      for (let i = 0; i < lineItem.quantity; i++) {
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const ticketId = `MGY-${context.event.id.slice(0, 2).toUpperCase()}-${dateStr}-${shortOrderId}-${randomSuffix}`;
        
        ticketsToCreate.push({
          lineItem,
          index: ticketIndex,
          ticketId,
        });
        
        ticketIndex++;
      }
    }
    
    stepLogger.debug('Preparing tickets', { ticketCount: ticketsToCreate.length });
    
    // ============================================
    // PHASE 2: Generate all ticket data and QR codes in PARALLEL
    // This fixes the N+1 problem by using Promise.all
    // ============================================
    const ticketDataPromises = ticketsToCreate.map(async ({ lineItem, ticketId }) => {
      // Create ticket data (includes QR token generation)
      const ticketData = await createTicketData({
        eventId: context.event!.id,
        eventImage: context.event!.image_url || "",
        eventName: context.event!.name,
        eventDate: context.event!.event_date,
        eventTime: context.event!.event_time,
        venue: context.event!.venue_name || "",
        venueAddress: context.event!.venue_address || context.event!.city || "",
        ticketType: lineItem.displayName,
        ticketHolderName: context.input.ticketHolderName ?? context.input.purchaserName ?? "",
        orderId: context.order!.id,
        price: lineItem.unitPrice + lineItem.unitFee,
      });
      
      // Generate QR code image
      const qrPayload = JSON.stringify({
        token: ticketData.qrToken,
        signature: ticketData.qrSignature,
        meta: {
          eventId: context.event!.id,
          orderId: context.order!.id,
          ticketType: lineItem.displayName,
        },
      });
      
      const qrCodeDataUrl = await generateQrImage(qrPayload);
      
      return {
        ticketData,
        qrCodeDataUrl,
        ticketId,
        lineItem,
      };
    });
    
    // Wait for ALL ticket data and QR codes to be generated in parallel
    const generatedTickets = await Promise.all(ticketDataPromises);
    
    stepLogger.debug('Ticket data generated in parallel', { 
      ticketCount: generatedTickets.length 
    });
    
    // ============================================
    // PHASE 3: Build ticket rows and email payloads
    // ============================================
    const ticketEmailPayloads: TicketData[] = [];
    const ticketRows: Record<string, unknown>[] = [];
    
    for (const { ticketData, qrCodeDataUrl, ticketId, lineItem } of generatedTickets) {
      ticketEmailPayloads.push({
        ...ticketData,
        qrCodeDataUrl,
        qrCodeUrl: qrCodeDataUrl,
      });
      
      ticketRows.push({
        qr_token: ticketData.qrToken,
        event_id: context.event.id,
        ticket_type_id: lineItem.ticketTypeId,
        attendee_name: context.input.ticketHolderName ?? context.input.purchaserName ?? "",
        attendee_email: context.input.purchaserEmail,
        order_id: context.order.id,
        status: "issued",
        issued_at: issuedAt,
        price: lineItem.unitPrice,
        fee_total: lineItem.unitFee,
        qr_signature: ticketData.qrSignature,
        qr_code_url: qrCodeDataUrl,
        qr_code_value: ticketData.qrToken,
        ticket_id: ticketId,
      });
    }
    
    // ============================================
    // PHASE 4: Single batch INSERT for all tickets
    // ============================================
    const timer = startTimer();
    const { data: insertedTickets, error } = await context.client
      .from('tickets')
      .insert(ticketRows)
      .select();
    
    trackDbQuery('insert', timer(), !error, 'tickets');
    
    if (error) {
      stepLogger.error('Failed to create tickets', error);
      throw new Error(`Ticket creation failed: ${error.message}`);
    }
    
    // Update order status to 'paid'
    const updateTimer = startTimer();
    const { error: updateError } = await context.client
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', context.order.id);
    
    trackDbQuery('update', updateTimer(), !updateError, 'orders');
    
    if (updateError) {
      stepLogger.warn('Failed to update order status', updateError);
      // Continue anyway - tickets were created
    }
    
    stepLogger.info('Tickets generated (batched)', { 
      ticketCount: ticketEmailPayloads.length,
      orderId: context.order.id,
    });
    
    return {
      ...context,
      ticketsData: insertedTickets,
      ticketEmailPayloads,
    };
  },
  
  async compensate(context: OrderSagaContext): Promise<void> {
    const stepLogger = logger.child({ step: 'GenerateTickets', action: 'compensate' });
    
    if (!context.order?.id) {
      stepLogger.debug('No order to cancel tickets for');
      return;
    }
    
    try {
      const timer = startTimer();
      
      // Cancel all tickets for this order
      const { error } = await context.client
        .from('tickets')
        .update({ 
          status: 'cancelled',
        })
        .eq('order_id', context.order.id);
      
      trackDbQuery('update', timer(), !error, 'tickets');
      
      if (error) {
        stepLogger.warn('Failed to cancel tickets', error);
      } else {
        stepLogger.info('Tickets cancelled', { orderId: context.order.id });
      }
      
    } catch (error) {
      stepLogger.warn('Error during ticket cancellation', { error });
    }
  },
};

/**
 * Step 5: Send Confirmation Email
 * No compensation needed - emails are idempotent
 */
const SendEmailStep: SagaStep<OrderSagaContext> = {
  name: 'SendEmail',
  critical: false, // Email failure should not fail the order
  
  async execute(context: OrderSagaContext): Promise<OrderSagaContext> {
    const stepLogger = logger.child({ step: 'SendEmail', orderId: context.order?.id });
    
    if (!context.order || !context.ticketEmailPayloads?.length) {
      stepLogger.debug('No tickets to email');
      return { ...context, emailSent: false };
    }
    
    const apiKey = import.meta.env.VITE_EMAIL_API_KEY;
    const fromAddress = import.meta.env.VITE_EMAIL_FROM_ADDRESS;
    
    // Skip if email not configured
    if (!apiKey || !fromAddress) {
      stepLogger.debug('Email service not configured, skipping');
      metrics.increment('emails.skipped', 1, { reason: 'not_configured' });
      return { ...context, emailSent: false };
    }
    
    const timer = startTimer();
    
    try {
      const subject = context.ticketEmailPayloads.length === 1
        ? `Your ticket for ${context.ticketEmailPayloads[0].eventName}`
        : `Your tickets for ${context.ticketEmailPayloads[0].eventName}`;
      
      const customerName = context.input.purchaserName || 'Guest';
      
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [context.input.purchaserEmail],
          subject,
          html: generateTicketEmailHTML(
            context.ticketEmailPayloads,
            customerName,
            context.order.id,
            context.frontendUrl
          ),
          text: generateTicketEmailText(
            context.ticketEmailPayloads,
            customerName,
            context.order.id,
            context.frontendUrl
          ),
        }),
      });
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Email API error: ${response.status}`);
      }
      
      trackEmailSent('ticket', true, timer());
      stepLogger.info('Email sent successfully');
      
      return { ...context, emailSent: true };
      
    } catch (error) {
      trackEmailSent('ticket', false, timer());
      stepLogger.warn('Failed to send email', { error });
      // Don't throw - email is non-critical
      return { ...context, emailSent: false };
    }
  },
  
  compensate: noOpCompensation<OrderSagaContext>(),
};

/**
 * Step 6: Update Waitlist
 * No compensation needed - waitlist conversion is idempotent
 */
const UpdateWaitlistStep: SagaStep<OrderSagaContext> = {
  name: 'UpdateWaitlist',
  critical: false, // Waitlist update failure should not fail the order
  
  async execute(context: OrderSagaContext): Promise<OrderSagaContext> {
    const stepLogger = logger.child({ step: 'UpdateWaitlist' });
    
    if (!context.event) {
      return { ...context, waitlistConverted: false };
    }
    
    try {
      const { autoConvertWaitlistEntry } = await import('../waitlist-service');
      
      const converted = await autoConvertWaitlistEntry(
        context.event.name,
        context.input.purchaserEmail
      );
      
      if (converted) {
        stepLogger.info('Waitlist entry converted');
      }
      
      return { ...context, waitlistConverted: !!converted };
      
    } catch (error) {
      stepLogger.warn('Failed to convert waitlist entry', { error });
      // Don't throw - waitlist update is non-critical
      return { ...context, waitlistConverted: false };
    }
  },
  
  compensate: noOpCompensation<OrderSagaContext>(),
};

// ============================================
// ORDER SAGA
// ============================================

/**
 * Create the order saga orchestrator
 */
export function createOrderSaga(): SagaOrchestrator<OrderSagaContext> {
  return new SagaOrchestrator<OrderSagaContext>(
    [
      LoadEventStep,
      ReserveInventoryStep,
      CreateOrderStep,
      GenerateTicketsStep,
      SendEmailStep,
      UpdateWaitlistStep,
    ],
    'OrderCreation'
  );
}

/**
 * Alternative: Create using the fluent builder API
 */
export function createOrderSagaWithBuilder(): SagaOrchestrator<OrderSagaContext> {
  return SagaBuilder.create<OrderSagaContext>('OrderCreation')
    .step('LoadEvent', LoadEventStep.execute, LoadEventStep.compensate)
    .step('ReserveInventory', ReserveInventoryStep.execute, ReserveInventoryStep.compensate)
    .step('CreateOrder', CreateOrderStep.execute, CreateOrderStep.compensate)
    .step('GenerateTickets', GenerateTicketsStep.execute, GenerateTicketsStep.compensate)
    .optionalStep('SendEmail', SendEmailStep.execute, SendEmailStep.compensate)
    .optionalStep('UpdateWaitlist', UpdateWaitlistStep.execute, UpdateWaitlistStep.compensate)
    .build();
}

// ============================================
// SAGA EXECUTION HELPER
// ============================================

/**
 * Execute the order creation saga
 */
export async function executeOrderSaga(
  input: OrderSagaInput,
  options?: {
    client?: SupabaseClient<any>;
    onStateChange?: (execution: SagaExecution<unknown>) => void | Promise<void>;
  }
): Promise<OrderSagaResult> {
  const sagaLogger = logger.child({ 
    eventId: input.eventId, 
    email: input.purchaserEmail,
  });
  
  const saga = createOrderSaga();
  
  const initialContext: OrderSagaContext = {
    input,
    client: options?.client ?? supabase,
    qrSigningSecret: import.meta.env.VITE_QR_SIGNING_SECRET || 
      'your-super-secret-key-change-this-in-production-12345',
    frontendUrl: import.meta.env.VITE_FRONTEND_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'),
  };
  
  sagaLogger.info('Executing order saga', {
    ticketCount: input.lineItems.reduce((sum, l) => sum + l.quantity, 0),
    lineItems: input.lineItems.length,
  });
  
  const result = await saga.execute(initialContext, {
    onStateChange: options?.onStateChange,
  });
  
  if (result.success) {
    sagaLogger.info('Order saga completed successfully', {
      orderId: result.context.order?.id,
      ticketCount: result.context.ticketEmailPayloads?.length,
      sagaId: result.sagaId,
      durationMs: result.durationMs,
    });
    
    return {
      success: true,
      order: result.context.order,
      lineItems: input.lineItems,
      ticketEmailPayloads: result.context.ticketEmailPayloads || [],
      sagaId: result.sagaId,
      durationMs: result.durationMs,
    };
  } else {
    sagaLogger.error('Order saga failed', {
      failedStep: result.failedStep,
      error: result.error?.message,
      compensatedSteps: result.compensatedSteps,
      sagaId: result.sagaId,
      durationMs: result.durationMs,
    });
    
    return {
      success: false,
      lineItems: input.lineItems,
      ticketEmailPayloads: [],
      sagaId: result.sagaId,
      durationMs: result.durationMs,
      error: result.error,
      compensatedSteps: result.compensatedSteps,
    };
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  LoadEventStep,
  ReserveInventoryStep,
  CreateOrderStep,
  GenerateTicketsStep,
  SendEmailStep,
  UpdateWaitlistStep,
};
