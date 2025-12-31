/**
 * Structured Logger
 * 
 * Provides consistent, structured logging throughout the application.
 * Outputs JSON in production for easy parsing by log aggregators.
 * Outputs human-readable format in development.
 */

// ============================================
// TYPES
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  eventId?: string;
  orderId?: string;
  ticketId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
  child(context: LogContext): Logger;
  time(label: string): () => void;
}

// ============================================
// CONFIGURATION
// ============================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Determine environment
const isDevelopment = typeof import.meta !== 'undefined' 
  ? import.meta.env?.DEV === true || import.meta.env?.MODE === 'development'
  : typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

// Minimum log level (can be configured via environment)
const getMinLogLevel = (): LogLevel => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOG_LEVEL) {
    return import.meta.env.VITE_LOG_LEVEL as LogLevel;
  }
  if (typeof process !== 'undefined' && process.env?.LOG_LEVEL) {
    return process.env.LOG_LEVEL as LogLevel;
  }
  return isDevelopment ? 'debug' : 'info';
};

// ============================================
// FORMATTING
// ============================================

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
};

const RESET = '\x1b[0m';

function formatError(error: Error | unknown): LogEntry['error'] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    };
  }
  return {
    name: 'Unknown',
    message: String(error),
  };
}

function formatContextForConsole(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }
  
  const parts: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      parts.push(`${key}=${JSON.stringify(value)}`);
    }
  }
  return parts.length > 0 ? ` [${parts.join(' ')}]` : '';
}

function formatForDevelopment(entry: LogEntry): string {
  const color = LEVEL_COLORS[entry.level];
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const contextStr = formatContextForConsole(entry.context);
  const durationStr = entry.duration !== undefined ? ` (${entry.duration}ms)` : '';
  
  let output = `${color}${levelStr}${RESET} ${entry.message}${contextStr}${durationStr}`;
  
  if (entry.error) {
    output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
    if (entry.error.stack) {
      output += `\n${entry.error.stack.split('\n').slice(1).join('\n')}`;
    }
  }
  
  return output;
}

function formatForProduction(entry: LogEntry): string {
  return JSON.stringify(entry);
}

// ============================================
// LOGGER IMPLEMENTATION
// ============================================

class StructuredLogger implements Logger {
  private baseContext: LogContext;
  private minLevel: LogLevel;

  constructor(baseContext: LogContext = {}) {
    this.baseContext = baseContext;
    this.minLevel = getMinLogLevel();
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private mergeContext(context?: LogContext): LogContext | undefined {
    if (!context && Object.keys(this.baseContext).length === 0) {
      return undefined;
    }
    return { ...this.baseContext, ...context };
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error | unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.mergeContext(context),
    };

    if (error !== undefined) {
      entry.error = formatError(error);
    }

    const formatted = isDevelopment 
      ? formatForDevelopment(entry) 
      : formatForProduction(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.log('error', message, context, error);
  }

  /**
   * Create a child logger with preset context
   * All logs from the child will include the parent's context
   */
  child(context: LogContext): Logger {
    return new StructuredLogger({ ...this.baseContext, ...context });
  }

  /**
   * Start a timer and return a function to call when done
   * Logs the duration when the returned function is called
   */
  time(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'debug',
        message: `${label} completed`,
        duration,
        context: this.mergeContext(),
      };

      if (this.shouldLog('debug')) {
        const formatted = isDevelopment 
          ? formatForDevelopment(entry) 
          : formatForProduction(entry);
        console.debug(formatted);
      }
    };
  }
}

// ============================================
// EXPORTS
// ============================================

/**
 * Default logger instance
 * Use this for general logging throughout the application
 */
export const logger = new StructuredLogger();

/**
 * Create a new logger with preset context
 * Useful for creating request-scoped or module-scoped loggers
 * 
 * @example
 * const orderLogger = createLogger({ module: 'orders' });
 * orderLogger.info('Processing order', { orderId: '123' });
 */
export function createLogger(context: LogContext = {}): Logger {
  return new StructuredLogger(context);
}

/**
 * Create a request-scoped logger with a unique request ID
 * 
 * @example
 * const reqLogger = createRequestLogger();
 * reqLogger.info('Request started', { path: '/api/orders' });
 */
export function createRequestLogger(additionalContext: LogContext = {}): Logger {
  const requestId = generateRequestId();
  return new StructuredLogger({ requestId, ...additionalContext });
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Redact sensitive data for logging
 * @param value - Value to redact
 * @param visibleChars - Number of characters to show at start (default 8)
 */
export function redact(value: string, visibleChars: number = 8): string {
  if (!value || value.length <= visibleChars) {
    return '***';
  }
  return value.substring(0, visibleChars) + '...';
}

/**
 * Log an operation with automatic timing
 * 
 * @example
 * const result = await logOperation('fetchEvents', async () => {
 *   return await fetchEvents();
 * }, { eventId: '123' });
 */
export async function logOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const opLogger = logger.child({ operation: operationName, ...context });
  const done = opLogger.time(operationName);
  
  try {
    opLogger.debug(`Starting ${operationName}`);
    const result = await operation();
    done();
    opLogger.debug(`Completed ${operationName}`);
    return result;
  } catch (error) {
    done();
    opLogger.error(`Failed ${operationName}`, error);
    throw error;
  }
}

/**
 * Wrap a function with logging
 * 
 * @example
 * const loggedFetch = withLogging('fetchUser', fetchUser);
 * const user = await loggedFetch(userId);
 */
export function withLogging<TArgs extends unknown[], TResult>(
  operationName: string,
  fn: (...args: TArgs) => Promise<TResult>,
  contextExtractor?: (...args: TArgs) => LogContext
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const context = contextExtractor ? contextExtractor(...args) : {};
    return logOperation(operationName, () => fn(...args), context);
  };
}
