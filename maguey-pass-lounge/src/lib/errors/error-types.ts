/**
 * Standardized Error Types for the Ticketing System
 * 
 * Provides consistent error classification, severity levels, and context tracking.
 * Extends existing error classes from ../errors.ts to add tracking capabilities.
 */

// Import existing error classes to extend them
import {
  AppError as BaseAppError,
  ValidationError as BaseValidationError,
  PaymentError as BasePaymentError,
  InventoryError as BaseInventoryError,
  DatabaseError as BaseDatabaseError,
  AuthenticationError as BaseAuthenticationError,
  AuthorizationError as BaseAuthorizationError,
  EventNotFoundError,
  OrderNotFoundError,
  TicketNotFoundError,
  InsufficientInventoryError,
  NotFoundError,
  RateLimitError,
} from '../errors';

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
 * Payment Error (extends existing)
 */
export class PaymentError extends BasePaymentError {
  readonly category = ErrorCategory.PAYMENT;
  readonly severity = ErrorSeverity.HIGH;
  readonly context: ErrorContext = {};
  readonly handled = false;

  constructor(message: string, context?: ErrorContext, details?: unknown) {
    super(message, details);
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
      context: { ...this.context, ...additionalContext },
      tags: { errorType: 'PaymentError', code: this.code },
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
 * Inventory Error (extends existing)
 */
export class InventoryError extends BaseInventoryError {
  readonly category = ErrorCategory.INVENTORY;
  readonly severity = ErrorSeverity.HIGH;
  readonly context: ErrorContext = {};
  readonly handled = false;

  constructor(message: string, context?: ErrorContext, details?: unknown) {
    super(message, details);
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
      context: { ...this.context, ...additionalContext },
      tags: { errorType: 'InventoryError', code: this.code },
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
 * Authentication Error (extends existing)
 */
export class AuthenticationError extends BaseAuthenticationError {
  readonly category = ErrorCategory.AUTHENTICATION;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly context: ErrorContext = {};
  readonly handled = false;

  constructor(message: string = 'Authentication required', context?: ErrorContext, details?: unknown) {
    super(message, details);
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
      context: { ...this.context, ...additionalContext },
      tags: { errorType: 'AuthenticationError', code: this.code },
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
 * Authorization Error (extends existing)
 */
export class AuthorizationError extends BaseAuthorizationError {
  readonly category = ErrorCategory.AUTHORIZATION;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly context: ErrorContext = {};
  readonly handled = false;

  constructor(message: string = 'Not authorized', context?: ErrorContext, details?: unknown) {
    super(message, details);
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
      context: { ...this.context, ...additionalContext },
      tags: { errorType: 'AuthorizationError', code: this.code },
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
 * External Service Error
 */
export class ExternalServiceError extends AppError {
  constructor(
    message: string,
    serviceName?: string,
    context?: ErrorContext
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', {
      category: ErrorCategory.EXTERNAL_SERVICE,
      severity: ErrorSeverity.HIGH,
      context: {
        ...context,
        ...(serviceName ? { serviceName } : {}),
      },
    });
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

// Re-export existing error types for backward compatibility
export {
  EventNotFoundError,
  OrderNotFoundError,
  TicketNotFoundError,
  InsufficientInventoryError,
  NotFoundError,
  RateLimitError,
};
