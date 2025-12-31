/**
 * Standardized Error Types for the Scanner System
 * 
 * Provides consistent error classification, severity levels, and context tracking.
 * Extends existing error classes from ../errors.ts to add tracking capabilities.
 */

// Import existing error classes to extend them
// Note: These may not exist in maguey-gate-scanner, so we'll create base classes if needed
// For now, we'll define minimal base classes that can be extended

// Base AppError class (fallback if ../errors doesn't exist)
class BaseAppError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class BaseValidationError extends BaseAppError {
  constructor(
    message: string,
    public field?: string,
    details?: unknown
  ) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class BaseDatabaseError extends BaseAppError {
  constructor(
    operation: string,
    originalError?: Error,
    details?: unknown
  ) {
    super(
      `Database error during ${operation}: ${originalError?.message || 'Unknown error'}`,
      'DATABASE_ERROR',
      { operation, originalError, ...((details as object) || {}) }
    );
    this.name = 'DatabaseError';
  }
}

export enum ErrorSeverity {
  LOW = 'low',         // Minor issues, logged but no alert
  MEDIUM = 'medium',   // Degraded experience, alert if frequent
  HIGH = 'high',       // Major feature broken, immediate alert
  CRITICAL = 'critical' // System down, page immediately
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  PAYMENT = 'payment',
  INVENTORY = 'inventory',
  DATABASE = 'database',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  EXTERNAL_SERVICE = 'external_service',
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  traceId?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: unknown;
}

export interface CapturedError {
  id: string;
  fingerprint: string;  // For deduplication
  message: string;
  stack?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  tags: Record<string, string>;
  timestamp: Date;
  handled: boolean;
  serviceName: string;
}

/**
 * Extended AppError with tracking capabilities
 */
export class AppError extends BaseAppError {
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly context: ErrorContext;
  readonly handled: boolean;

  constructor(
    message: string,
    code: string,
    options: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      context?: ErrorContext;
      cause?: Error;
      details?: unknown;
    } = {}
  ) {
    super(message, code, options.details);
    this.category = options.category || ErrorCategory.UNKNOWN;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.context = options.context || {};
    this.handled = false;

    if (options.cause) {
      this.cause = options.cause;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to CapturedError format
   */
  toCapturedError(serviceName: string, additionalContext?: ErrorContext): CapturedError {
    return {
      id: crypto.randomUUID(),
      fingerprint: this.generateFingerprint(),
      message: this.message,
      stack: this.stack,
      category: this.category,
      severity: this.severity,
      context: {
        ...this.context,
        ...additionalContext,
        code: this.code,
      },
      tags: {
        errorType: this.constructor.name,
        code: this.code,
      },
      timestamp: new Date(),
      handled: this.handled,
      serviceName,
    };
  }

  /**
   * Generate fingerprint for error deduplication
   */
  private generateFingerprint(): string {
    const key = `${this.category}:${this.code}:${this.message}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

/**
 * Validation Error (extends existing)
 */
export class ValidationError extends BaseValidationError {
  readonly category = ErrorCategory.VALIDATION;
  readonly severity = ErrorSeverity.LOW;
  readonly context: ErrorContext = {};
  readonly handled = false;

  constructor(message: string, field?: string, context?: ErrorContext, details?: unknown) {
    super(message, field, details);
    this.context = context || {};
  }

  toCapturedError(serviceName: string, additionalContext?: ErrorContext): CapturedError {
    return {
      id: crypto.randomUUID(),
      fingerprint: this.generateFingerprint(),
      message: this.message,
      stack: this.stack,
      category: this.category,
      severity: this.severity,
      context: { ...this.context, ...additionalContext, field: this.field },
      tags: { errorType: 'ValidationError', code: this.code },
      timestamp: new Date(),
      handled: this.handled,
      serviceName,
    };
  }

  private generateFingerprint(): string {
    const key = `${this.category}:${this.code}:${this.message}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

/**
 * Database Error (extends existing)
 */
export class DatabaseError extends BaseDatabaseError {
  readonly category = ErrorCategory.DATABASE;
  readonly severity = ErrorSeverity.HIGH;
  readonly context: ErrorContext = {};
  readonly handled = false;

  constructor(operation: string, originalError?: Error, context?: ErrorContext, details?: unknown) {
    super(operation, originalError, details);
    this.context = { ...context, operation } || { operation };
  }

  toCapturedError(serviceName: string, additionalContext?: ErrorContext): CapturedError {
    return {
      id: crypto.randomUUID(),
      fingerprint: this.generateFingerprint(),
      message: this.message,
      stack: this.stack,
      category: this.category,
      severity: this.severity,
      context: { ...this.context, ...additionalContext },
      tags: { errorType: 'DatabaseError', code: this.code },
      timestamp: new Date(),
      handled: this.handled,
      serviceName,
    };
  }

  private generateFingerprint(): string {
    const key = `${this.category}:${this.code}:${this.message}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

/**
 * Network Error
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    url?: string,
    context?: ErrorContext
  ) {
    super(message, 'NETWORK_ERROR', {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      context: {
        ...context,
        ...(url ? { url } : {}),
      },
    });
  }
}

// Note: These error types are not defined in this file
// They should be imported from '../errors' if they exist, or created as needed
// For now, we'll comment them out to avoid export errors
// export {
//   EventNotFoundError,
//   OrderNotFoundError,
//   TicketNotFoundError,
//   InsufficientInventoryError,
//   NotFoundError,
//   RateLimitError,
// };
