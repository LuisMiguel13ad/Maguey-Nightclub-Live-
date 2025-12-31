/**
 * Integration Test Helpers
 * 
 * Utility functions for creating test scenarios, simulating external services,
 * and checking database state during integration tests.
 */

import { supabase, type Order, type Ticket } from '../../lib/supabase';
import { createOrderWithTickets, type CreateOrderInput, type CreatedOrderResult } from '../../lib/orders-service';
import { createLogger } from '../../lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const logger = createLogger({ module: 'integration-test-helpers' });

// ============================================
// ORDER CREATION HELPERS
// ============================================

export interface CreateTestOrderOptions extends Partial<CreateOrderInput> {
  eventId: string;
  ticketTypeIds: string[];
  quantities?: number[];
  purchaserEmail?: string;
  purchaserName?: string;
  promoCodeId?: string | null;
}

/**
 * Create a complete test order with tickets
 * 
 * @param options - Order creation options
 * @returns Created order result
 */
export async function createTestOrder(
  options: CreateTestOrderOptions
): Promise<CreatedOrderResult> {
  const { eventId, ticketTypeIds, quantities, purchaserEmail, purchaserName, promoCodeId } = options;
  
  // Get ticket types to determine prices
  const { data: ticketTypes, error: ticketTypesError } = await supabase
    .from('ticket_types')
    .select('id, name, price, fee')
    .in('id', ticketTypeIds);
  
  if (ticketTypesError || !ticketTypes || ticketTypes.length !== ticketTypeIds.length) {
    throw new Error(`Failed to fetch ticket types: ${ticketTypesError?.message || 'Not all ticket types found'}`);
  }
  
  const lineItems = ticketTypes.map((tt, index) => ({
    ticketTypeId: tt.id,
    quantity: quantities?.[index] || 1,
    unitPrice: tt.price,
    unitFee: tt.fee || 0,
    displayName: tt.name,
  }));
  
  const input: CreateOrderInput = {
    eventId,
    purchaserEmail: purchaserEmail || `test_${Date.now()}@example.com`,
    purchaserName: purchaserName || 'Test Purchaser',
    lineItems,
    promoCodeId: promoCodeId || null,
    ...options,
  };
  
  try {
    const result = await createOrderWithTickets(input);
    return result;
  } catch (error) {
    throw new Error(`Failed to create test order: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================
// DATABASE STATE HELPERS
// ============================================

export interface OrderWithTickets {
  order: Order;
  tickets: Ticket[];
}

/**
 * Get order with all associated tickets
 * 
 * @param orderId - Order ID
 * @returns Order with tickets
 */
export async function getOrderWithTickets(orderId: string): Promise<OrderWithTickets> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  
  if (orderError || !order) {
    throw new Error(`Order not found: ${orderError?.message || 'Unknown error'}`);
  }
  
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .eq('order_id', orderId);
  
  if (ticketsError) {
    throw new Error(`Failed to fetch tickets: ${ticketsError.message}`);
  }
  
  return {
    order,
    tickets: tickets || [],
  };
}

/**
 * Get ticket type availability
 * 
 * @param ticketTypeId - Ticket type ID
 * @returns Availability information
 */
export async function getTicketTypeAvailability(ticketTypeId: string): Promise<{
  totalInventory: number | null;
  ticketsSold: number;
  available: number | null;
}> {
  const { data: ticketType, error } = await supabase
    .from('ticket_types')
    .select('total_inventory, tickets_sold')
    .eq('id', ticketTypeId)
    .single();
  
  if (error || !ticketType) {
    throw new Error(`Ticket type not found: ${error?.message || 'Unknown error'}`);
  }
  
  const available = ticketType.total_inventory !== null
    ? ticketType.total_inventory - ticketType.tickets_sold
    : null;
  
  return {
    totalInventory: ticketType.total_inventory,
    ticketsSold: ticketType.tickets_sold,
    available,
  };
}

// ============================================
// STRIPE WEBHOOK SIMULATION
// ============================================

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, any>;
  };
  created: number;
}

/**
 * Generate a valid Stripe webhook signature
 * 
 * @param payload - Webhook payload (JSON string)
 * @param secret - Stripe webhook secret
 * @returns HMAC signature
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Simulate a Stripe webhook request
 * 
 * @param eventType - Stripe event type (e.g., 'payment_intent.succeeded')
 * @param data - Event data object
 * @param options - Additional options
 * @returns Simulated webhook response
 */
export async function simulateStripeWebhook(
  eventType: string,
  data: object,
  options: {
    secret?: string;
    timestamp?: number;
  } = {}
): Promise<{
  success: boolean;
  status: number;
  body: any;
  error?: string;
}> {
  const webhookSecret = options.secret || process.env.VITE_STRIPE_WEBHOOK_SECRET || 'test_webhook_secret';
  const timestamp = options.timestamp || Math.floor(Date.now() / 1000);
  
  const event: StripeWebhookEvent = {
    id: `evt_test_${Date.now()}`,
    type: eventType,
    data: {
      object: data,
    },
    created: timestamp,
  };
  
  const payload = JSON.stringify(event);
  const signature = generateWebhookSignature(payload, webhookSecret);
  
  // In a real integration test, you would call your actual webhook endpoint
  // For now, we return the simulated request data
  logger.debug('Simulated Stripe webhook', { eventType, signature: signature.substring(0, 20) + '...' });
  
  return {
    success: true,
    status: 200,
    body: {
      received: true,
      eventType,
      eventId: event.id,
    },
  };
}

// ============================================
// CONCURRENT REQUEST SIMULATION
// ============================================

export interface ConcurrentRequestResult {
  success: boolean;
  orderId?: string;
  error?: string;
  duration: number;
}

/**
 * Simulate concurrent purchase requests
 * Useful for testing race conditions and inventory management
 * 
 * @param count - Number of concurrent requests
 * @param ticketTypeId - Ticket type ID to purchase
 * @param quantity - Quantity per request
 * @returns Array of results
 */
export async function simulateConcurrentPurchases(
  count: number,
  ticketTypeId: string,
  quantity: number = 1
): Promise<ConcurrentRequestResult[]> {
  // Get event ID from ticket type
  const { data: ticketType, error: ticketTypeError } = await supabase
    .from('ticket_types')
    .select('event_id, price, fee, name')
    .eq('id', ticketTypeId)
    .single();
  
  if (ticketTypeError || !ticketType) {
    throw new Error(`Ticket type not found: ${ticketTypeError?.message || 'Unknown error'}`);
  }
  
  const eventId = ticketType.event_id;
  const timestamp = Date.now();
  
  // Create concurrent requests
  const requests = Array.from({ length: count }, (_, index) => {
    const startTime = Date.now();
    return createOrderWithTickets({
      eventId,
      purchaserEmail: `concurrent_${timestamp}_${index}@example.com`,
      purchaserName: `Concurrent User ${index}`,
      lineItems: [{
        ticketTypeId,
        quantity,
        unitPrice: ticketType.price,
        unitFee: ticketType.fee || 0,
        displayName: ticketType.name,
      }],
    }).then(result => {
      const duration = Date.now() - startTime;
      return {
        success: true,
        orderId: result.order.id,
        duration,
      } as ConcurrentRequestResult;
    }).catch(error => {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      } as ConcurrentRequestResult;
    });
  });
  
  return Promise.all(requests);
}

// ============================================
// PROMO CODE HELPERS
// ============================================

/**
 * Create a test promo code
 * 
 * @param code - Promo code string
 * @param discountType - 'amount' or 'percent'
 * @param amount - Discount amount
 * @param options - Additional options
 * @returns Created promo code ID
 */
export async function createTestPromoCode(
  code: string,
  discountType: 'amount' | 'percent',
  amount: number,
  options: {
    usageLimit?: number | null;
    validFrom?: string | null;
    validTo?: string | null;
  } = {}
): Promise<string> {
  const { data: promo, error } = await supabase
    .from('promotions')
    .insert({
      code,
      discount_type: discountType,
      amount,
      usage_limit: options.usageLimit ?? null,
      valid_from: options.validFrom || null,
      valid_to: options.validTo || null,
      active: true,
    })
    .select('id')
    .single();
  
  if (error || !promo) {
    throw new Error(`Failed to create promo code: ${error?.message || 'Unknown error'}`);
  }
  
  return promo.id;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate that a ticket has a valid QR code
 * 
 * @param ticket - Ticket object
 * @returns True if QR code is valid
 */
export function validateTicketQRCode(ticket: Ticket): boolean {
  return !!(
    ticket.qr_token &&
    ticket.qr_signature &&
    ticket.qr_token.length > 0 &&
    ticket.qr_signature.length > 0
  );
}

/**
 * Validate order totals match line items
 * 
 * @param order - Order object
 * @param tickets - Associated tickets
 * @returns True if totals match
 */
export function validateOrderTotals(order: Order, tickets: Ticket[]): boolean {
  const calculatedSubtotal = tickets.reduce((sum, t) => sum + t.price, 0);
  const calculatedFees = tickets.reduce((sum, t) => sum + t.fee_total, 0);
  const calculatedTotal = calculatedSubtotal + calculatedFees;
  
  // Allow small floating point differences
  const tolerance = 0.01;
  return (
    Math.abs(order.subtotal - calculatedSubtotal) < tolerance &&
    Math.abs(order.fees_total - calculatedFees) < tolerance &&
    Math.abs(order.total - calculatedTotal) < tolerance
  );
}
