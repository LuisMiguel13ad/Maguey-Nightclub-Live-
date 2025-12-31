/**
 * Scanner-Specific Error Types
 * 
 * Error types specific to ticket scanning operations.
 */

import { AppError, ErrorContext, ErrorSeverity, ErrorCategory } from './error-types';

export enum ScanErrorType {
  INVALID_QR = 'invalid_qr',
  TICKET_NOT_FOUND = 'ticket_not_found',
  ALREADY_SCANNED = 'already_scanned',
  WRONG_EVENT = 'wrong_event',
  EXPIRED_TICKET = 'expired_ticket',
  CANCELLED_TICKET = 'cancelled_ticket',
  CAMERA_ERROR = 'camera_error',
  NETWORK_ERROR = 'network_error',
}

/**
 * Scanner-specific error class
 */
export class ScanError extends AppError {
  readonly scanErrorType: ScanErrorType;
  readonly ticketId?: string;
  readonly scannerId?: string;

  constructor(
    type: ScanErrorType,
    message: string,
    options?: {
      ticketId?: string;
      scannerId?: string;
      eventId?: string;
      context?: ErrorContext;
      cause?: Error;
    }
  ) {
    // Map scan error type to severity
    const severity = getSeverityForScanError(type);
    const category = getCategoryForScanError(type);

    super(message, `SCAN_ERROR_${type.toUpperCase()}`, {
      category,
      severity,
      context: {
        ...options?.context,
        scanErrorType: type,
        ...(options?.ticketId ? { ticketId: options.ticketId } : {}),
        ...(options?.scannerId ? { scannerId: options.scannerId } : {}),
        ...(options?.eventId ? { eventId: options.eventId } : {}),
      },
      cause: options?.cause,
    });

    this.scanErrorType = type;
    this.ticketId = options?.ticketId;
    this.scannerId = options?.scannerId;
  }

  /**
   * Convert to CapturedError with scanner-specific context
   */
  toCapturedError(serviceName: string, additionalContext?: ErrorContext): import('./error-types').CapturedError {
    const captured = super.toCapturedError(serviceName, additionalContext);
    
    // Add scanner-specific tags
    captured.tags = {
      ...captured.tags,
      scanErrorType: this.scanErrorType,
      ...(this.ticketId ? { ticketId: this.ticketId } : {}),
      ...(this.scannerId ? { scannerId: this.scannerId } : {}),
    };

    return captured;
  }
}

/**
 * Get severity for scan error type
 */
function getSeverityForScanError(type: ScanErrorType): ErrorSeverity {
  switch (type) {
    case ScanErrorType.CAMERA_ERROR:
    case ScanErrorType.NETWORK_ERROR:
      return ErrorSeverity.HIGH;
    case ScanErrorType.INVALID_QR:
    case ScanErrorType.TICKET_NOT_FOUND:
      return ErrorSeverity.MEDIUM;
    case ScanErrorType.ALREADY_SCANNED:
    case ScanErrorType.WRONG_EVENT:
    case ScanErrorType.EXPIRED_TICKET:
    case ScanErrorType.CANCELLED_TICKET:
      return ErrorSeverity.LOW;
    default:
      return ErrorSeverity.MEDIUM;
  }
}

/**
 * Get category for scan error type
 */
function getCategoryForScanError(type: ScanErrorType): ErrorCategory {
  switch (type) {
    case ScanErrorType.INVALID_QR:
    case ScanErrorType.TICKET_NOT_FOUND:
    case ScanErrorType.ALREADY_SCANNED:
    case ScanErrorType.WRONG_EVENT:
    case ScanErrorType.EXPIRED_TICKET:
    case ScanErrorType.CANCELLED_TICKET:
      return ErrorCategory.VALIDATION;
    case ScanErrorType.CAMERA_ERROR:
    case ScanErrorType.NETWORK_ERROR:
      return ErrorCategory.NETWORK;
    default:
      return ErrorCategory.UNKNOWN;
  }
}

/**
 * Error recovery suggestions
 */
export function getScanErrorRecovery(type: ScanErrorType): string {
  switch (type) {
    case ScanErrorType.INVALID_QR:
      return 'Please ensure the QR code is fully visible and not damaged. Try cleaning the camera lens and scanning again.';
    
    case ScanErrorType.TICKET_NOT_FOUND:
      return 'This ticket was not found in the system. Please verify the ticket is valid and try again, or contact support.';
    
    case ScanErrorType.ALREADY_SCANNED:
      return 'This ticket has already been scanned. If this is a re-entry, ensure re-entry mode is enabled.';
    
    case ScanErrorType.WRONG_EVENT:
      return 'This ticket is for a different event. Please verify you are scanning at the correct venue.';
    
    case ScanErrorType.EXPIRED_TICKET:
      return 'This ticket has expired. Please contact support if you believe this is an error.';
    
    case ScanErrorType.CANCELLED_TICKET:
      return 'This ticket has been cancelled. Please contact support for assistance.';
    
    case ScanErrorType.CAMERA_ERROR:
      return 'Camera access is required for scanning. Please grant camera permissions and try again.';
    
    case ScanErrorType.NETWORK_ERROR:
      return 'Network connection is required. Please check your internet connection and try again.';
    
    default:
      return 'An unexpected error occurred. Please try again or contact support.';
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(type: ScanErrorType): boolean {
  return type === ScanErrorType.NETWORK_ERROR || 
         type === ScanErrorType.CAMERA_ERROR ||
         type === ScanErrorType.INVALID_QR;
}

/**
 * Check if error should be reported to support
 */
export function shouldReportToSupport(type: ScanErrorType): boolean {
  return type === ScanErrorType.CAMERA_ERROR ||
         type === ScanErrorType.NETWORK_ERROR ||
         type === ScanErrorType.TICKET_NOT_FOUND;
}
