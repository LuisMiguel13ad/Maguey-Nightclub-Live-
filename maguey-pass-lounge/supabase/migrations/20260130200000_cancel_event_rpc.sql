-- ============================================================================
-- Event Cancellation Support
-- ============================================================================
-- Add refund tracking columns to vip_reservations and events
-- Add RPC functions for event cancellation validation and refund retrieval
--
-- Part of Phase 4 (VIP System Reliability) - Wave 2
-- Owner-initiated event cancellation with automatic bulk refunds
-- ============================================================================

-- Add refund tracking columns to vip_reservations
ALTER TABLE vip_reservations
  ADD COLUMN IF NOT EXISTS refund_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(255);

-- Add cancellation tracking to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cancellation_status VARCHAR(50) CHECK (cancellation_status IN ('active', 'cancelled')),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Set default for existing events
UPDATE events SET cancellation_status = 'active' WHERE cancellation_status IS NULL;
ALTER TABLE events ALTER COLUMN cancellation_status SET DEFAULT 'active';

-- ============================================================================
-- RPC: Get all refundable VIP reservations for an event
-- ============================================================================
-- Returns VIP reservations that can be refunded (confirmed or checked_in status with payment intent)

CREATE OR REPLACE FUNCTION get_event_refundable_reservations(p_event_id VARCHAR)
RETURNS TABLE (
  reservation_id UUID,
  purchaser_name VARCHAR,
  purchaser_email VARCHAR,
  table_number INTEGER,
  amount_paid_cents INTEGER,
  stripe_payment_intent_id VARCHAR,
  status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vr.id as reservation_id,
    vr.purchaser_name,
    vr.purchaser_email,
    vr.table_number,
    vr.amount_paid_cents,
    vr.stripe_payment_intent_id,
    vr.status,
    vr.created_at
  FROM vip_reservations vr
  WHERE vr.event_id = p_event_id
    AND vr.status IN ('confirmed', 'checked_in')  -- Only confirmed or checked-in can be refunded
    AND vr.stripe_payment_intent_id IS NOT NULL   -- Must have payment to refund
    AND vr.refund_id IS NULL                      -- Not already refunded
  ORDER BY vr.created_at ASC;
END;
$$;

-- ============================================================================
-- RPC: Validate event can be cancelled and return summary
-- ============================================================================
-- Checks if event can be cancelled (hasn't started) and returns refund summary

CREATE OR REPLACE FUNCTION can_cancel_event(p_event_id VARCHAR)
RETURNS TABLE (
  can_cancel BOOLEAN,
  reason TEXT,
  refundable_count INTEGER,
  total_refund_cents INTEGER,
  event_date DATE,
  event_time TIME,
  event_status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_date DATE;
  v_event_time TIME;
  v_event_datetime TIMESTAMP WITH TIME ZONE;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_cancellation_status VARCHAR;
  v_refundable_count INTEGER;
  v_total_refund_cents INTEGER;
BEGIN
  -- Get event details
  SELECT e.date, e.time, e.cancellation_status
  INTO v_event_date, v_event_time, v_cancellation_status
  FROM events e
  WHERE e.id = p_event_id;

  -- Event doesn't exist
  IF v_event_date IS NULL THEN
    RETURN QUERY SELECT
      false as can_cancel,
      'Event not found' as reason,
      0 as refundable_count,
      0 as total_refund_cents,
      NULL::DATE as event_date,
      NULL::TIME as event_time,
      NULL::VARCHAR as event_status;
    RETURN;
  END IF;

  -- Event already cancelled
  IF v_cancellation_status = 'cancelled' THEN
    RETURN QUERY SELECT
      false as can_cancel,
      'Event already cancelled' as reason,
      0 as refundable_count,
      0 as total_refund_cents,
      v_event_date,
      v_event_time,
      v_cancellation_status;
    RETURN;
  END IF;

  -- Combine date and time for comparison
  v_event_datetime := (v_event_date || ' ' || v_event_time)::TIMESTAMP WITH TIME ZONE;

  -- Event already started
  IF v_event_datetime <= v_now THEN
    RETURN QUERY SELECT
      false as can_cancel,
      'Cannot cancel event that has already started' as reason,
      0 as refundable_count,
      0 as total_refund_cents,
      v_event_date,
      v_event_time,
      COALESCE(v_cancellation_status, 'active')::VARCHAR;
    RETURN;
  END IF;

  -- Get refundable reservation count and total
  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(vr.amount_paid_cents), 0)::INTEGER
  INTO v_refundable_count, v_total_refund_cents
  FROM vip_reservations vr
  WHERE vr.event_id = p_event_id
    AND vr.status IN ('confirmed', 'checked_in')
    AND vr.stripe_payment_intent_id IS NOT NULL
    AND vr.refund_id IS NULL;

  -- Event can be cancelled
  RETURN QUERY SELECT
    true as can_cancel,
    'Event can be cancelled' as reason,
    v_refundable_count,
    v_total_refund_cents,
    v_event_date,
    v_event_time,
    COALESCE(v_cancellation_status, 'active')::VARCHAR;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_event_refundable_reservations(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION can_cancel_event(VARCHAR) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_event_refundable_reservations IS
  'Returns all VIP reservations for an event that can be refunded (confirmed/checked_in with payment intent)';
COMMENT ON FUNCTION can_cancel_event IS
  'Validates if event can be cancelled and returns refund summary. Events cannot be cancelled after they start.';
