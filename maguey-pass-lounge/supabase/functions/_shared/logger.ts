/**
 * Structured logging utility for Supabase Edge Functions
 *
 * Usage:
 *   const requestId = getRequestId(req);
 *   const logger = createLogger(requestId);
 *   logger.info("Processing checkout", { eventId, ticketCount: 3 });
 */

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  requestId: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface Logger {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

/**
 * Creates a logger instance bound to a specific request ID
 * All logs from this logger will share the same requestId for correlation
 */
export function createLogger(requestId: string): Logger {
  const log = (
    level: LogEntry['level'],
    message: string,
    context?: Record<string, unknown>
  ) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      message,
      ...(context && { context }),
    };

    // Output as single-line JSON for Supabase log parsing
    console.log(JSON.stringify(entry));
  };

  return {
    info: (message: string, context?: Record<string, unknown>) =>
      log('info', message, context),
    warn: (message: string, context?: Record<string, unknown>) =>
      log('warn', message, context),
    error: (message: string, context?: Record<string, unknown>) =>
      log('error', message, context),
  };
}

/**
 * Generate a request ID from the request headers or create a new one
 */
export function getRequestId(req: Request): string {
  return (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    crypto.randomUUID()
  );
}
