/**
 * Lightweight Tracing for Marketing Site
 * 
 * Minimal tracing implementation for maguey-nights.
 * Only traces API calls and page loads for performance monitoring.
 */

// Simple in-memory trace storage (for development)
// In production, these would be sent to a tracing backend
const traceBuffer: Array<{
  type: 'page_load' | 'api_call';
  name: string;
  duration?: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}> = [];

// Maximum buffer size (prevent memory leaks)
const MAX_BUFFER_SIZE = 1000;

/**
 * Trace a page load event
 * 
 * @param pageName - Name of the page being loaded
 */
export function tracePageLoad(pageName: string): void {
  const startTime = performance.now();
  
  // Use requestIdleCallback if available, otherwise setTimeout
  const scheduleFlush = typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (fn: () => void) => setTimeout(fn, 0);

  scheduleFlush(() => {
    const duration = performance.now() - startTime;
    
    traceBuffer.push({
      type: 'page_load',
      name: pageName,
      duration,
      timestamp: Date.now(),
      metadata: {
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
    });

    // Prevent buffer overflow
    if (traceBuffer.length > MAX_BUFFER_SIZE) {
      traceBuffer.shift();
    }

    // In development, log to console
    if (import.meta.env.DEV) {
      console.log(`[TRACE] Page Load: ${pageName} (${duration.toFixed(2)}ms)`);
    }
  });
}

/**
 * Trace an API call
 * 
 * @param endpoint - API endpoint being called
 * @param duration - Duration in milliseconds
 * @param metadata - Optional metadata (status code, error, etc.)
 */
export function traceApiCall(
  endpoint: string,
  duration: number,
  metadata?: {
    method?: string;
    statusCode?: number;
    error?: string;
    responseSize?: number;
  }
): void {
  traceBuffer.push({
    type: 'api_call',
    name: endpoint,
    duration,
    timestamp: Date.now(),
    metadata: {
      method: metadata?.method || 'GET',
      statusCode: metadata?.statusCode,
      error: metadata?.error,
      responseSize: metadata?.responseSize,
    },
  });

  // Prevent buffer overflow
  if (traceBuffer.length > MAX_BUFFER_SIZE) {
    traceBuffer.shift();
  }

  // In development, log to console
  if (import.meta.env.DEV) {
    const status = metadata?.statusCode ? ` [${metadata.statusCode}]` : '';
    const error = metadata?.error ? ` ERROR: ${metadata.error}` : '';
    console.log(`[TRACE] API Call: ${endpoint}${status}${error} (${duration.toFixed(2)}ms)`);
  }
}

/**
 * Wrap a fetch call with automatic tracing
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Promise<Response>
 */
export async function tracedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const startTime = performance.now();
  const method = options?.method || 'GET';

  try {
    const response = await fetch(url, options);
    const duration = performance.now() - startTime;

    // Get response size if available
    const contentLength = response.headers.get('content-length');
    const responseSize = contentLength ? parseInt(contentLength, 10) : undefined;

    traceApiCall(url, duration, {
      method,
      statusCode: response.status,
      responseSize,
    });

    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    traceApiCall(url, duration, {
      method,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get recent traces (for debugging/development)
 * 
 * @param limit - Maximum number of traces to return
 * @returns Array of recent traces
 */
export function getRecentTraces(limit: number = 50): typeof traceBuffer {
  return traceBuffer.slice(-limit);
}

/**
 * Clear trace buffer
 */
export function clearTraces(): void {
  traceBuffer.length = 0;
}

/**
 * Export traces (for sending to backend)
 * 
 * @returns Array of traces ready for export
 */
export function exportTraces(): typeof traceBuffer {
  return [...traceBuffer];
}
