/**
 * Standardized Error Types
 * 
 * Domain-specific error classes for consistent error handling across the app.
 * Use with the Result type for type-safe error handling.
 */

// ============================================
// BASE ERROR CLASS
// ============================================

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

// ============================================
// ORDER ERRORS
// ============================================

export class OrderCreationError extends AppError {
  code = 'ORDER_CREATION_FAILED';
  
  constructor(message: string, details?: unknown) {
    super(message, 'ORDER_CREATION_FAILED', details);
    this.name = 'OrderCreationError';
  }
}

export class OrderNotFoundError extends AppError {
  code = 'ORDER_NOT_FOUND';
  
  constructor(orderId?: string, details?: unknown) {
    super(
      orderId ? `Order '${orderId}' not found` : 'Order not found',
      'ORDER_NOT_FOUND',
      details
    );
    this.name = 'OrderNotFoundError';
  }
}

// ============================================
// INVENTORY ERRORS
// ============================================

export class InventoryError extends AppError {
  code = 'INVENTORY_ERROR';
  
  constructor(message: string, details?: unknown) {
    super(message, 'INVENTORY_ERROR', details);
    this.name = 'InventoryError';
  }
}

export class InsufficientInventoryError extends InventoryError {
  code = 'INSUFFICIENT_INVENTORY';
  
  constructor(
    public ticketTypeName: string,
    public requested: number,
    public available: number,
    details?: unknown
  ) {
    super(
      `Not enough tickets available for ${ticketTypeName}. Requested: ${requested}, Available: ${available}`,
      details
    );
    this.code = 'INSUFFICIENT_INVENTORY';
    this.name = 'InsufficientInventoryError';
  }
}

// ============================================
// PAYMENT ERRORS
// ============================================

export class PaymentError extends AppError {
  code = 'PAYMENT_ERROR';
  
  constructor(message: string, details?: unknown) {
    super(message, 'PAYMENT_ERROR', details);
    this.name = 'PaymentError';
  }
}

// ============================================
// VALIDATION ERRORS
// ============================================

export class ValidationError extends AppError {
  code = 'VALIDATION_ERROR';
  
  constructor(message: string, public field?: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

// ============================================
// NOT FOUND ERRORS
// ============================================

export class NotFoundError extends AppError {
  code = 'NOT_FOUND';
  
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

export class EventNotFoundError extends NotFoundError {
  code = 'EVENT_NOT_FOUND';
  
  constructor(eventId?: string, details?: unknown) {
    super(
      eventId ? `Event '${eventId}' not found` : 'Event not found',
      details
    );
    this.code = 'EVENT_NOT_FOUND';
    this.name = 'EventNotFoundError';
  }
}

export class TicketNotFoundError extends NotFoundError {
  code = 'TICKET_NOT_FOUND';
  
  constructor(ticketId?: string, details?: unknown) {
    super(
      ticketId ? `Ticket '${ticketId}' not found` : 'Ticket not found',
      details
    );
    this.code = 'TICKET_NOT_FOUND';
    this.name = 'TicketNotFoundError';
  }
}

// ============================================
// DATABASE ERRORS
// ============================================

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

// ============================================
// AUTH ERRORS
// ============================================

export class AuthenticationError extends AppError {
  code = 'AUTHENTICATION_ERROR';
  
  constructor(message: string = 'Authentication required', details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  code = 'AUTHORIZATION_ERROR';
  
  constructor(message: string = 'Not authorized', details?: unknown) {
    super(message, 'AUTHORIZATION_ERROR', details);
    this.name = 'AuthorizationError';
  }
}

// ============================================
// TICKET ERRORS
// ============================================

export class TicketAlreadyUsedError extends AppError {
  code = 'TICKET_ALREADY_USED';
  
  constructor(ticketId: string, usedAt?: string, details?: unknown) {
    super(
      `Ticket ${ticketId} has already been used${usedAt ? ` at ${usedAt}` : ''}`,
      'TICKET_ALREADY_USED',
      details
    );
    this.name = 'TicketAlreadyUsedError';
  }
}

export class InvalidTicketError extends AppError {
  code = 'INVALID_TICKET';
  
  constructor(reason: string, ticketId?: string, details?: unknown) {
    super(
      `Invalid ticket${ticketId ? ` (${ticketId})` : ''}: ${reason}`,
      'INVALID_TICKET',
      details
    );
    this.name = 'InvalidTicketError';
  }
}

// ============================================
// RATE LIMIT ERRORS
// ============================================

export class RateLimitError extends AppError {
  code = 'RATE_LIMIT_ERROR';
  
  constructor(message: string = 'Rate limit exceeded', public retryAfter?: number, details?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', details);
    this.name = 'RateLimitError';
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new AppError(error.message, 'UNKNOWN_ERROR', { originalError: error });
  }
  
  return new AppError(String(error), 'UNKNOWN_ERROR');
}
