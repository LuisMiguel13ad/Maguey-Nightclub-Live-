/**
 * Scanner-specific span helpers
 * 
 * Provides convenience functions for creating scanner-related spans
 * with common attributes and patterns.
 */

import { tracer } from './tracer';
import { SpanBuilder } from './span';
import { TraceContext } from './trace-context';

/**
 * Create a span for ticket scanning operations
 * 
 * @param ticketId - The ticket ID being scanned
 * @param scannerId - The scanner device/user ID
 * @param eventId - The event ID
 * @param parentContext - Optional parent trace context
 * @returns SpanBuilder configured for scanning
 */
export function createScanSpan(
  ticketId: string,
  scannerId: string,
  eventId: string,
  parentContext?: TraceContext
): SpanBuilder {
  const span = tracer.startSpan('scanner.scanTicket', {
    kind: 'server',
    parentContext,
    attributes: {
      'scanner.ticket_id': ticketId,
      'scanner.scanner_id': scannerId,
      'scanner.event_id': eventId,
      'operation': 'scan_ticket',
    },
  });

  return span;
}

/**
 * Create a span for QR signature validation
 * 
 * @param qrToken - The QR token being validated
 * @param parentContext - Parent trace context
 * @returns SpanBuilder configured for validation
 */
export function createValidationSpan(
  qrToken: string,
  parentContext: TraceContext
): SpanBuilder {
  const span = tracer.startSpan('scanner.validateQR', {
    kind: 'internal',
    parentContext,
    attributes: {
      'scanner.qr_token_length': qrToken.length,
      'operation': 'validate_qr_signature',
    },
  });

  return span;
}

/**
 * Create a span for database lookup operations
 * 
 * @param operation - The lookup operation name
 * @param ticketId - Optional ticket ID
 * @param parentContext - Parent trace context
 * @returns SpanBuilder configured for database lookup
 */
export function createLookupSpan(
  operation: string,
  ticketId?: string,
  parentContext?: TraceContext
): SpanBuilder {
  const attributes: Record<string, string | number> = {
    'db.operation': operation,
  };

  if (ticketId) {
    attributes['scanner.ticket_id'] = ticketId;
  }

  const span = tracer.startSpan(`scanner.${operation}`, {
    kind: 'client',
    parentContext,
    attributes,
  });

  return span;
}

/**
 * Create a span for status update operations
 * 
 * @param ticketId - The ticket ID being updated
 * @param newStatus - The new status
 * @param parentContext - Parent trace context
 * @returns SpanBuilder configured for status update
 */
export function createStatusUpdateSpan(
  ticketId: string,
  newStatus: string,
  parentContext?: TraceContext
): SpanBuilder {
  const span = tracer.startSpan('scanner.updateStatus', {
    kind: 'client',
    parentContext,
    attributes: {
      'scanner.ticket_id': ticketId,
      'scanner.new_status': newStatus,
      'operation': 'update_ticket_status',
    },
  });

  return span;
}

/**
 * Create a span for event publishing
 * 
 * @param eventType - The event type being published
 * @param ticketId - The ticket ID
 * @param parentContext - Parent trace context
 * @returns SpanBuilder configured for event publishing
 */
export function createEventPublishSpan(
  eventType: string,
  ticketId: string,
  parentContext?: TraceContext
): SpanBuilder {
  const span = tracer.startSpan('scanner.publishEvent', {
    kind: 'producer',
    parentContext,
    attributes: {
      'scanner.ticket_id': ticketId,
      'scanner.event_type': eventType,
      'operation': 'publish_event',
    },
  });

  return span;
}
