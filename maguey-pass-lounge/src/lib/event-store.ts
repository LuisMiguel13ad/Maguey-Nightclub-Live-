/**
 * Event Store - Core Event Sourcing Infrastructure
 * 
 * Provides the foundation for event sourcing in the ticketing system.
 * Events are immutable facts that describe what happened in the system.
 * 
 * Key Concepts:
 * - Aggregate: Entity that events belong to (e.g., a Ticket)
 * - Event: Immutable record of something that happened
 * - Sequence Number: Ensures event ordering within an aggregate
 * - Correlation ID: Links related events across services
 * - Causation ID: Links an event to its cause
 * 
 * @example
 * ```typescript
 * // Append an event
 * await eventStore.append({
 *   aggregateId: ticketId,
 *   eventType: 'TicketScanned',
 *   eventData: { scannedBy: 'user-123', location: 'Gate A' },
 *   metadata: { ipAddress: '192.168.1.1', deviceId: 'scanner-001' }
 * });
 * 
 * // Read events
 * const events = await eventStore.getEvents(ticketId);
 * ```
 */

import { supabase } from './supabase';
import { createLogger } from './logger';
import { metrics } from './monitoring';

const logger = createLogger({ module: 'event-store' });

// ============================================
// Types
// ============================================

/**
 * Base event interface that all events extend
 */
export interface BaseEvent {
  id: string;
  aggregateId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  metadata: EventMetadata;
  sequenceNumber: number;
  occurredAt: Date;
  recordedAt: Date;
  correlationId?: string;
  causationId?: string;
  schemaVersion: number;
}

/**
 * Metadata captured with each event
 */
export interface EventMetadata {
  actorId?: string;
  actorType?: 'user' | 'system' | 'scanner' | 'webhook' | 'admin';
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  scannerId?: string;
  location?: string;
  source?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Input for appending a new event
 */
export interface AppendEventInput {
  aggregateId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  metadata?: EventMetadata;
  correlationId?: string;
  causationId?: string;
  occurredAt?: Date;
}

/**
 * Options for querying events
 */
export interface GetEventsOptions {
  fromSequence?: number;
  limit?: number;
  eventTypes?: string[];
}

/**
 * Database row for ticket_events
 */
interface TicketEventRow {
  id: string;
  aggregate_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  sequence_number: number;
  occurred_at: string;
  recorded_at: string;
  correlation_id: string | null;
  causation_id: string | null;
  schema_version: number;
}

// ============================================
// Event Store Implementation
// ============================================

/**
 * Convert database row to BaseEvent
 */
function rowToEvent(row: TicketEventRow): BaseEvent {
  return {
    id: row.id,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    eventData: row.event_data,
    metadata: row.metadata as EventMetadata,
    sequenceNumber: row.sequence_number,
    occurredAt: new Date(row.occurred_at),
    recordedAt: new Date(row.recorded_at),
    correlationId: row.correlation_id ?? undefined,
    causationId: row.causation_id ?? undefined,
    schemaVersion: row.schema_version,
  };
}

/**
 * Append a new event to the event store
 */
export async function appendEvent(input: AppendEventInput): Promise<BaseEvent> {
  const log = logger.child({ 
    aggregateId: input.aggregateId, 
    eventType: input.eventType 
  });
  
  const startTime = Date.now();
  
  try {
    // Use the RPC function for atomic sequence numbering
    const { data, error } = await supabase.rpc('append_ticket_event', {
      p_aggregate_id: input.aggregateId,
      p_event_type: input.eventType,
      p_event_data: input.eventData,
      p_metadata: input.metadata || {},
      p_correlation_id: input.correlationId || null,
      p_causation_id: input.causationId || null,
      p_occurred_at: (input.occurredAt || new Date()).toISOString(),
    });

    if (error) {
      log.error('Failed to append event', { error: error.message });
      metrics.increment('event_store.append.error', 1, { event_type: input.eventType });
      throw new Error(`Failed to append event: ${error.message}`);
    }

    // Supabase RPC can return an array or a single object depending on the function
    const rowData = Array.isArray(data) ? data[0] : data;
    
    if (!rowData) {
      throw new Error('No data returned from append_ticket_event');
    }

    const event = rowToEvent(rowData as TicketEventRow);
    
    log.info('Event appended', { 
      eventId: event.id, 
      sequenceNumber: event.sequenceNumber 
    });
    
    metrics.increment('event_store.append.success', 1, { event_type: input.eventType });
    metrics.timing('event_store.append.duration', Date.now() - startTime);
    
    return event;
  } catch (error) {
    log.error('Event append failed', { error });
    metrics.increment('event_store.append.error', 1, { event_type: input.eventType });
    throw error;
  }
}

/**
 * Get all events for an aggregate
 */
export async function getEvents(
  aggregateId: string,
  options: GetEventsOptions = {}
): Promise<BaseEvent[]> {
  const { fromSequence = 0, limit = 1000, eventTypes } = options;
  
  const log = logger.child({ aggregateId });
  const startTime = Date.now();
  
  try {
    let query = supabase
      .from('ticket_events')
      .select('*')
      .eq('aggregate_id', aggregateId)
      .gt('sequence_number', fromSequence)
      .order('sequence_number', { ascending: true })
      .limit(limit);
    
    if (eventTypes && eventTypes.length > 0) {
      query = query.in('event_type', eventTypes);
    }
    
    const { data, error } = await query;

    if (error) {
      log.error('Failed to get events', { error: error.message });
      throw new Error(`Failed to get events: ${error.message}`);
    }

    const events = (data || []).map(rowToEvent);
    
    log.debug('Events retrieved', { count: events.length });
    metrics.timing('event_store.get.duration', Date.now() - startTime);
    
    return events;
  } catch (error) {
    log.error('Get events failed', { error });
    throw error;
  }
}

/**
 * Get the latest event for an aggregate
 */
export async function getLatestEvent(aggregateId: string): Promise<BaseEvent | null> {
  const log = logger.child({ aggregateId });
  
  try {
    const { data, error } = await supabase
      .from('ticket_events')
      .select('*')
      .eq('aggregate_id', aggregateId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      log.error('Failed to get latest event', { error: error.message });
      throw new Error(`Failed to get latest event: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return rowToEvent(data as TicketEventRow);
  } catch (error) {
    log.error('Get latest event failed', { error });
    throw error;
  }
}

/**
 * Get events by type across all aggregates (for projections)
 */
export async function getEventsByType(
  eventType: string,
  options: { 
    since?: Date; 
    until?: Date; 
    limit?: number;
  } = {}
): Promise<BaseEvent[]> {
  const { since, until, limit = 1000 } = options;
  
  const log = logger.child({ eventType });
  
  try {
    let query = supabase
      .from('ticket_events')
      .select('*')
      .eq('event_type', eventType)
      .order('occurred_at', { ascending: false })
      .limit(limit);
    
    if (since) {
      query = query.gte('occurred_at', since.toISOString());
    }
    
    if (until) {
      query = query.lte('occurred_at', until.toISOString());
    }
    
    const { data, error } = await query;

    if (error) {
      log.error('Failed to get events by type', { error: error.message });
      throw new Error(`Failed to get events by type: ${error.message}`);
    }

    return (data || []).map(rowToEvent);
  } catch (error) {
    log.error('Get events by type failed', { error });
    throw error;
  }
}

/**
 * Get events by correlation ID (for tracing)
 */
export async function getEventsByCorrelationId(
  correlationId: string
): Promise<BaseEvent[]> {
  const log = logger.child({ correlationId });
  
  try {
    const { data, error } = await supabase
      .from('ticket_events')
      .select('*')
      .eq('correlation_id', correlationId)
      .order('occurred_at', { ascending: true });

    if (error) {
      log.error('Failed to get events by correlation', { error: error.message });
      throw new Error(`Failed to get events by correlation: ${error.message}`);
    }

    return (data || []).map(rowToEvent);
  } catch (error) {
    log.error('Get events by correlation failed', { error });
    throw error;
  }
}

/**
 * Get the current sequence number for an aggregate
 */
export async function getCurrentSequence(aggregateId: string): Promise<number> {
  const latestEvent = await getLatestEvent(aggregateId);
  return latestEvent?.sequenceNumber ?? 0;
}

/**
 * Check if an aggregate exists (has any events)
 */
export async function aggregateExists(aggregateId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('ticket_events')
    .select('id', { count: 'exact', head: true })
    .eq('aggregate_id', aggregateId);
  
  if (error) {
    throw new Error(`Failed to check aggregate existence: ${error.message}`);
  }
  
  return (count ?? 0) > 0;
}

// ============================================
// Ticket State (Rebuilt from Events)
// ============================================

/**
 * Complete ticket state rebuilt from events
 */
export interface TicketState {
  ticketId: string;
  status: 'issued' | 'confirmed' | 'scanned' | 'inside' | 'outside' | 'refunded' | 'cancelled' | 'expired' | 'transferred' | 'unknown';
  orderId?: string;
  eventId?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  ticketTypeId?: string;
  ticketTypeName?: string;
  price?: number;
  feeTotal?: number;
  qrToken?: string;
  
  // Scan state
  isScanned: boolean;
  firstScannedAt?: Date;
  lastScannedAt?: Date;
  scannedBy?: string;
  scanCount: number;
  entryCount: number;
  exitCount: number;
  isCurrentlyInside: boolean;
  
  // Transfer state
  isTransferred: boolean;
  transferredTo?: string;
  transferredAt?: Date;
  
  // Refund state
  isRefunded: boolean;
  refundId?: string;
  refundAmount?: number;
  refundedAt?: Date;
  
  // Verification state
  isIDVerified: boolean;
  idVerifiedAt?: Date;
  idVerifiedBy?: string;
  
  // Fraud state
  isFraudFlagged: boolean;
  fraudRiskScore?: number;
  fraudIndicators?: string[];
  
  // Event sourcing metadata
  eventCount: number;
  lastEventType?: string;
  lastEventAt?: Date;
  version: number;
}

/**
 * Apply an event to the ticket state (event replay)
 */
function applyEvent(state: TicketState, event: BaseEvent): TicketState {
  const newState = { ...state };
  newState.eventCount++;
  newState.lastEventType = event.eventType;
  newState.lastEventAt = event.occurredAt;
  newState.version = event.sequenceNumber;

  switch (event.eventType) {
    case 'TicketIssued': {
      const data = event.eventData as {
        orderId?: string;
        eventId?: string;
        attendeeName?: string;
        attendeeEmail?: string;
        ticketTypeId?: string;
        ticketTypeName?: string;
        price?: number;
        feeTotal?: number;
        qrToken?: string;
      };
      newState.status = 'issued';
      newState.orderId = data.orderId;
      newState.eventId = data.eventId;
      newState.attendeeName = data.attendeeName;
      newState.attendeeEmail = data.attendeeEmail;
      newState.ticketTypeId = data.ticketTypeId;
      newState.ticketTypeName = data.ticketTypeName;
      newState.price = data.price;
      newState.feeTotal = data.feeTotal;
      newState.qrToken = data.qrToken;
      break;
    }

    case 'TicketConfirmed': {
      newState.status = 'confirmed';
      break;
    }

    case 'TicketScanned': {
      const data = event.eventData as { scannedBy?: string };
      newState.status = 'scanned';
      newState.isScanned = true;
      newState.scanCount++;
      newState.entryCount++;
      newState.isCurrentlyInside = true;
      newState.lastScannedAt = event.occurredAt;
      newState.scannedBy = data.scannedBy;
      if (!newState.firstScannedAt) {
        newState.firstScannedAt = event.occurredAt;
      }
      break;
    }

    case 'TicketReEntry': {
      const data = event.eventData as { scannedBy?: string; entryCount?: number };
      newState.status = 'inside';
      newState.scanCount++;
      newState.entryCount = data.entryCount || newState.entryCount + 1;
      newState.isCurrentlyInside = true;
      newState.lastScannedAt = event.occurredAt;
      newState.scannedBy = data.scannedBy;
      break;
    }

    case 'TicketExit': {
      const data = event.eventData as { exitCount?: number };
      newState.status = 'outside';
      newState.exitCount = data.exitCount || newState.exitCount + 1;
      newState.isCurrentlyInside = false;
      break;
    }

    case 'TicketRefunded': {
      const data = event.eventData as { refundId?: string; refundAmount?: number };
      newState.status = 'refunded';
      newState.isRefunded = true;
      newState.refundId = data.refundId;
      newState.refundAmount = data.refundAmount;
      newState.refundedAt = event.occurredAt;
      break;
    }

    case 'TicketCancelled': {
      newState.status = 'cancelled';
      break;
    }

    case 'TicketExpired': {
      newState.status = 'expired';
      break;
    }

    case 'TicketTransferred': {
      const data = event.eventData as { toEmail?: string };
      newState.status = 'transferred';
      newState.isTransferred = true;
      newState.transferredTo = data.toEmail;
      newState.transferredAt = event.occurredAt;
      break;
    }

    case 'TicketIDVerified': {
      const data = event.eventData as { verifiedBy?: string };
      newState.isIDVerified = true;
      newState.idVerifiedAt = event.occurredAt;
      newState.idVerifiedBy = data.verifiedBy;
      break;
    }

    case 'TicketFraudFlagged': {
      const data = event.eventData as { riskScore?: number; indicators?: string[] };
      newState.isFraudFlagged = true;
      newState.fraudRiskScore = data.riskScore;
      newState.fraudIndicators = data.indicators;
      break;
    }

    case 'TicketFraudCleared': {
      newState.isFraudFlagged = false;
      newState.fraudRiskScore = undefined;
      newState.fraudIndicators = undefined;
      break;
    }
  }

  return newState;
}

/**
 * Create initial empty state for a ticket
 */
function createInitialState(ticketId: string): TicketState {
  return {
    ticketId,
    status: 'unknown',
    isScanned: false,
    scanCount: 0,
    entryCount: 0,
    exitCount: 0,
    isCurrentlyInside: false,
    isTransferred: false,
    isRefunded: false,
    isIDVerified: false,
    isFraudFlagged: false,
    eventCount: 0,
    version: 0,
  };
}

// ============================================
// EventStore Class
// ============================================

/**
 * EventStore class with full event sourcing capabilities
 */
export class EventStore {
  /**
   * Append an event to the store
   * Supports both formats:
   * - eventStore.append({ aggregateId, eventType, eventData, metadata }) - legacy
   * - eventStore.append(aggregateId, { type, data }, metadata) - new
   */
  async append(
    aggregateIdOrInput: string | AppendEventInput, 
    event?: { type: string; data: Record<string, unknown> },
    metadata?: EventMetadata
  ): Promise<BaseEvent> {
    // Handle legacy format: append({ aggregateId, eventType, eventData, ... })
    if (typeof aggregateIdOrInput === 'object') {
      return appendEvent(aggregateIdOrInput);
    }
    
    // Handle new format: append(aggregateId, { type, data }, metadata)
    if (event) {
      return appendEvent({
        aggregateId: aggregateIdOrInput,
        eventType: event.type,
        eventData: event.data,
        metadata,
      });
    }
    
    throw new Error('Invalid arguments to append()');
  }

  /**
   * Get all events for an aggregate
   */
  async getEvents(aggregateId: string): Promise<BaseEvent[]> {
    return getEvents(aggregateId);
  }

  /**
   * Get events since a specific sequence number
   */
  async getEventsSince(aggregateId: string, sequenceNumber: number): Promise<BaseEvent[]> {
    return getEvents(aggregateId, { fromSequence: sequenceNumber });
  }

  /**
   * Rebuild the current state from all events (event replay)
   */
  async rebuildState(aggregateId: string): Promise<TicketState> {
    const log = logger.child({ aggregateId });
    const startTime = Date.now();
    
    log.debug('Rebuilding state from events');
    
    const events = await getEvents(aggregateId);
    
    // Start with initial state and apply each event
    let state = createInitialState(aggregateId);
    
    for (const event of events) {
      state = applyEvent(state, event);
    }
    
    log.debug('State rebuilt', { 
      eventCount: events.length, 
      status: state.status,
      durationMs: Date.now() - startTime,
    });
    
    metrics.timing('event_store.rebuild_state.duration', Date.now() - startTime);
    
    return state;
  }

  /**
   * Get the latest event for an aggregate
   */
  async getLatestEvent(aggregateId: string): Promise<BaseEvent | null> {
    return getLatestEvent(aggregateId);
  }

  /**
   * Get events by type across all aggregates
   */
  async getEventsByType(
    eventType: string,
    options?: { since?: Date; until?: Date; limit?: number }
  ): Promise<BaseEvent[]> {
    return getEventsByType(eventType, options);
  }

  /**
   * Get events by correlation ID
   */
  async getEventsByCorrelationId(correlationId: string): Promise<BaseEvent[]> {
    return getEventsByCorrelationId(correlationId);
  }

  /**
   * Get the current sequence number for an aggregate
   */
  async getCurrentSequence(aggregateId: string): Promise<number> {
    return getCurrentSequence(aggregateId);
  }

  /**
   * Check if an aggregate has any events
   */
  async aggregateExists(aggregateId: string): Promise<boolean> {
    return aggregateExists(aggregateId);
  }

  /**
   * Append multiple events in sequence
   */
  async appendBatch(
    events: Array<{ aggregateId: string; type: string; data: Record<string, unknown> }>,
    metadata?: EventMetadata
  ): Promise<BaseEvent[]> {
    const results: BaseEvent[] = [];
    
    for (const event of events) {
      const result = await this.append(event.aggregateId, { type: event.type, data: event.data }, metadata);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Get audit trail for a ticket (alias for getEvents)
   */
  async getAuditTrail(ticketId: string): Promise<BaseEvent[]> {
    return getEvents(ticketId);
  }

  /**
   * Replay events to a specific point in time
   */
  async replayToTimestamp(aggregateId: string, timestamp: Date): Promise<TicketState> {
    const log = logger.child({ aggregateId, timestamp });
    
    log.debug('Replaying events to timestamp');
    
    const events = await getEvents(aggregateId);
    
    // Filter events up to the timestamp
    const eventsToReplay = events.filter(e => e.occurredAt <= timestamp);
    
    // Start with initial state and apply each event
    let state = createInitialState(aggregateId);
    
    for (const event of eventsToReplay) {
      state = applyEvent(state, event);
    }
    
    log.debug('State replayed to timestamp', { 
      totalEvents: events.length,
      replayedEvents: eventsToReplay.length,
      status: state.status,
    });
    
    return state;
  }

  /**
   * Replay events to a specific sequence number
   */
  async replayToSequence(aggregateId: string, sequenceNumber: number): Promise<TicketState> {
    const log = logger.child({ aggregateId, sequenceNumber });
    
    log.debug('Replaying events to sequence');
    
    const events = await getEvents(aggregateId, { limit: sequenceNumber });
    
    // Start with initial state and apply each event
    let state = createInitialState(aggregateId);
    
    for (const event of events) {
      if (event.sequenceNumber <= sequenceNumber) {
        state = applyEvent(state, event);
      }
    }
    
    log.debug('State replayed to sequence', { 
      replayedEvents: state.eventCount,
      status: state.status,
    });
    
    return state;
  }
}

// ============================================
// Event Store Singleton Instance
// ============================================

/**
 * Singleton instance of EventStore
 */
export const eventStore = new EventStore();

// Also export the legacy object-style API for backwards compatibility
export const eventStoreService = {
  append: appendEvent,
  getEvents,
  getLatestEvent,
  getEventsByType,
  getEventsByCorrelationId,
  getCurrentSequence,
  aggregateExists,
  
  async appendBatch(events: AppendEventInput[]): Promise<BaseEvent[]> {
    const results: BaseEvent[] = [];
    for (const event of events) {
      const result = await appendEvent(event);
      results.push(result);
    }
    return results;
  },
  
  async getAuditTrail(ticketId: string): Promise<BaseEvent[]> {
    return getEvents(ticketId);
  },
  
  async rebuildState(ticketId: string): Promise<TicketState> {
    return eventStore.rebuildState(ticketId);
  },
  
  async getTicketState(ticketId: string): Promise<TicketState> {
    return eventStore.rebuildState(ticketId);
  },
};

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a correlation ID for tracking related operations
 */
export function generateCorrelationId(): string {
  // Use globalThis.crypto for browser or Node.js 19+
  // Fall back to a simple UUID-like string for older Node.js
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create event metadata from request context
 */
export function createEventMetadata(context: {
  actorId?: string;
  actorType?: EventMetadata['actorType'];
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  scannerId?: string;
  source?: string;
}): EventMetadata {
  return {
    actorId: context.actorId,
    actorType: context.actorType || 'system',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    deviceId: context.deviceId,
    scannerId: context.scannerId,
    source: context.source || 'maguey-pass-lounge',
    timestamp: new Date().toISOString(),
  };
}

export default eventStore;
