import { toast } from "sonner";

// Error types for logging/analytics
export type PaymentErrorType =
  | 'card_declined'
  | 'insufficient_funds'
  | 'expired_card'
  | 'processing_error'
  | 'network_error'
  | 'unknown';

// Map Stripe error codes to types
function categorizeError(error: Error | unknown): PaymentErrorType {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('card_declined') || message.includes('declined')) {
    return 'card_declined';
  }
  if (message.includes('insufficient_funds') || message.includes('insufficient')) {
    return 'insufficient_funds';
  }
  if (message.includes('expired')) {
    return 'expired_card';
  }
  if (message.includes('processing') || message.includes('try again')) {
    return 'processing_error';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'network_error';
  }
  return 'unknown';
}

// User-friendly messages (per user decision: simple, no technical details)
const USER_MESSAGES: Record<PaymentErrorType, string> = {
  card_declined: 'Payment failed. Please try again.',
  insufficient_funds: 'Payment failed. Please try again.',
  expired_card: 'Payment failed. Please try again.',
  processing_error: 'Payment failed. Please try again.',
  network_error: 'Connection issue. Please try again.',
  unknown: 'Payment failed. Please try again.',
};

interface HandlePaymentErrorOptions {
  onRetry: () => void;
  setIsLoading: (loading: boolean) => void;
  customerEmail?: string;
  paymentType: 'ga_ticket' | 'vip_reservation';
  eventId?: string;
}

/**
 * Handle payment errors with toast notification and retry button.
 * Per user decisions:
 * - Toast notification (not modal)
 * - Auto-dismiss after 5 seconds
 * - Simple friendly message
 * - Retry button on toast
 * - Full loading overlay during retry
 * - No retry limit
 * - Log all failed payment attempts
 */
export function handlePaymentError(
  error: Error | unknown,
  options: HandlePaymentErrorOptions
) {
  const { onRetry, setIsLoading, customerEmail, paymentType, eventId } = options;
  const errorType = categorizeError(error);
  const userMessage = USER_MESSAGES[errorType];

  // Log error for debugging (per user decision: log all failed payment attempts)
  console.error('[Payment Error]', {
    type: errorType,
    paymentType,
    eventId,
    customerEmail: customerEmail ? `${customerEmail.slice(0, 3)}...` : undefined,
    timestamp: new Date().toISOString(),
    rawError: error instanceof Error ? error.message : String(error),
  });

  // Show toast with retry button (per user decisions)
  toast.error(userMessage, {
    duration: 5000, // 5 second auto-dismiss
    action: {
      label: 'Retry',
      onClick: () => {
        // Show loading overlay during retry (per user decision)
        setIsLoading(true);
        onRetry();
      },
    },
  });
}

/**
 * Wrap an async payment function with retry capability.
 * Does NOT implement automatic retries - that's for backend.
 * This just provides the UI pattern for manual retry.
 */
export async function executePayment<T>(
  paymentFn: () => Promise<T>,
  options: Omit<HandlePaymentErrorOptions, 'onRetry'>
): Promise<T | null> {
  try {
    return await paymentFn();
  } catch (error) {
    handlePaymentError(error, {
      ...options,
      onRetry: () => {
        executePayment(paymentFn, options);
      },
    });
    return null;
  }
}
