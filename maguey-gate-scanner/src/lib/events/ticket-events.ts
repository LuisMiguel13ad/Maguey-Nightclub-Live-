/**
 * Ticket Events - Event Publishing for Scanner Service
 * 
 * This module provides event publishing functions for the gate scanner.
 * Events are published to the shared ticket_events table for audit trail.
 * 
 * Note: This is a simplified version of the event store for the scanner.
 * The full event store implementation is in maguey-pass-lounge.
 */

import { supabase } from '../supabase';
import { createLogger } from '../logger';

const logger = createLogger({ module: 'ticket-events' });

// ============================================
// Event Types
// ============================================

export const TicketEventTypes = {
  TICKET_SCANNED: 'TicketScanned',
  TICKET_REENTRY: 'TicketReEntry',
  TICKET_EXIT: 'TicketExit',
  TICKET_SCAN_REJECTED: 'TicketScanRejected',
  TICKET_ID_VERIFIED: 'TicketIDVerified',
  TICKET_ID_VERIFICATION_FAILED: 'TicketIDVerificationFailed',
  TICKET_FRAUD_FLAGGED: 'TicketFraudFlagged',
} as const;

export type TicketEventType = typeof TicketEventTypes[keyof typeof TicketEventTypes];

// ============================================
// Types
// ============================================

export interface EventMetadata {
  actorId?: string;
  actorType?: 'user' | 'system' | 'scanner' | 'admin';
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  scannerId?: string;
  location?: string;
  gate?: string;
  source?: string;
  [key: string]: unknown;
}

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
  reason: 'already_scanned' | 'invalid_signature' | 'expired' | 'cancelled' | 'wrong_event' | 'fraud_detected' | 'not_found';
  details?: string;
  scannedBy?: string;
  scanMethod: 'qr' | 'nfc' | 'manual';
}

export interface TicketIDVerifiedData {
  verifiedBy: string;
  verificationType: 'manual' | 'automated';
  idType?: string;
  verificationNotes?: string;
}

export interface TicketFraudFlaggedData {
  riskScore: number;
  indicators: string[];
  flaggedBy: 'system' | 'manual';
  details?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a correlation ID
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Create event metadata from scanner context
 */
export function createScannerMetadata(context: {
  scannerId?: string;
  deviceId?: string;
  gate?: string;
  location?: string;
  scannedBy?: string;
}): EventMetadata {
  return {
    actorId: context.scannedBy,
    actorType: 'scanner',
    scannerId: context.scannerId,
    deviceId: context.deviceId || (typeof localStorage !== 'undefined' ? localStorage.getItem('scanner_device_id') || undefined : undefined),
    gate: context.gate,
    location: context.location,
    source: 'maguey-gate-scanner',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Append an event to the ticket_events table
 */
async function appendEvent(
  aggregateId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  metadata: EventMetadata = {},
  correlationId?: string
): Promise<void> {
  const log = logger.child({ aggregateId, eventType });
  
  try {
    // Use RPC function if available, otherwise direct insert
    const { error } = await supabase.rpc('append_ticket_event', {
      p_aggregate_id: aggregateId,
      p_event_type: eventType,
      p_event_data: eventData,
      p_metadata: metadata,
      p_correlation_id: correlationId || null,
      p_causation_id: null,
      p_occurred_at: new Date().toISOString(),
    });

    if (error) {
      // If RPC doesn't exist, try direct insert (fallback)
      if (error.code === 'PGRST202') {
        log.debug('RPC not found, using direct insert');
        await directInsertEvent(aggregateId, eventType, eventData, metadata, correlationId);
        return;
      }
      
      log.error('Failed to append event', { error: error.message });
      throw error;
    }

    log.debug('Event appended successfully');
  } catch (err) {
    log.error('Event append failed', { error: err });
    // Don't throw - event publishing should not break scanner operations
  }
}

/**
 * Direct insert fallback if RPC is not available
 */
async function directInsertEvent(
  aggregateId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  metadata: EventMetadata,
  correlationId?: string
): Promise<void> {
  // Get next sequence number
  const { data: seqData } = await supabase
    .from('ticket_events')
    .select('sequence_number')
    .eq('aggregate_id', aggregateId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSeq = (seqData?.sequence_number ?? 0) + 1;

  const { error } = await supabase.from('ticket_events').insert({
    aggregate_id: aggregateId,
    event_type: eventType,
    event_data: eventData,
    metadata: metadata,
    sequence_number: nextSeq,
    correlation_id: correlationId,
    occurred_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

// ============================================
// Event Publishing Functions
// ============================================

/**
 * Publish a TicketScanned event
 */
export async function publishTicketScanned(
  ticketId: string,
  data: TicketScannedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<void> {
  logger.info('Publishing TicketScanned event', { ticketId });
  
  await appendEvent(
    ticketId,
    TicketEventTypes.TICKET_SCANNED,
    data as Record<string, unknown>,
    metadata || createScannerMetadata({ scannedBy: data.scannedBy }),
    correlationId
  );
}

/**
 * Publish a TicketReEntry event
 */
export async function publishTicketReEntry(
  ticketId: string,
  data: TicketReEntryData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<void> {
  logger.info('Publishing TicketReEntry event', { ticketId, entryCount: data.entryCount });
  
  await appendEvent(
    ticketId,
    TicketEventTypes.TICKET_REENTRY,
    data as Record<string, unknown>,
    metadata || createScannerMetadata({ scannedBy: data.scannedBy }),
    correlationId
  );
}

/**
 * Publish a TicketExit event
 */
export async function publishTicketExit(
  ticketId: string,
  data: TicketExitData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<void> {
  logger.info('Publishing TicketExit event', { ticketId, exitCount: data.exitCount });
  
  await appendEvent(
    ticketId,
    TicketEventTypes.TICKET_EXIT,
    data as Record<string, unknown>,
    metadata || createScannerMetadata({ scannedBy: data.scannedBy }),
    correlationId
  );
}

/**
 * Publish a TicketScanRejected event
 */
export async function publishTicketScanRejected(
  ticketId: string,
  data: TicketScanRejectedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<void> {
  logger.warn('Publishing TicketScanRejected event', { ticketId, reason: data.reason });
  
  await appendEvent(
    ticketId,
    TicketEventTypes.TICKET_SCAN_REJECTED,
    data as Record<string, unknown>,
    metadata || createScannerMetadata({ scannedBy: data.scannedBy }),
    correlationId
  );
}

/**
 * Publish a TicketIDVerified event
 */
export async function publishTicketIDVerified(
  ticketId: string,
  data: TicketIDVerifiedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<void> {
  logger.info('Publishing TicketIDVerified event', { ticketId });
  
  await appendEvent(
    ticketId,
    TicketEventTypes.TICKET_ID_VERIFIED,
    data as Record<string, unknown>,
    metadata || createScannerMetadata({ scannedBy: data.verifiedBy }),
    correlationId
  );
}

/**
 * Publish a TicketFraudFlagged event
 */
export async function publishTicketFraudFlagged(
  ticketId: string,
  data: TicketFraudFlaggedData,
  metadata?: EventMetadata,
  correlationId?: string
): Promise<void> {
  logger.warn('Publishing TicketFraudFlagged event', { ticketId, riskScore: data.riskScore });
  
  await appendEvent(
    ticketId,
    TicketEventTypes.TICKET_FRAUD_FLAGGED,
    data as Record<string, unknown>,
    metadata || createScannerMetadata({}),
    correlationId
  );
}

// ============================================
// Exports
// ============================================

export const ticketEvents = {
  types: TicketEventTypes,
  publishScanned: publishTicketScanned,
  publishReEntry: publishTicketReEntry,
  publishExit: publishTicketExit,
  publishScanRejected: publishTicketScanRejected,
  publishIDVerified: publishTicketIDVerified,
  publishFraudFlagged: publishTicketFraudFlagged,
  createMetadata: createScannerMetadata,
  generateCorrelationId,
};

export default ticketEvents;
