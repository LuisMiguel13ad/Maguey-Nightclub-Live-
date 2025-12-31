/**
 * Sentry Integration
 *
 * Provides error monitoring and performance tracking via Sentry.
 * Integrates with the existing error tracking system.
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.log('[Sentry] No DSN configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',

    // Performance monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,

    // Session replay for debugging (optional - only in production)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0,

    // Filter out noisy errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Filter out specific errors that aren't useful
      if (error instanceof Error) {
        // Ignore ResizeObserver errors (common browser noise)
        if (error.message?.includes('ResizeObserver')) {
          return null;
        }
        // Ignore network errors from ad blockers
        if (error.message?.includes('blocked:mixed-content')) {
          return null;
        }
      }

      return event;
    },

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });

  console.log('[Sentry] Initialized successfully');
}

/**
 * Capture an error to Sentry
 */
export function captureError(
  error: Error | string,
  context?: Record<string, unknown>
): string {
  if (!SENTRY_DSN) {
    return '';
  }

  if (typeof error === 'string') {
    return Sentry.captureMessage(error, {
      level: 'error',
      extra: context,
    });
  }

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message to Sentry
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>
): string {
  if (!SENTRY_DSN) {
    return '';
  }

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id: string; email?: string; name?: string } | null): void {
  if (!SENTRY_DSN) {
    return;
  }

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}): void {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.addBreadcrumb({
    category: breadcrumb.category,
    message: breadcrumb.message,
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
  });
}

/**
 * Set extra context
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.setContext(name, context);
}

/**
 * Set tag
 */
export function setTag(key: string, value: string): void {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.setTag(key, value);
}

// Export Sentry for direct access if needed
export { Sentry };
