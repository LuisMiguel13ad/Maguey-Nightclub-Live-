import { toast } from "sonner";

// Error message catalog - professional/formal tone (per context decision)
export const ERROR_MESSAGES = {
  // Network errors
  network_offline: "Unable to connect. Please check your internet connection.",
  network_timeout: "The request timed out. Please try again.",
  network_error: "A connection error occurred. Please try again.",

  // Payment errors
  payment_failed: "Payment could not be processed. Please check your card details and try again.",
  payment_declined: "Your card was declined. Please try a different payment method.",
  payment_expired: "Your session has expired. Please start again.",

  // Validation errors
  validation_error: "Please review the form for errors.",
  invalid_input: "The information provided is invalid. Please check and try again.",

  // Auth errors
  auth_failed: "Sign in failed. Please check your credentials.",
  session_expired: "Your session has expired. Please sign in again.",

  // Scanner errors
  scan_failed: "Unable to process scan. Please try again.",
  ticket_not_found: "Ticket not found. Please verify the code.",

  // Generic fallback
  generic: "An error occurred. Please contact support if this persists.",
} as const;

type ErrorType = keyof typeof ERROR_MESSAGES;

interface ShowErrorOptions {
  onRetry?: () => void;
  onDismiss?: () => void;
  supportEmail?: string;
}

/**
 * Show user-friendly error toast with action button.
 * Per context decisions:
 * - duration: Infinity (persist until dismissed)
 * - Always include action button
 * - closeButton: true
 */
export function showError(
  type: ErrorType | string,
  options: ShowErrorOptions = {}
) {
  const message = ERROR_MESSAGES[type as ErrorType] || ERROR_MESSAGES.generic;
  const { onRetry, supportEmail = "support@maguey.com" } = options;

  toast.error(message, {
    duration: Infinity, // Persist until dismissed (per context decision)
    closeButton: true,
    action: onRetry
      ? {
          label: "Try Again",
          onClick: onRetry,
        }
      : {
          label: "Contact Support",
          onClick: () => window.location.href = `mailto:${supportEmail}`,
        },
  });
}

/**
 * Shorthand for network errors
 */
export function showNetworkError(onRetry?: () => void) {
  showError(navigator.onLine ? "network_error" : "network_offline", { onRetry });
}

/**
 * Shorthand for validation errors
 */
export function showValidationError() {
  showError("validation_error");
}
