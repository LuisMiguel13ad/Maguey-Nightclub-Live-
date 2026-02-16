/**
 * Error Tracking Module
 * 
 * Comprehensive error tracking and monitoring system for scanner.
 * Re-exports all error tracking utilities and provides setup functions.
 */

// Export error types (selective to avoid conflicts)
export {
  ErrorSeverity,
  ErrorCategory,
  AppError,
  ValidationError,
  DatabaseError,
  NetworkError,
} from './error-types';

// Export type-only exports explicitly for ESM compatibility
export type { ErrorContext, CapturedError } from './error-types';

// Export scanner-specific errors
export {
  ScanError,
  ScanErrorType,
  getScanErrorRecovery,
  isRetryableError,
  shouldReportToSupport,
} from './scanner-errors';

export * from './error-tracker';
export * from './error-boundary';
export * from './error-storage';
export * from './global-handlers';

// Note: Existing error types should be imported directly from '../errors' to avoid circular dependencies

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
    console.log('[ErrorTracking] Error tracking initialized', {
      serviceName: options.serviceName || 'maguey-gate-scanner',
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
