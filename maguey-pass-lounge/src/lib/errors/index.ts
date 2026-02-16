/**
 * Error Tracking Module
 * 
 * Comprehensive error tracking and monitoring system.
 * Re-exports all error tracking utilities and provides setup functions.
 */

// Export error types (selective to avoid conflicts)
export {
  ErrorSeverity,
  ErrorCategory,
  AppError,
  ValidationError,
  PaymentError,
  InventoryError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  ExternalServiceError,
  NetworkError,
} from './error-types';

// Export type-only exports explicitly for ESM compatibility
export type { ErrorContext, CapturedError } from './error-types';

export * from './error-tracker';
export * from './error-boundary';
export * from './error-storage';
export * from './error-alerts';
export * from './global-handlers';

// Re-export existing errors for backward compatibility
export {
  EventNotFoundError,
  OrderNotFoundError,
  TicketNotFoundError,
  InsufficientInventoryError,
  NotFoundError,
  RateLimitError,
} from '../errors';

import { errorTracker } from './error-tracker';
import { setupGlobalErrorHandlers } from './global-handlers';
import { ErrorBoundary, withErrorBoundary, useErrorHandler } from './error-boundary';

/**
 * Initialize error tracking
 * 
 * Sets up global error handlers and configures the error tracker.
 * Should be called early in the application lifecycle.
 */
export function setupErrorTracking(options?: {
  serviceName?: string;
  environment?: string;
  sampleRate?: number;
}): void {
  // Setup global error handlers
  setupGlobalErrorHandlers();

  // Configure error tracker if options provided
  if (options) {
    // Note: ErrorTracker config is set at construction time
    // For runtime configuration, you'd need to recreate the instance
    // or add setter methods
    console.log('[ErrorTracking] Error tracking initialized', {
      serviceName: options.serviceName || 'maguey-pass-lounge',
      environment: options.environment || 'development',
    });
  }
}

/**
 * React hook for error handling
 */
export { useErrorHandler };

/**
 * React Error Boundary component
 */
export { ErrorBoundary, withErrorBoundary };

/**
 * Get error tracker instance
 */
export { errorTracker };

/**
 * Setup error tracking on module load (browser only)
 */
if (typeof window !== 'undefined') {
  setupErrorTracking();
}
