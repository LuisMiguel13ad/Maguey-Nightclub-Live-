-- Migration: VIP Re-entry Support
-- Purpose: Enable VIP hosts and linked guests to re-enter venue
-- Context: Per 04-CONTEXT.md, re-entry is a VIP perk
-- Created: 2026-01-30

-- ============================================================================
-- 1. Create vip_scan_logs table for audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS vip_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id UUID REFERENCES vip_guest_passes(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES vip_reservations(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  scan_type VARCHAR(20) NOT NULL, -- 'first_entry', 'reentry'
  scanned_by VARCHAR(255),
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance (common query: get scans for a pass or reservation)
CREATE INDEX IF NOT EXISTS idx_vip_scan_logs_pass_id ON vip_scan_logs(pass_id);
CREATE INDEX IF NOT EXISTS idx_vip_scan_logs_reservation_id ON vip_scan_logs(reservation_id);
CREATE INDEX IF NOT EXISTS idx_vip_scan_logs_ticket_id ON vip_scan_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_vip_scan_logs_scanned_at ON vip_scan_logs(scanned_at DESC);

-- RLS: Anyone can read scan logs (for scanner history display)
ALTER TABLE vip_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_logs_read_all" ON vip_scan_logs
  FOR SELECT USING (true);

CREATE POLICY "scan_logs_insert_authenticated" ON vip_scan_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 2. Create process_vip_scan_with_reentry function
-- ============================================================================

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
  -- Lock the pass row for update (prevents concurrent scans)
  SELECT * INTO v_pass
  FROM vip_guest_passes
  WHERE id = p_pass_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'PASS_NOT_FOUND',
      'message', 'Guest pass not found'
    );
  END IF;

  -- Check if pass is cancelled
  IF v_pass.status = 'cancelled' THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'PASS_CANCELLED',
      'message', 'This pass has been cancelled'
    );
  END IF;

  -- Lock the reservation row for update
  SELECT * INTO v_reservation
  FROM vip_reservations
  WHERE id = v_pass.reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'RESERVATION_NOT_FOUND',
      'message', 'Reservation not found'
    );
  END IF;

  -- Check if reservation is in valid state for entry
  IF v_reservation.status NOT IN ('confirmed', 'checked_in') THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'RESERVATION_NOT_CONFIRMED',
      'message', 'Reservation is not confirmed. Status: ' || v_reservation.status
    );
  END IF;

  -- Determine if this is first entry or re-entry
  IF v_pass.status = 'issued' THEN
    -- ========================================================================
    -- FIRST ENTRY CASE
    -- ========================================================================

    -- Update pass to checked_in
    UPDATE vip_guest_passes
    SET
      status = 'checked_in',
      checked_in_at = NOW(),
      checked_in_by = p_scanned_by,
      updated_at = NOW()
    WHERE id = p_pass_id;

    -- Count checked-in guests
    SELECT COUNT(*) INTO v_checked_in_count
    FROM vip_guest_passes
    WHERE reservation_id = v_pass.reservation_id
      AND status = 'checked_in';

    -- Get total guest capacity from package snapshot
    SELECT COALESCE((package_snapshot->>'guestCount')::INTEGER, 1) INTO v_total_guests
    FROM vip_reservations
    WHERE id = v_pass.reservation_id;

    -- Update reservation
    UPDATE vip_reservations
    SET
      checked_in_guests = v_checked_in_count,
      checked_in_at = COALESCE(checked_in_at, NOW()),
      status = 'checked_in',
      updated_at = NOW()
    WHERE id = v_pass.reservation_id;

    -- Log first entry
    INSERT INTO vip_scan_logs (pass_id, reservation_id, scan_type, scanned_by)
    VALUES (p_pass_id, v_pass.reservation_id, 'first_entry', p_scanned_by);

    -- Build success response
    v_result := json_build_object(
      'success', TRUE,
      'entry_type', 'first_entry',
      'pass_id', p_pass_id,
      'reservation_id', v_pass.reservation_id,
      'guest_number', v_pass.guest_number,
      'checked_in_guests', v_checked_in_count,
      'total_guests', v_total_guests,
      'message', 'Guest checked in successfully'
    );

  ELSIF v_pass.status = 'checked_in' THEN
    -- ========================================================================
    -- RE-ENTRY CASE
    -- ========================================================================

    -- DO NOT change pass status (already checked_in)
    -- Just log the re-entry
    INSERT INTO vip_scan_logs (pass_id, reservation_id, scan_type, scanned_by)
    VALUES (p_pass_id, v_pass.reservation_id, 'reentry', p_scanned_by);

    -- Count checked-in guests
    SELECT COUNT(*) INTO v_checked_in_count
    FROM vip_guest_passes
    WHERE reservation_id = v_pass.reservation_id
      AND status = 'checked_in';

    -- Get total guest capacity from package snapshot
    SELECT COALESCE((package_snapshot->>'guestCount')::INTEGER, 1) INTO v_total_guests
    FROM vip_reservations
    WHERE id = v_pass.reservation_id;

    -- Build success response with last entry time
    v_result := json_build_object(
      'success', TRUE,
      'entry_type', 'reentry',
      'pass_id', p_pass_id,
      'reservation_id', v_pass.reservation_id,
      'guest_number', v_pass.guest_number,
      'checked_in_guests', v_checked_in_count,
      'total_guests', v_total_guests,
      'last_entry_time', v_pass.checked_in_at,
      'message', 'Re-entry granted. Last entry: ' || TO_CHAR(v_pass.checked_in_at, 'HH24:MI')
    );

  ELSE
    -- Unexpected status
    RETURN json_build_object(
      'success', FALSE,
      'error', 'INVALID_STATUS',
      'message', 'Pass has unexpected status: ' || v_pass.status
    );
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 3. Create check_vip_linked_ticket_reentry function
-- ============================================================================

CREATE OR REPLACE FUNCTION check_vip_linked_ticket_reentry(
  p_ticket_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link RECORD;
  v_reservation RECORD;
  v_table RECORD;
BEGIN
  -- Check if ticket is linked to a VIP reservation
  SELECT * INTO v_link
  FROM vip_linked_tickets
  WHERE ticket_id = p_ticket_id;

  IF NOT FOUND THEN
    -- Not a VIP-linked ticket
    RETURN json_build_object('is_vip_linked', FALSE);
  END IF;

  -- Get reservation details
  SELECT * INTO v_reservation
  FROM vip_reservations
  WHERE id = v_link.vip_reservation_id;

  IF NOT FOUND THEN
    -- Link exists but reservation doesn't (data inconsistency)
    RETURN json_build_object(
      'is_vip_linked', FALSE,
      'error', 'RESERVATION_NOT_FOUND'
    );
  END IF;

  -- Get table details
  SELECT * INTO v_table
  FROM event_vip_tables
  WHERE id = v_reservation.event_vip_table_id;

  -- Return VIP status with re-entry privilege
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

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION process_vip_scan_with_reentry TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_vip_linked_ticket_reentry TO authenticated, service_role;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE vip_scan_logs IS 'Audit log for all VIP pass scans including re-entries';
COMMENT ON FUNCTION process_vip_scan_with_reentry IS 'Process VIP scan with re-entry support - allows multiple entries for VIP hosts and guests';
COMMENT ON FUNCTION check_vip_linked_ticket_reentry IS 'Check if a GA ticket is linked to VIP and should get re-entry privileges';
