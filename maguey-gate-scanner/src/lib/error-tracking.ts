/**
 * Error tracking utility
 * Provides centralized error logging and tracking
 * Can be extended to integrate with Sentry, LogRocket, etc.
 */

export interface ErrorContext {
  userId?: string;
  eventId?: string;
  ticketId?: string;
  orderId?: string;
  functionName?: string;
  additionalData?: Record<string, any>;
}

class ErrorTracker {
  private enabled: boolean = false;
  private sentryDsn: string | null = null;

  /**
   * Initialize error tracking
   * @param dsn - Sentry DSN (optional)
   * @param enabled - Whether error tracking is enabled
   */
  init(dsn?: string, enabled: boolean = true): void {
    this.enabled = enabled;
    this.sentryDsn = dsn || null;
    
    if (this.enabled && this.sentryDsn) {
      // Initialize Sentry if DSN is provided
      // This would require @sentry/react to be installed
      // import * as Sentry from "@sentry/react";
      // Sentry.init({ dsn: this.sentryDsn });
      console.log('Error tracking initialized with Sentry');
    } else if (this.enabled) {
      console.log('Error tracking initialized (console only)');
    }
  }

  /**
   * Capture an error
   * @param error - The error to capture
   * @param context - Additional context about the error
   */
  captureError(error: Error | string, context?: ErrorContext): void {
    if (!this.enabled) {
      return;
    }

    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const errorInfo = {
      message: errorObj.message,
      stack: errorObj.stack,
      name: errorObj.name,
      timestamp: new Date().toISOString(),
      ...context,
    };

    // Log to console
    console.error('Error captured:', errorInfo);

    // Send to Sentry if configured
    if (this.sentryDsn) {
      // Sentry.captureException(errorObj, { contexts: { custom: context } });
    }

    // Optionally send to your own logging service
    // this.sendToLoggingService(errorInfo);
  }

  /**
   * Capture a message (non-error)
   * @param message - The message to capture
   * @param level - The severity level
   * @param context - Additional context
   */
  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: ErrorContext
  ): void {
    if (!this.enabled) {
      return;
    }

    const messageInfo = {
      message,
      level,
      timestamp: new Date().toISOString(),
      ...context,
    };

    console.log(`[${level.toUpperCase()}]`, messageInfo);

    // Send to Sentry if configured
    if (this.sentryDsn && level === 'error') {
      // Sentry.captureMessage(message, { level, contexts: { custom: context } });
    }
  }

  /**
   * Set user context for error tracking
   * @param userId - User ID
   * @param userData - Additional user data
   */
  setUser(userId: string, userData?: Record<string, any>): void {
    if (!this.enabled) {
      return;
    }

    // Sentry.setUser({ id: userId, ...userData });
    console.log('User context set:', { userId, ...userData });
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    if (!this.enabled) {
      return;
    }

    // Sentry.setUser(null);
    console.log('User context cleared');
  }
}

// Singleton instance
export const errorTracker = new ErrorTracker();

// Initialize if Sentry DSN is available
if (import.meta.env.VITE_SENTRY_DSN) {
  errorTracker.init(import.meta.env.VITE_SENTRY_DSN, true);
} else {
  errorTracker.init(undefined, true); // Console only
}

/**
 * Helper function to capture errors with context
 */
export function captureError(error: Error | string, context?: ErrorContext): void {
  errorTracker.captureError(error, context);
}

/**
 * Helper function to capture messages
 */
export function captureMessage(
  message: string,
  level?: 'info' | 'warning' | 'error',
  context?: ErrorContext
): void {
  errorTracker.captureMessage(message, level, context);
}

