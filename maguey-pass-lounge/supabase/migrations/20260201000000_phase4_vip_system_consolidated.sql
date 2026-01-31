-- ============================================================================
-- PHASE 4: VIP SYSTEM RELIABILITY - CONSOLIDATED MIGRATION
-- ============================================================================
-- This migration consolidates all Phase 4 changes that were previously split
-- across multiple files with duplicate timestamps (causing some to not run).
--
-- Includes:
-- - 04-01: VIP state transition enforcement (forward-only state machine)
-- - 04-02: VIP re-entry support (vip_scan_logs, process_vip_scan_with_reentry)
-- - 04-04: Event cancellation support (refund tracking, can_cancel_event RPC)
-- - 04-06: VIP increment checked-in (increment_vip_checked_in RPC)
-- - 04-07: Unified VIP checkout (purchaser_ticket_id, create_unified_vip_checkout)
--
-- Created: 2026-02-01 (consolidating 2026-01-30 migrations)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: VIP STATE TRANSITION ENFORCEMENT (from 04-01)
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_vip_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_transition_allowed BOOLEAN := false;
  v_event_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Allow if status hasn't changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  v_transition_allowed := ARRAY[OLD.status, NEW.status] = ANY(ARRAY[
    ARRAY['pending', 'confirmed'],
    ARRAY['pending', 'cancelled'],
    ARRAY['confirmed', 'checked_in'],
    ARRAY['confirmed', 'cancelled'],
    ARRAY['checked_in', 'completed']
  ]);

  IF NOT v_transition_allowed THEN
    RAISE EXCEPTION 'Invalid VIP status transition from % to %. Only forward transitions are allowed.',
      OLD.status, NEW.status
      USING HINT = 'Valid transitions: pending→confirmed, pending→cancelled, confirmed→checked_in, confirmed→cancelled (pre-event), checked_in→completed';
  END IF;

  -- confirmed → cancelled only allowed before event starts
  IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
    SELECT e.start_time INTO v_event_start_time
    FROM events e
    WHERE e.id = NEW.event_id;

    IF v_event_start_time IS NOT NULL AND NOW() >= v_event_start_time THEN
      RAISE EXCEPTION 'Cannot cancel VIP reservation after event has started';
    END IF;
  END IF;

  RAISE NOTICE 'VIP status transition: reservation=%, from=% to=%', OLD.id, OLD.status, NEW.status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_vip_status_transition ON vip_reservations;
CREATE TRIGGER enforce_vip_status_transition
  BEFORE UPDATE OF status ON vip_reservations
  FOR EACH ROW
  EXECUTE FUNCTION validate_vip_status_transition();

-- ============================================================================
-- PART 2: VIP RE-ENTRY SUPPORT (from 04-02)
-- ============================================================================

-- Create vip_scan_logs table for audit trail
CREATE TABLE IF NOT EXISTS vip_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id UUID REFERENCES vip_guest_passes(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES vip_reservations(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  scan_type VARCHAR(20) NOT NULL,
  scanned_by VARCHAR(255),
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_scan_logs_pass_id ON vip_scan_logs(pass_id);
CREATE INDEX IF NOT EXISTS idx_vip_scan_logs_reservation_id ON vip_scan_logs(reservation_id);
CREATE INDEX IF NOT EXISTS idx_vip_scan_logs_ticket_id ON vip_scan_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_vip_scan_logs_scanned_at ON vip_scan_logs(scanned_at DESC);

ALTER TABLE vip_scan_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scan_logs_read_all" ON vip_scan_logs;
CREATE POLICY "scan_logs_read_all" ON vip_scan_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "scan_logs_insert_authenticated" ON vip_scan_logs;
CREATE POLICY "scan_logs_insert_authenticated" ON vip_scan_logs FOR INSERT WITH CHECK (true);

-- VIP scan with re-entry function
CREATE OR REPLACE FUNCTION process_vip_scan_with_reentry(
  p_pass_id UUID,
  p_scanned_by VARCHAR DEFAULT 'system'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pass RECORD;
  v_reservation RECORD;
  v_checked_in_count INTEGER;
  v_total_guests INTEGER;
  v_result JSON;
BEGIN
  SELECT * INTO v_pass FROM vip_guest_passes WHERE id = p_pass_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'PASS_NOT_FOUND', 'message', 'Guest pass not found');
  END IF;

  IF v_pass.status = 'cancelled' THEN
    RETURN json_build_object('success', FALSE, 'error', 'PASS_CANCELLED', 'message', 'This pass has been cancelled');
  END IF;

  SELECT * INTO v_reservation FROM vip_reservations WHERE id = v_pass.reservation_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'RESERVATION_NOT_FOUND', 'message', 'Reservation not found');
  END IF;

  IF v_reservation.status NOT IN ('confirmed', 'checked_in') THEN
    RETURN json_build_object('success', FALSE, 'error', 'RESERVATION_NOT_CONFIRMED', 'message', 'Reservation is not confirmed. Status: ' || v_reservation.status);
  END IF;

  IF v_pass.status = 'issued' THEN
    -- FIRST ENTRY
    UPDATE vip_guest_passes SET status = 'checked_in', checked_in_at = NOW(), checked_in_by = p_scanned_by, updated_at = NOW() WHERE id = p_pass_id;

    SELECT COUNT(*) INTO v_checked_in_count FROM vip_guest_passes WHERE reservation_id = v_pass.reservation_id AND status = 'checked_in';
    SELECT COALESCE((package_snapshot->>'guestCount')::INTEGER, 1) INTO v_total_guests FROM vip_reservations WHERE id = v_pass.reservation_id;

    UPDATE vip_reservations SET checked_in_guests = v_checked_in_count, checked_in_at = COALESCE(checked_in_at, NOW()), status = 'checked_in', updated_at = NOW() WHERE id = v_pass.reservation_id;

    INSERT INTO vip_scan_logs (pass_id, reservation_id, scan_type, scanned_by) VALUES (p_pass_id, v_pass.reservation_id, 'first_entry', p_scanned_by);

    v_result := json_build_object('success', TRUE, 'entry_type', 'first_entry', 'pass_id', p_pass_id, 'reservation_id', v_pass.reservation_id, 'guest_number', v_pass.guest_number, 'checked_in_guests', v_checked_in_count, 'total_guests', v_total_guests, 'message', 'Guest checked in successfully');

  ELSIF v_pass.status = 'checked_in' THEN
    -- RE-ENTRY
    INSERT INTO vip_scan_logs (pass_id, reservation_id, scan_type, scanned_by) VALUES (p_pass_id, v_pass.reservation_id, 'reentry', p_scanned_by);

    SELECT COUNT(*) INTO v_checked_in_count FROM vip_guest_passes WHERE reservation_id = v_pass.reservation_id AND status = 'checked_in';
    SELECT COALESCE((package_snapshot->>'guestCount')::INTEGER, 1) INTO v_total_guests FROM vip_reservations WHERE id = v_pass.reservation_id;

    v_result := json_build_object('success', TRUE, 'entry_type', 'reentry', 'pass_id', p_pass_id, 'reservation_id', v_pass.reservation_id, 'guest_number', v_pass.guest_number, 'checked_in_guests', v_checked_in_count, 'total_guests', v_total_guests, 'last_entry_time', v_pass.checked_in_at, 'message', 'Re-entry granted. Last entry: ' || TO_CHAR(v_pass.checked_in_at, 'HH24:MI'));
  ELSE
    RETURN json_build_object('success', FALSE, 'error', 'INVALID_STATUS', 'message', 'Pass has unexpected status: ' || v_pass.status);
  END IF;

  RETURN v_result;
END;
$$;

-- Check VIP linked ticket re-entry function
CREATE OR REPLACE FUNCTION check_vip_linked_ticket_reentry(p_ticket_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link RECORD;
  v_reservation RECORD;
  v_table RECORD;
BEGIN
  SELECT * INTO v_link FROM vip_linked_tickets WHERE ticket_id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object('is_vip_linked', FALSE);
  END IF;

  SELECT * INTO v_reservation FROM vip_reservations WHERE id = v_link.vip_reservation_id;

  IF NOT FOUND THEN
    RETURN json_build_object('is_vip_linked', FALSE, 'error', 'RESERVATION_NOT_FOUND');
  END IF;

  SELECT * INTO v_table FROM event_vip_tables WHERE id = v_reservation.event_vip_table_id;

  RETURN json_build_object(
    'is_vip_linked', TRUE,
    'allow_reentry', TRUE,
    'vip_reservation_id', v_reservation.id,
    'table_number', v_reservation.table_number,
    'table_name', COALESCE(v_table.table_name, 'Table ' || v_reservation.table_number),
    'reservation_status', v_reservation.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_vip_scan_with_reentry TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_vip_linked_ticket_reentry TO authenticated, service_role;

-- ============================================================================
-- PART 3: EVENT CANCELLATION SUPPORT (from 04-04)
-- ============================================================================

-- Add refund tracking columns
ALTER TABLE vip_reservations
  ADD COLUMN IF NOT EXISTS refund_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(255);

-- Add cancellation tracking to events (safely)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'cancellation_status') THEN
    ALTER TABLE events ADD COLUMN cancellation_status VARCHAR(50) DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'cancelled_at') THEN
    ALTER TABLE events ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'cancelled_by') THEN
    ALTER TABLE events ADD COLUMN cancelled_by VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'cancellation_reason') THEN
    ALTER TABLE events ADD COLUMN cancellation_reason TEXT;
  END IF;
END $$;

UPDATE events SET cancellation_status = 'active' WHERE cancellation_status IS NULL;

-- Get refundable reservations function
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT vr.id, vr.purchaser_name, vr.purchaser_email, vr.table_number, vr.amount_paid_cents, vr.stripe_payment_intent_id, vr.status, vr.created_at
  FROM vip_reservations vr
  WHERE vr.event_id = p_event_id
    AND vr.status IN ('confirmed', 'checked_in')
    AND vr.stripe_payment_intent_id IS NOT NULL
    AND vr.refund_id IS NULL
  ORDER BY vr.created_at ASC;
END;
$$;

-- Can cancel event function
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_event_datetime TIMESTAMP WITH TIME ZONE;
  v_refundable_count INTEGER;
  v_total_refund_cents INTEGER;
BEGIN
  SELECT e.event_date, e.event_time, e.cancellation_status INTO v_event FROM events e WHERE e.id = p_event_id;

  IF v_event.event_date IS NULL THEN
    RETURN QUERY SELECT false, 'Event not found'::TEXT, 0, 0, NULL::DATE, NULL::TIME, NULL::VARCHAR;
    RETURN;
  END IF;

  IF v_event.cancellation_status = 'cancelled' THEN
    RETURN QUERY SELECT false, 'Event already cancelled'::TEXT, 0, 0, v_event.event_date, v_event.event_time, v_event.cancellation_status;
    RETURN;
  END IF;

  v_event_datetime := (v_event.event_date || ' ' || COALESCE(v_event.event_time, '00:00:00'))::TIMESTAMP WITH TIME ZONE;

  IF v_event_datetime <= NOW() THEN
    RETURN QUERY SELECT false, 'Cannot cancel event that has already started'::TEXT, 0, 0, v_event.event_date, v_event.event_time, COALESCE(v_event.cancellation_status, 'active')::VARCHAR;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER, COALESCE(SUM(vr.amount_paid_cents), 0)::INTEGER
  INTO v_refundable_count, v_total_refund_cents
  FROM vip_reservations vr
  WHERE vr.event_id = p_event_id AND vr.status IN ('confirmed', 'checked_in') AND vr.stripe_payment_intent_id IS NOT NULL AND vr.refund_id IS NULL;

  RETURN QUERY SELECT true, 'Event can be cancelled'::TEXT, v_refundable_count, v_total_refund_cents, v_event.event_date, v_event.event_time, COALESCE(v_event.cancellation_status, 'active')::VARCHAR;
END;
$$;

GRANT EXECUTE ON FUNCTION get_event_refundable_reservations(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION can_cancel_event(VARCHAR) TO authenticated;

-- ============================================================================
-- PART 4: VIP INCREMENT CHECKED-IN (from 04-06)
-- ============================================================================

ALTER TABLE vip_reservations ADD COLUMN IF NOT EXISTS checked_in_guests INTEGER DEFAULT 0;


CREATE OR REPLACE FUNCTION increment_vip_checked_in(p_reservation_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_new_count INTEGER;
BEGIN
  SELECT * INTO v_reservation FROM vip_reservations WHERE id = p_reservation_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'RESERVATION_NOT_FOUND', 'message', 'VIP reservation not found');
  END IF;

  v_new_count := COALESCE(v_reservation.checked_in_guests, 0) + 1;

  UPDATE vip_reservations
  SET checked_in_guests = v_new_count,
      status = CASE WHEN status = 'confirmed' THEN 'checked_in' ELSE status END,
      checked_in_at = COALESCE(checked_in_at, NOW()),
      updated_at = NOW()
  WHERE id = p_reservation_id;

  RETURN json_build_object('success', TRUE, 'reservation_id', p_reservation_id, 'checked_in_guests', v_new_count, 'message', 'Checked-in count incremented');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', FALSE, 'error', 'INCREMENT_FAILED', 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_vip_checked_in TO authenticated, service_role;

-- ============================================================================
-- PART 5: UNIFIED VIP CHECKOUT (from 04-07)
-- ============================================================================

ALTER TABLE vip_reservations ADD COLUMN IF NOT EXISTS purchaser_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vip_reservations_purchaser_ticket ON vip_reservations(purchaser_ticket_id) WHERE purchaser_ticket_id IS NOT NULL;

CREATE OR REPLACE FUNCTION create_unified_vip_checkout(
  p_event_id VARCHAR,
  p_table_id UUID,
  p_table_number INTEGER,
  p_tier_id UUID,
  p_tier_name VARCHAR,
  p_tier_price_cents INTEGER,
  p_vip_price_cents INTEGER,
  p_total_amount_cents INTEGER,
  p_purchaser_name VARCHAR,
  p_purchaser_email VARCHAR,
  p_purchaser_phone VARCHAR,
  p_stripe_payment_intent_id VARCHAR,
  p_package_snapshot JSONB,
  p_special_requests TEXT DEFAULT NULL
)
RETURNS TABLE (
  ticket_id UUID,
  reservation_id UUID,
  unified_qr_token VARCHAR,
  ticket_token VARCHAR
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id UUID;
  v_reservation_id UUID;
  v_unified_token VARCHAR;
  v_ticket_token VARCHAR;
BEGIN
  v_unified_token := encode(gen_random_bytes(32), 'hex');
  v_ticket_token := encode(gen_random_bytes(16), 'hex');

  -- Create GA ticket
  INSERT INTO tickets (event_id, ticket_type_id, purchaser_email, purchaser_name, purchaser_phone, price_paid, qr_code, ticket_token, purchase_date, status)
  VALUES (p_event_id, p_tier_id, p_purchaser_email, p_purchaser_name, p_purchaser_phone, p_tier_price_cents / 100.0, v_unified_token, v_ticket_token, NOW(), 'valid')
  RETURNING id INTO v_ticket_id;

  -- Create VIP reservation
  INSERT INTO vip_reservations (event_id, event_vip_table_id, table_number, purchaser_name, purchaser_email, purchaser_phone, amount_paid_cents, stripe_payment_intent_id, status, qr_code_token, purchaser_ticket_id, package_snapshot, special_requests, disclaimer_accepted_at, refund_policy_accepted_at)
  VALUES (p_event_id, p_table_id, p_table_number, p_purchaser_name, p_purchaser_email, p_purchaser_phone, p_vip_price_cents, p_stripe_payment_intent_id, 'pending', v_unified_token, v_ticket_id, p_package_snapshot, p_special_requests, NOW(), NOW())
  RETURNING id INTO v_reservation_id;

  -- Mark table as unavailable
  UPDATE event_vip_tables SET is_available = false, updated_at = NOW() WHERE id = p_table_id;

  RETURN QUERY SELECT v_ticket_id, v_reservation_id, v_unified_token, v_ticket_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_unified_vip_checkout TO service_role, authenticated, anon;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION validate_vip_status_transition() IS 'Phase 4: Enforces forward-only VIP state transitions';
COMMENT ON TABLE vip_scan_logs IS 'Phase 4: Audit log for VIP pass scans including re-entries';
COMMENT ON FUNCTION process_vip_scan_with_reentry IS 'Phase 4: Process VIP scan with re-entry support';
COMMENT ON FUNCTION check_vip_linked_ticket_reentry IS 'Phase 4: Check if GA ticket is VIP-linked for re-entry';
COMMENT ON FUNCTION increment_vip_checked_in IS 'Phase 4: Increment VIP reservation checked-in guest count';
COMMENT ON FUNCTION create_unified_vip_checkout IS 'Phase 4: Atomic GA ticket + VIP reservation creation';
COMMENT ON FUNCTION get_event_refundable_reservations IS 'Phase 4: Get VIP reservations eligible for refund';
COMMENT ON FUNCTION can_cancel_event IS 'Phase 4: Validate if event can be cancelled';

COMMIT;
