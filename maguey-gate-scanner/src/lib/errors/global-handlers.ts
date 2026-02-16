/**
 * Global Error Handlers
 * 
 * Sets up global error handlers for unhandled errors and promise rejections.
 */

import { errorTracker } from './error-tracker';
import { ErrorSeverity, ErrorCategory } from './error-types';

let isSetup = false;

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  if (isSetup) {
    console.warn('[ErrorTracker] Global handlers already setup');
    return;
  }

  // Window error handler
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message);
    
    errorTracker.captureError(error, {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.UNKNOWN,
      context: {
        url: event.filename,
        line: event.lineno,
        column: event.colno,
        userAgent: navigator.userAgent,
      },
      tags: {
        type: 'unhandled_error',
        source: 'window.onerror',
      },
    });

    // Don't prevent default - let browser handle it too
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    errorTracker.captureError(error, {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.UNKNOWN,
      context: {
        userAgent: navigator.userAgent,
      },
      tags: {
        type: 'unhandled_promise_rejection',
        source: 'window.unhandledrejection',
      },
    });

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Unhandled promise rejection:', event.reason);
    }
  });

  // Console error interceptor (optional, for development)
  if (import.meta.env.DEV) {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      // Check if it's an Error object
      const errorArg = args.find(arg => arg instanceof Error);
      if (errorArg) {
        errorTracker.addBreadcrumb({
          type: 'console',
          message: 'Console error',
          data: {
            args: args.map(arg => 
              arg instanceof Error ? arg.message : String(arg)
            ),
          },
        });
      }
      originalError.apply(console, args);
    };
  }

  isSetup = true;
}

/**
 * Wrapped fetch with error tracking
 */
export async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  const method = init?.method || 'GET';
  
  errorTracker.addBreadcrumb({
    type: 'http',
    message: `${method} ${url}`,
    data: {
      method,
      url,
    },
  });

  const startTime = performance.now();

  try {
    const response = await fetch(input, init);
    const duration = performance.now() - startTime;

    // Track failed requests
    if (!response.ok) {
      errorTracker.captureError(
        new Error(`HTTP ${response.status}: ${response.statusText}`),
        {
          severity: response.status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
          category: ErrorCategory.NETWORK,
          context: {
            url,
            method,
            statusCode: response.status,
            statusText: response.statusText,
            duration,
          },
          tags: {
            type: 'http_error',
            statusCode: String(response.status),
          },
        }
      );
    }

    return response;
  } catch (error) {
    const duration = performance.now() - startTime;

    errorTracker.captureError(
      error instanceof Error ? error : new Error(String(error)),
      {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.NETWORK,
        context: {
          url,
          method,
          duration,
        },
        tags: {
          type: 'network_error',
        },
      }
    );

    throw error;
  }
}

/**
 * Setup error handlers on module load
 */
if (typeof window !== 'undefined') {
  setupGlobalErrorHandlers();
}
