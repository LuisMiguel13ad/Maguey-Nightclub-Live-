/**
 * Stripe Integration
 * Handles Stripe Checkout for ticket purchases
 * 
 * Includes circuit breaker protection to prevent cascading failures
 * when the Stripe API is experiencing issues.
 * 
 * Features:
 * - Circuit breaker pattern for resilience
 * - User-friendly error messages when payments unavailable
 * - Health check for payment service status
 * - Automatic retry coordination
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { stripeCircuit, CircuitBreakerError, type CircuitState } from './circuit-breaker';
import { createLogger } from './logger';
import { metrics } from './monitoring';

const logger = createLogger({ module: 'stripe' });
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

let stripePromise: Promise<Stripe | null>;

// ============================================
// Stripe Availability Types
// ============================================

export interface StripeAvailabilityStatus {
  available: boolean;
  circuitState: CircuitState;
  message: string;
  retryAfterMs?: number;
}

// ============================================
// Stripe Initialization
// ============================================

/**
 * Initialize Stripe
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePublishableKey) {
    logger.error('Stripe publishable key not found');
    return Promise.resolve(null);
  }

  if (!stripePromise) {
    stripePromise = loadStripe(stripePublishableKey);
  }
  return stripePromise;
}

/**
 * Check if Stripe/payment processing is currently available
 * Use this to show appropriate UI before attempting payment
 */
export function checkPaymentAvailability(): StripeAvailabilityStatus {
  // Check if Stripe is configured
  if (!stripePublishableKey) {
    return {
      available: false,
      circuitState: 'CLOSED',
      message: 'Payment system is not configured. Please contact support.',
    };
  }
  
  // Check circuit breaker state
  const stats = stripeCircuit.getStats();
  
  if (stats.state === 'OPEN') {
    return {
      available: false,
      circuitState: 'OPEN',
      message: 'Payment service is temporarily unavailable. Please try again shortly.',
      retryAfterMs: stats.timeUntilRetry,
    };
  }
  
  if (stats.state === 'HALF_OPEN') {
    return {
      available: true,
      circuitState: 'HALF_OPEN',
      message: 'Payment service is recovering. Processing may be slower than usual.',
    };
  }
  
  return {
    available: true,
    circuitState: 'CLOSED',
    message: 'Payment service is available.',
  };
}

/**
 * Check if payment is available (simple boolean check)
 */
export function isPaymentAvailable(): boolean {
  return checkPaymentAvailability().available;
}

/**
 * Create Stripe Payment Intent
 * This calls your backend API to create a payment intent
 * 
 * Protected by circuit breaker to prevent cascading failures when
 * the Stripe API or Edge Function is experiencing issues.
 */
export async function createCheckoutSession(orderData: {
  eventId: string;
  tickets: Array<{
    ticketTypeId: string;
    quantity: number;
    unitPrice: number;
    unitFee: number;
    displayName: string;
  }>;
  customerEmail: string;
  customerName: string;
  totalAmount: number;
  feesAmount?: number;
  successUrl: string;
  cancelUrl: string;
  // VIP invite code for linking GA tickets to VIP reservations
  vipInviteCode?: string;
}): Promise<{ url: string; sessionId: string; orderId: string }> {
  // Check if Stripe key is configured
  if (!stripePublishableKey) {
    throw new Error(
      'Stripe is not configured. Please set VITE_STRIPE_PUBLISHABLE_KEY in your .env file. ' +
      'Get your key from https://dashboard.stripe.com/apikeys'
    );
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
  }
  
  try {
    return await stripeCircuit.execute(async () => {
      logger.debug('Creating Stripe checkout session', { 
        eventId: orderData.eventId,
        ticketCount: orderData.tickets.length,
        total: orderData.totalAmount,
      });

      const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create checkout session';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }

        if (response.status === 404) {
          throw new Error('Checkout session endpoint not found. Please ensure the Edge Function is deployed.');
        } else if (response.status === 500) {
          throw new Error(
            'Server error: ' + errorMessage + '\n\n' +
            'Please check your Edge Function logs in Supabase Dashboard.'
          );
        } else {
          throw new Error(errorMessage);
        }
      }

      const data = await response.json();
      
      if (!data.url || !data.sessionId) {
        throw new Error('Invalid response from server: missing checkout URL');
      }

      logger.info('Stripe checkout session created successfully', { 
        sessionId: data.sessionId,
        eventId: orderData.eventId,
      });

      return data;
    });
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      logger.error('Stripe circuit breaker is open', { 
        state: error.state,
        circuitName: error.circuitName,
      });
      throw new Error(
        'Payment service is temporarily unavailable due to high load or maintenance.\n\n' +
        'Please try again in a few moments. If the problem persists, contact support.'
      );
    }
    
    if (error instanceof Error && error.message.includes('\n')) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        'Network error: Cannot connect to Supabase Edge Function.\n\n' +
        'Please ensure:\n' +
        '1. VITE_SUPABASE_URL is set correctly in your .env file\n' +
        '2. The create-checkout-session Edge Function is deployed\n' +
        '3. Your network connection is working\n\n' +
        'See STRIPE_SETUP.md for setup instructions.'
      );
    }
    
    throw error;
  }
}

/**
 * Get the current status of the Stripe circuit breaker
 * Useful for health checks and monitoring
 */
export function getStripeCircuitStatus() {
  return stripeCircuit.getStats();
}

/**
 * Redirect to Stripe Checkout
 * Also protected by circuit breaker
 */
export async function redirectToCheckout(sessionId: string): Promise<void> {
  // Check availability first
  const availability = checkPaymentAvailability();
  if (!availability.available) {
    throw new Error(availability.message);
  }
  
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error('Stripe not initialized. Please check your Stripe publishable key.');
  }

  try {
    const { error } = await stripe.redirectToCheckout({ sessionId });
    
    if (error) {
      // Record this as a failure for circuit breaker tracking
      logger.error('Stripe redirect failed', { error: error.message });
      throw new Error(error.message || 'Failed to redirect to checkout');
    }
    
    metrics.increment('stripe.redirect_success', 1);
  } catch (error) {
    metrics.increment('stripe.redirect_failure', 1);
    throw error;
  }
}

// ============================================
// Payment Intent Creation (alternative to Checkout Session)
// ============================================

/**
 * Create a Payment Intent (simple version - legacy)
 * Protected by circuit breaker
 * @deprecated Use createPaymentIntent with orderData instead
 */
export async function createSimplePaymentIntent(amount: number, currency = 'usd'): Promise<{ clientSecret: string }> {
  // Check availability first
  const availability = checkPaymentAvailability();
  if (!availability.available) {
    throw new Error(availability.message);
  }
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing.');
  }
  
  try {
    return await stripeCircuit.execute(async () => {
      logger.debug('Creating Payment Intent', { amount, currency });
      
      const response = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ amount, currency }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Payment Intent creation failed (${response.status})`);
      }
      
      const data = await response.json();
      
      if (!data.clientSecret) {
        throw new Error('Invalid response: missing client secret');
      }
      
      logger.info('Payment Intent created', { amount, currency });
      metrics.increment('stripe.payment_intent_created', 1);
      
      return data;
    });
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      logger.error('Stripe circuit breaker is open for Payment Intent');
      throw new Error(
        'Payment service is temporarily unavailable due to high load or maintenance.\n\n' +
        'Please try again in a few moments.'
      );
    }
    throw error;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format error message for user display
 */
export function formatStripeError(error: unknown): string {
  if (error instanceof CircuitBreakerError) {
    return 'Payment service is temporarily unavailable. Please try again in a few moments.';
  }
  
  if (error instanceof Error) {
    // Check for common Stripe errors
    if (error.message.includes('card_declined')) {
      return 'Your card was declined. Please try a different payment method.';
    }
    if (error.message.includes('insufficient_funds')) {
      return 'Insufficient funds. Please try a different payment method.';
    }
    if (error.message.includes('expired_card')) {
      return 'Your card has expired. Please use a different card.';
    }
    if (error.message.includes('network')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Force the Stripe circuit breaker to open (for testing/maintenance)
 */
export function forceStripeCircuitOpen(): void {
  stripeCircuit.forceOpen();
}

/**
 * Force the Stripe circuit breaker to close (for recovery)
 */
export function forceStripeCircuitClose(): void {
  stripeCircuit.forceClose();
}

// ============================================
// VIP Table Payment Functions
// ============================================

export interface VipPaymentIntentData {
  eventId: string;
  tableId: string;
  tableNumber: string;
  tableTier: string;
  tablePrice: string;
  tableCapacity?: string;
  bottlesIncluded?: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  guestCount: number;
  celebration?: string;
  celebrantName?: string;
  specialRequests?: string;
  bottlePreferences?: string;
  estimatedArrival?: string;
  // GA ticket integration fields
  gaTicketCount?: number;
  gaTicketTypeId?: string;
  gaTicketPrice?: number;
}

export interface VipPaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  reservationId: string;
  amount: number;
}

export interface VipReservationConfirmation {
  id: string;
  reservationNumber: string;
  customerName: string;
  email: string;
  phone?: string;
  guestCount: number;
  amount: number;
  celebration?: string;
  estimatedArrival?: string;
  status: string;
  event: {
    id: string;
    name: string;
    event_date: string;
    venue_name?: string;
    flyer_url?: string;
  };
  table: {
    id: string;
    table_number: number;
    tier: string;
    capacity: number;
    bottles_included: number;
  };
}

/**
 * Create a Payment Intent for VIP table reservation
 * Uses embedded payment flow instead of redirect
 * Note: This function bypasses the circuit breaker for simplicity
 */
export async function createVipPaymentIntent(
  data: VipPaymentIntentData
): Promise<VipPaymentIntentResponse> {
  // Check if Stripe key is configured
  if (!stripePublishableKey) {
    throw new Error(
      'Stripe is not configured. Please set VITE_STRIPE_PUBLISHABLE_KEY in your .env file.'
    );
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing.');
  }
  
  logger.debug('Creating VIP Payment Intent', { 
    eventId: data.eventId,
    tableId: data.tableId,
    amount: data.tablePrice,
  });

  const response = await fetch(`${supabaseUrl}/functions/v1/create-vip-payment-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to create payment intent';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  
  if (!result.clientSecret) {
    throw new Error('Invalid response: missing client secret');
  }

  logger.info('VIP Payment Intent created', { 
    paymentIntentId: result.paymentIntentId,
    reservationId: result.reservationId,
  });

  return result;
}

/**
 * Confirm VIP payment after successful Stripe payment
 */
export async function confirmVipPayment(
  paymentIntentId: string,
  reservationId: string,
  customerEmail: string
): Promise<{ success: boolean; reservation: VipReservationConfirmation }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/confirm-vip-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ paymentIntentId, reservationId, customerEmail }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to confirm payment';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

