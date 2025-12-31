-- Migration: Create Ticket Events Table for Event Sourcing
-- This migration implements event sourcing for tickets to provide a complete audit trail
-- of all state changes for compliance, debugging, and analytics.

-- ============================================
-- TICKET EVENTS TABLE
-- ============================================
-- Core event store table for ticket lifecycle events
-- Each row represents an immutable fact that occurred

CREATE TABLE IF NOT EXISTS ticket_events (
  -- Unique identifier for this event
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- The ticket this event belongs to (aggregate root)
  aggregate_id UUID NOT NULL,
  
  -- Type of event (discriminator for event_data structure)
  event_type VARCHAR(100) NOT NULL,
  
  -- Event payload - structure depends on event_type
  event_data JSONB NOT NULL DEFAULT '{}',
  
  -- Metadata about the event context
  metadata JSONB DEFAULT '{}',
  
  -- Monotonically increasing sequence within an aggregate
  -- Used to ensure ordering and detect conflicts
  sequence_number INTEGER NOT NULL,
  
  -- When the event occurred (business time)
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- When the event was recorded (system time)
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Correlation ID for tracking related events across services
  correlation_id UUID,
  
  -- Causation ID - the event that caused this event
  causation_id UUID,
  
  -- Version of the event schema (for evolution)
  schema_version INTEGER DEFAULT 1 NOT NULL,
  
  -- Ensure sequence is unique per aggregate
  UNIQUE(aggregate_id, sequence_number)
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary query pattern: get all events for a ticket in order
CREATE INDEX idx_ticket_events_aggregate_seq 
  ON ticket_events(aggregate_id, sequence_number);

-- Query by event type for analytics and projections
CREATE INDEX idx_ticket_events_type 
  ON ticket_events(event_type);

-- Query by time range for reporting
CREATE INDEX idx_ticket_events_occurred_at 
  ON ticket_events(occurred_at DESC);

-- Query by correlation ID for tracing
CREATE INDEX idx_ticket_events_correlation 
  ON ticket_events(correlation_id) 
  WHERE correlation_id IS NOT NULL;

-- Composite index for common queries
CREATE INDEX idx_ticket_events_type_time 
  ON ticket_events(event_type, occurred_at DESC);

-- JSONB index for querying event data
CREATE INDEX idx_ticket_events_data 
  ON ticket_events USING GIN (event_data);

-- JSONB index for querying metadata
CREATE INDEX idx_ticket_events_metadata 
  ON ticket_events USING GIN (metadata);

-- ============================================
-- EVENT TYPES ENUM (for documentation)
-- ============================================
-- Using VARCHAR instead of ENUM for flexibility

COMMENT ON TABLE ticket_events IS 'Event store for ticket lifecycle events. Supported event types:
- TicketIssued: Ticket created and issued to customer
- TicketReserved: Ticket reserved during checkout (not yet paid)
- TicketConfirmed: Payment confirmed, ticket is valid
- TicketScanned: Ticket scanned at venue entry
- TicketReEntry: Ticket used for re-entry (exit tracking mode)
- TicketExit: Ticket holder exited venue
- TicketTransferred: Ticket transferred to another person
- TicketRefunded: Ticket refunded and invalidated
- TicketCancelled: Ticket cancelled (admin action)
- TicketExpired: Ticket expired (event passed)
- TicketUpgraded: Ticket upgraded to different tier
- TicketEmailSent: Confirmation email sent
- TicketEmailResent: Email resent to customer
- TicketIDVerified: ID verification completed
- TicketFraudFlagged: Potential fraud detected
- TicketFraudCleared: Fraud flag removed
- TicketMetadataUpdated: Ticket metadata changed';

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get the next sequence number for an aggregate
CREATE OR REPLACE FUNCTION get_next_sequence_number(p_aggregate_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_next_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1
  INTO v_next_seq
  FROM ticket_events
  WHERE aggregate_id = p_aggregate_id;
  
  RETURN v_next_seq;
END;
$$ LANGUAGE plpgsql;

-- Function to append an event with automatic sequence numbering
CREATE OR REPLACE FUNCTION append_ticket_event(
  p_aggregate_id UUID,
  p_event_type VARCHAR,
  p_event_data JSONB,
  p_metadata JSONB DEFAULT '{}',
  p_correlation_id UUID DEFAULT NULL,
  p_causation_id UUID DEFAULT NULL,
  p_occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS ticket_events AS $$
DECLARE
  v_event ticket_events;
  v_seq_num INTEGER;
BEGIN
  -- Get next sequence number with lock
  SELECT COALESCE(MAX(sequence_number), 0) + 1
  INTO v_seq_num
  FROM ticket_events
  WHERE aggregate_id = p_aggregate_id
  FOR UPDATE;
  
  -- Insert the event
  INSERT INTO ticket_events (
    aggregate_id,
    event_type,
    event_data,
    metadata,
    sequence_number,
    correlation_id,
    causation_id,
    occurred_at
  ) VALUES (
    p_aggregate_id,
    p_event_type,
    p_event_data,
    p_metadata,
    v_seq_num,
    p_correlation_id,
    p_causation_id,
    p_occurred_at
  )
  RETURNING * INTO v_event;
  
  RETURN v_event;
END;
$$ LANGUAGE plpgsql;

-- Function to get all events for a ticket
CREATE OR REPLACE FUNCTION get_ticket_events(
  p_aggregate_id UUID,
  p_from_sequence INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 1000
)
RETURNS SETOF ticket_events AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM ticket_events
  WHERE aggregate_id = p_aggregate_id
    AND sequence_number > p_from_sequence
  ORDER BY sequence_number ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get the latest event for a ticket
CREATE OR REPLACE FUNCTION get_latest_ticket_event(p_aggregate_id UUID)
RETURNS ticket_events AS $$
DECLARE
  v_event ticket_events;
BEGIN
  SELECT *
  INTO v_event
  FROM ticket_events
  WHERE aggregate_id = p_aggregate_id
  ORDER BY sequence_number DESC
  LIMIT 1;
  
  RETURN v_event;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Current Ticket State
-- ============================================
-- Materialized view that reconstructs current state from events
-- This is a projection that can be used for queries

CREATE OR REPLACE VIEW current_ticket_state AS
WITH latest_events AS (
  SELECT DISTINCT ON (aggregate_id)
    aggregate_id,
    event_type,
    event_data,
    occurred_at,
    sequence_number
  FROM ticket_events
  ORDER BY aggregate_id, sequence_number DESC
),
scan_counts AS (
  SELECT 
    aggregate_id,
    COUNT(*) FILTER (WHERE event_type = 'TicketScanned') as scan_count,
    COUNT(*) FILTER (WHERE event_type = 'TicketReEntry') as reentry_count,
    COUNT(*) FILTER (WHERE event_type = 'TicketExit') as exit_count,
    MAX(occurred_at) FILTER (WHERE event_type IN ('TicketScanned', 'TicketReEntry')) as last_scan_at,
    MAX(occurred_at) FILTER (WHERE event_type = 'TicketExit') as last_exit_at
  FROM ticket_events
  GROUP BY aggregate_id
),
first_issue AS (
  SELECT DISTINCT ON (aggregate_id)
    aggregate_id,
    occurred_at as issued_at,
    event_data->>'order_id' as order_id,
    event_data->>'event_id' as event_id,
    event_data->>'attendee_name' as attendee_name,
    event_data->>'attendee_email' as attendee_email,
    event_data->>'ticket_type_id' as ticket_type_id,
    (event_data->>'price')::numeric as price
  FROM ticket_events
  WHERE event_type = 'TicketIssued'
  ORDER BY aggregate_id, sequence_number ASC
)
SELECT
  le.aggregate_id as ticket_id,
  fi.order_id,
  fi.event_id,
  fi.attendee_name,
  fi.attendee_email,
  fi.ticket_type_id,
  fi.price,
  fi.issued_at,
  -- Derive current status from last event
  CASE le.event_type
    WHEN 'TicketIssued' THEN 'issued'
    WHEN 'TicketConfirmed' THEN 'confirmed'
    WHEN 'TicketScanned' THEN 'scanned'
    WHEN 'TicketReEntry' THEN 'inside'
    WHEN 'TicketExit' THEN 'outside'
    WHEN 'TicketRefunded' THEN 'refunded'
    WHEN 'TicketCancelled' THEN 'cancelled'
    WHEN 'TicketExpired' THEN 'expired'
    WHEN 'TicketTransferred' THEN 'transferred'
    ELSE 'unknown'
  END as current_status,
  le.occurred_at as last_event_at,
  le.event_type as last_event_type,
  le.sequence_number as event_count,
  sc.scan_count,
  sc.reentry_count,
  sc.exit_count,
  sc.last_scan_at,
  sc.last_exit_at
FROM latest_events le
LEFT JOIN first_issue fi ON le.aggregate_id = fi.aggregate_id
LEFT JOIN scan_counts sc ON le.aggregate_id = sc.aggregate_id;

-- ============================================
-- VIEW: Ticket Audit Trail
-- ============================================
-- Human-readable audit trail for a ticket

CREATE OR REPLACE VIEW ticket_audit_trail AS
SELECT
  te.id as event_id,
  te.aggregate_id as ticket_id,
  te.sequence_number,
  te.event_type,
  te.occurred_at,
  -- Extract common fields from event_data
  te.event_data->>'reason' as reason,
  te.event_data->>'actor_id' as actor_id,
  -- Extract metadata
  te.metadata->>'ip_address' as ip_address,
  te.metadata->>'user_agent' as user_agent,
  te.metadata->>'device_id' as device_id,
  te.metadata->>'scanner_id' as scanner_id,
  te.metadata->>'location' as location,
  te.correlation_id,
  te.event_data,
  te.metadata
FROM ticket_events te
ORDER BY te.aggregate_id, te.sequence_number;

-- ============================================
-- VIEW: Daily Event Statistics
-- ============================================

CREATE OR REPLACE VIEW ticket_event_stats_daily AS
SELECT
  DATE(occurred_at) as event_date,
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT aggregate_id) as unique_tickets
FROM ticket_events
GROUP BY DATE(occurred_at), event_type
ORDER BY event_date DESC, event_count DESC;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to ticket_events"
  ON ticket_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read events for their tickets
CREATE POLICY "Users can view events for their tickets"
  ON ticket_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      JOIN orders o ON t.order_id = o.id
      WHERE t.id = ticket_events.aggregate_id
      AND o.purchaser_email = auth.jwt()->>'email'
    )
  );

-- Allow anon to insert events (for scanner operations)
CREATE POLICY "Anon can insert ticket events"
  ON ticket_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to read events (for scanner lookups)
CREATE POLICY "Anon can read ticket events"
  ON ticket_events
  FOR SELECT
  TO anon
  USING (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to automatically set recorded_at
CREATE OR REPLACE FUNCTION set_recorded_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.recorded_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_events_set_recorded_at
  BEFORE INSERT ON ticket_events
  FOR EACH ROW
  EXECUTE FUNCTION set_recorded_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN ticket_events.aggregate_id IS 'The ticket ID this event belongs to (aggregate root)';
COMMENT ON COLUMN ticket_events.event_type IS 'Type of event - determines the structure of event_data';
COMMENT ON COLUMN ticket_events.event_data IS 'Event payload containing all event-specific data';
COMMENT ON COLUMN ticket_events.metadata IS 'Context about when/how the event occurred (actor, IP, device, etc)';
COMMENT ON COLUMN ticket_events.sequence_number IS 'Monotonically increasing sequence for ordering events within an aggregate';
COMMENT ON COLUMN ticket_events.occurred_at IS 'Business timestamp - when the event actually happened';
COMMENT ON COLUMN ticket_events.recorded_at IS 'System timestamp - when the event was stored';
COMMENT ON COLUMN ticket_events.correlation_id IS 'ID to correlate related events across services';
COMMENT ON COLUMN ticket_events.causation_id IS 'ID of the event that caused this event';
COMMENT ON COLUMN ticket_events.schema_version IS 'Version of the event schema for evolution';

COMMENT ON FUNCTION append_ticket_event IS 'Atomically appends an event to a ticket aggregate with automatic sequence numbering';
COMMENT ON FUNCTION get_ticket_events IS 'Retrieves events for a ticket starting from a given sequence number';
COMMENT ON FUNCTION get_latest_ticket_event IS 'Retrieves the most recent event for a ticket';

COMMENT ON VIEW current_ticket_state IS 'Projection of current ticket state derived from events';
COMMENT ON VIEW ticket_audit_trail IS 'Human-readable audit trail for tickets';
COMMENT ON VIEW ticket_event_stats_daily IS 'Daily statistics of ticket events by type';
