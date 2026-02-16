/**
 * Ticket Events - Strongly Typed Event Definitions
 * 
 * This module defines all possible events that can occur in a ticket's lifecycle.
 * Events are immutable facts that describe what happened - they form the audit trail.
 * 
 * Event Naming Convention:
 * - Past tense (e.g., TicketIssued, not IssueTicket)
 * - Specific and descriptive
 * - Grouped by lifecycle phase
 * 
 * @example
 * ```typescript
 * // Publish a ticket issued event
 * await publishTicketIssued(ticketId, {
 *   orderId: 'order-123',
 *   eventId: 'event-456',
 *   attendeeName: 'John Doe',
 *   ticketTypeId: 'vip',
 *   price: 99.99,
 * }, metadata);
 * ```
 */

import { 
  eventStore, 
  type EventMetadata, 
  type BaseEvent,
  generateCorrelationId,
  createEventMetadata,
} from '../event-store';
import { createLogger } from '../logger';

const logger = createLogger({ module: 'ticket-events' });

// ============================================
// Event Type Constants
// ============================================

export const TicketEventTypes = {
  // Lifecycle Events
  TICKET_ISSUED: 'TicketIssued',
  TICKET_RESERVED: 'TicketReserved',
  TICKET_CONFIRMED: 'TicketConfirmed',
  TICKET_CANCELLED: 'TicketCancelled',
  TICKET_REFUNDED: 'TicketRefunded',
  TICKET_EXPIRED: 'TicketExpired',
  TICKET_TRANSFERRED: 'TicketTransferred',
  TICKET_UPGRADED: 'TicketUpgraded',
  
  // Scan Events
  TICKET_SCANNED: 'TicketScanned',
  TICKET_REENTRY: 'TicketReEntry',
  TICKET_EXIT: 'TicketExit',
  TICKET_SCAN_REJECTED: 'TicketScanRejected',
  
  // Communication Events
  TICKET_EMAIL_SENT: 'TicketEmailSent',
  TICKET_EMAIL_RESENT: 'TicketEmailResent',
  TICKET_EMAIL_FAILED: 'TicketEmailFailed',
  
  // Security Events
  TICKET_ID_VERIFIED: 'TicketIDVerified',
  TICKET_ID_VERIFICATION_FAILED: 'TicketIDVerificationFailed',
  TICKET_FRAUD_FLAGGED: 'TicketFraudFlagged',
  TICKET_FRAUD_CLEARED: 'TicketFraudCleared',
  
  // Admin Events
  TICKET_METADATA_UPDATED: 'TicketMetadataUpdated',
  TICKET_STATUS_OVERRIDE: 'TicketStatusOverride',
  TICKET_NOTE_ADDED: 'TicketNoteAdded',
} as const;

export type TicketEventType = typeof TicketEventTypes[keyof typeof TicketEventTypes];

// ============================================
// Union Type for All Ticket Events
// ============================================

/**
 * Discriminated union type for all ticket events
 * Use this for type-safe event handling
 */
export type TicketEvent =
  | { type: 'TicketIssued'; data: TicketIssuedData }
  | { type: 'TicketReserved'; data: TicketReservedData }
  | { type: 'TicketConfirmed'; data: TicketConfirmedData }
  | { type: 'TicketCancelled'; data: TicketCancelledData }
  | { type: 'TicketRefunded'; data: TicketRefundedData }
  | { type: 'TicketExpired'; data: TicketExpiredData }
  | { type: 'TicketTransferred'; data: TicketTransferredData }
  | { type: 'TicketUpgraded'; data: TicketUpgradedData }
  | { type: 'TicketScanned'; data: TicketScannedData }
  | { type: 'TicketReEntry'; data: TicketReEntryData }
  | { type: 'TicketExit'; data: TicketExitData }
  | { type: 'TicketScanRejected'; data: TicketScanRejectedData }
  | { type: 'TicketEmailSent'; data: TicketEmailSentData }
  | { type: 'TicketEmailResent'; data: TicketEmailResentData }
  | { type: 'TicketEmailFailed'; data: TicketEmailFailedData }
  | { type: 'TicketIDVerified'; data: TicketIDVerifiedData }
  | { type: 'TicketIDVerificationFailed'; data: TicketIDVerificationFailedData }
  | { type: 'TicketFraudFlagged'; data: TicketFraudFlaggedData }
  | { type: 'TicketFraudCleared'; data: TicketFraudClearedData }
  | { type: 'TicketMetadataUpdated'; data: TicketMetadataUpdatedData }
  | { type: 'TicketStatusOverride'; data: TicketStatusOverrideData }
  | { type: 'TicketNoteAdded'; data: TicketNoteAddedData };

// ============================================
// Event Data Interfaces
// ============================================

// Lifecycle Events

export interface TicketIssuedData {
  orderId: string;
  eventId: string;
  attendeeName: string;
  attendeeEmail?: string;
  ticketTypeId: string;
  ticketTypeName: string;
  price: number;
  feeTotal: number;
  qrToken: string;
  qrSignature: string;
  seatLabel?: string;
}

export interface TicketReservedData {
  orderId: string;
  eventId: string;
  ticketTypeId: string;
  reservedUntil: string;
  price: number;
}

export interface TicketConfirmedData {
  paymentReference: string;
  paymentProvider: string;
  confirmedAt: string;
}

export interface TicketCancelledData {
  reason: string;
  cancelledBy?: string;
  refundInitiated: boolean;
}

export interface TicketRefundedData {
  refundId: string;
  refundAmount: number;
  refundReason: string;
  refundedBy?: string;
}

export interface TicketExpiredData {
  expiredAt: string;
  reason: 'event_passed' | 'manual' | 'timeout';
}

export interface TicketTransferredData {
  fromEmail: string;
  toEmail: string;
  toName: string;
  transferredBy?: string;
  transferId: string;
}

export interface TicketUpgradedData {
  fromTicketTypeId: string;
  fromTicketTypeName: string;
  toTicketTypeId: string;
  toTicketTypeName: string;
  priceDifference: number;
  upgradedBy?: string;
}

// Scan Events

export interface TicketScannedData {
  scannedBy?: string;
  scanMethod: 'qr' | 'nfc' | 'manual';
  scanDurationMs?: number;
  gate?: string;
  location?: string;
  overrideUsed?: boolean;
  overrideReason?: string;
}

export interface TicketReEntryData {
  scannedBy?: string;
  scanMethod: 'qr' | 'nfc' | 'manual';
  entryCount: number;
  gate?: string;
  location?: string;
}

export interface TicketExitData {
  scannedBy?: string;
  scanMethod: 'qr' | 'nfc' | 'manual';
  exitCount: number;
  gate?: string;
  location?: string;
}

export interface TicketScanRejectedData {
  reason: 'already_scanned' | 'invalid_signature' | 'expired' | 'cancelled' | 'wrong_event' | 'fraud_detected';
  details?: string;
  scannedBy?: string;
  scanMethod: 'qr' | 'nfc' | 'manual';
}

// Communication Events

export interface TicketEmailSentData {
  emailType: 'confirmation' | 'reminder' | 'update';
  recipientEmail: string;
  emailProvider: string;
  emailId?: string;
}

export interface TicketEmailResentData {
  emailType: 'confirmation' | 'reminder' | 'update';
  recipientEmail: string;
  resentBy?: string;
  reason?: string;
}

export interface TicketEmailFailedData {
  emailType: 'confirmation' | 'reminder' | 'update';
  recipientEmail: string;
  error: string;
  willRetry: boolean;
}

// Security Events

export interface TicketIDVerifiedData {
  verifiedBy: string;
  verificationType: 'manual' | 'automated';
  idType?: string;
  verificationNotes?: string;
}

export interface TicketIDVerificationFailedData {
  verifiedBy?: string;
  reason: string;
  requiresManualReview: boolean;
}

export interface TicketFraudFlaggedData {
  riskScore: number;
  indicators: string[];
  flaggedBy: 'system' | 'manual';
  details?: string;
}

export interface TicketFraudClearedData {
  clearedBy: string;
  reason: string;
  originalRiskScore: number;
}

// Admin Events

export interface TicketMetadataUpdatedData {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  updatedBy: string;
}

export interface TicketStatusOverrideData {
  previousStatus: string;
  newStatus: string;
  reason: string;
  overriddenBy: string;
}

export interface TicketNoteAddedData {
  note: string;
  addedBy: string;
  noteType: 'internal' | 'customer_visible';
}

// ============================================
// Typed Event Interface
// ============================================

export interface TicketEvent<T = Record<string, unknown>> extends BaseEvent {
  eventType: TicketEventType;
  eventData: T;
}

// ============================================
// Event Publishing Functions
// ============================================

/**
 * Publish a TicketIssued event
 */
export async function publishTicketIssued(
  ticketId: string,
  data: TicketIssuedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketIssuedData>> {
  logger.info('Publishing TicketIssued event', { ticketId, orderId: data.orderId });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_ISSUED,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'system' }),
    correlationId: correlationId || generateCorrelationId(),
  });
  
  return event as TicketEvent<TicketIssuedData>;
}

/**
 * Publish a TicketConfirmed event
 */
export async function publishTicketConfirmed(
  ticketId: string,
  data: TicketConfirmedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketConfirmedData>> {
  logger.info('Publishing TicketConfirmed event', { ticketId });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_CONFIRMED,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'system' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketConfirmedData>;
}

/**
 * Publish a TicketScanned event
 */
export async function publishTicketScanned(
  ticketId: string,
  data: TicketScannedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketScannedData>> {
  logger.info('Publishing TicketScanned event', { ticketId, scannedBy: data.scannedBy });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_SCANNED,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'scanner' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketScannedData>;
}

/**
 * Publish a TicketReEntry event
 */
export async function publishTicketReEntry(
  ticketId: string,
  data: TicketReEntryData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketReEntryData>> {
  logger.info('Publishing TicketReEntry event', { ticketId, entryCount: data.entryCount });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_REENTRY,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'scanner' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketReEntryData>;
}

/**
 * Publish a TicketExit event
 */
export async function publishTicketExit(
  ticketId: string,
  data: TicketExitData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketExitData>> {
  logger.info('Publishing TicketExit event', { ticketId, exitCount: data.exitCount });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_EXIT,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'scanner' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketExitData>;
}

/**
 * Publish a TicketScanRejected event
 */
export async function publishTicketScanRejected(
  ticketId: string,
  data: TicketScanRejectedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketScanRejectedData>> {
  logger.warn('Publishing TicketScanRejected event', { ticketId, reason: data.reason });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_SCAN_REJECTED,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'scanner' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketScanRejectedData>;
}

/**
 * Publish a TicketRefunded event
 */
export async function publishTicketRefunded(
  ticketId: string,
  data: TicketRefundedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketRefundedData>> {
  logger.info('Publishing TicketRefunded event', { ticketId, refundId: data.refundId });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_REFUNDED,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'admin' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketRefundedData>;
}

/**
 * Publish a TicketCancelled event
 */
export async function publishTicketCancelled(
  ticketId: string,
  data: TicketCancelledData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketCancelledData>> {
  logger.info('Publishing TicketCancelled event', { ticketId, reason: data.reason });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_CANCELLED,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'admin' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketCancelledData>;
}

/**
 * Publish a TicketTransferred event
 */
export async function publishTicketTransferred(
  ticketId: string,
  data: TicketTransferredData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketTransferredData>> {
  logger.info('Publishing TicketTransferred event', { 
    ticketId, 
    from: data.fromEmail, 
    to: data.toEmail 
  });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_TRANSFERRED,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'user' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketTransferredData>;
}

/**
 * Publish a TicketEmailSent event
 */
export async function publishTicketEmailSent(
  ticketId: string,
  data: TicketEmailSentData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketEmailSentData>> {
  logger.debug('Publishing TicketEmailSent event', { ticketId, emailType: data.emailType });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_EMAIL_SENT,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'system' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketEmailSentData>;
}

/**
 * Publish a TicketFraudFlagged event
 */
export async function publishTicketFraudFlagged(
  ticketId: string,
  data: TicketFraudFlaggedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketFraudFlaggedData>> {
  logger.warn('Publishing TicketFraudFlagged event', { 
    ticketId, 
    riskScore: data.riskScore 
  });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_FRAUD_FLAGGED,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'system' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketFraudFlaggedData>;
}

/**
 * Publish a TicketIDVerified event
 */
export async function publishTicketIDVerified(
  ticketId: string,
  data: TicketIDVerifiedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<TicketEvent<TicketIDVerifiedData>> {
  logger.info('Publishing TicketIDVerified event', { ticketId });
  
  const event = await eventStore.append({
    aggregateId: ticketId,
    eventType: TicketEventTypes.TICKET_ID_VERIFIED,
    eventData: data,
    metadata: metadata || createEventMetadata({ actorType: 'scanner' }),
    correlationId,
  });
  
  return event as TicketEvent<TicketIDVerifiedData>;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get all events for a ticket
 */
export async function getTicketHistory(ticketId: string): Promise<BaseEvent[]> {
  return eventStore.getEvents(ticketId);
}

/**
 * Get the current state of a ticket from its events
 */
export async function getTicketStateFromEvents(ticketId: string) {
  return eventStore.getTicketState(ticketId);
}

/**
 * Check if a ticket has been scanned
 */
export async function hasTicketBeenScanned(ticketId: string): Promise<boolean> {
  const events = await eventStore.getEvents(ticketId, {
    eventTypes: [TicketEventTypes.TICKET_SCANNED, TicketEventTypes.TICKET_REENTRY],
  });
  return events.length > 0;
}

/**
 * Get scan count for a ticket
 */
export async function getTicketScanCount(ticketId: string): Promise<number> {
  const events = await eventStore.getEvents(ticketId, {
    eventTypes: [TicketEventTypes.TICKET_SCANNED, TicketEventTypes.TICKET_REENTRY],
  });
  return events.length;
}

/**
 * Check if a ticket is currently inside (for re-entry tracking)
 */
export async function isTicketCurrentlyInside(ticketId: string): Promise<boolean> {
  const latestEvent = await eventStore.getLatestEvent(ticketId);
  if (!latestEvent) return false;
  
  return latestEvent.eventType === TicketEventTypes.TICKET_SCANNED ||
         latestEvent.eventType === TicketEventTypes.TICKET_REENTRY;
}

// ============================================
// Exports
// ============================================

export const ticketEvents = {
  // Event Types
  types: TicketEventTypes,
  
  // Publish functions
  publishIssued: publishTicketIssued,
  publishConfirmed: publishTicketConfirmed,
  publishScanned: publishTicketScanned,
  publishReEntry: publishTicketReEntry,
  publishExit: publishTicketExit,
  publishScanRejected: publishTicketScanRejected,
  publishRefunded: publishTicketRefunded,
  publishCancelled: publishTicketCancelled,
  publishTransferred: publishTicketTransferred,
  publishEmailSent: publishTicketEmailSent,
  publishFraudFlagged: publishTicketFraudFlagged,
  publishIDVerified: publishTicketIDVerified,
  
  // Query functions
  getHistory: getTicketHistory,
  getState: getTicketStateFromEvents,
  hasBeenScanned: hasTicketBeenScanned,
  getScanCount: getTicketScanCount,
  isCurrentlyInside: isTicketCurrentlyInside,
};

export default ticketEvents;
