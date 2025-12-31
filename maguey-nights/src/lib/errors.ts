/**
 * Lightweight Error Tracking for Marketing Site
 * 
 * Minimal error tracking for the marketing site that sends errors to Supabase.
 */

import { createClient } from '@supabase/supabase-js';

// Re-export common error types for compatibility
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class DatabaseError extends AppError {
  code = 'DATABASE_ERROR';
  
  constructor(operation: string, originalError?: Error, details?: unknown) {
    super(
      `Database error during ${operation}: ${originalError?.message || 'Unknown error'}`,
      'DATABASE_ERROR',
      { operation, originalError, ...((details as object) || {}) }
    );
    this.name = 'DatabaseError';
  }
}

export class EventNotFoundError extends AppError {
  code = 'EVENT_NOT_FOUND';
  
  constructor(eventId?: string, details?: unknown) {
    super(
      eventId ? `Event '${eventId}' not found` : 'Event not found',
      'EVENT_NOT_FOUND',
      details
    );
    this.name = 'EventNotFoundError';
  }
}

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Generate fingerprint for error deduplication
 */
function generateFingerprint(error: Error): string {
  const key = `${error.name}:${error.message}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Track an error
 */
export function trackError(error: Error, context?: Record<string, unknown>): void {
  const fingerprint = generateFingerprint(error);
  
  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('[Error Tracking]', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      fingerprint,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  }

  // Send to Supabase in production (or if configured)
  if (supabase && (import.meta.env.PROD || import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true')) {
    // Fire and forget - don't block the UI
    supabase
      .from('error_events')
      .insert({
        fingerprint,
        message: error.message,
        stack: error.stack,
        category: 'unknown',
        severity: 'medium',
        service_name: 'maguey-nights',
        environment: import.meta.env.MODE || 'development',
        context: {
          ...context,
          url: window.location.href,
          userAgent: navigator.userAgent,
          errorName: error.name,
        },
        tags: {
          type: 'client_error',
          source: 'marketing_site',
        },
        handled: false,
        url: window.location.href,
        user_agent: navigator.userAgent,
      })
      .then(() => {
        if (import.meta.env.DEV) {
          console.log('[Error Tracking] Error sent to Supabase');
        }
      })
      .catch((err) => {
        console.error('[Error Tracking] Failed to send error to Supabase:', err);
      });
  }
}

/**
 * Track a message (non-error)
 */
export function trackMessage(message: string, severity: 'low' | 'medium' | 'high' = 'low', context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.log('[Error Tracking]', { message, severity, context });
  }

  if (supabase && (import.meta.env.PROD || import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true')) {
    const fingerprint = generateFingerprint(new Error(message));
    
    supabase
      .from('error_events')
      .insert({
        fingerprint,
        message,
        category: 'unknown',
        severity,
        service_name: 'maguey-nights',
        environment: import.meta.env.MODE || 'development',
        context: {
          ...context,
          url: window.location.href,
          userAgent: navigator.userAgent,
        },
        tags: {
          type: 'message',
          source: 'marketing_site',
        },
        handled: true,
        url: window.location.href,
        user_agent: navigator.userAgent,
      })
      .catch((err) => {
        console.error('[Error Tracking] Failed to send message:', err);
      });
  }
}

/**
 * Setup global error handlers
 */
export function setupErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  // Window error handler
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message);
    
    trackError(error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      type: 'unhandled_error',
    });
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    trackError(error, {
      type: 'unhandled_promise_rejection',
    });
  });
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

  try {
    const response = await fetch(input, init);

    // Track failed requests
    if (!response.ok && response.status >= 500) {
      trackError(
        new Error(`HTTP ${response.status}: ${response.statusText}`),
        {
          url,
          method,
          statusCode: response.status,
          statusText: response.statusText,
          type: 'http_error',
        }
      );
    }

    return response;
  } catch (error) {
    trackError(
      error instanceof Error ? error : new Error(String(error)),
      {
        url,
        method,
        type: 'network_error',
      }
    );
    throw error;
  }
}
