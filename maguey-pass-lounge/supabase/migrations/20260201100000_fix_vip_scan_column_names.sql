-- ============================================================================
-- Fix VIP scan RPC to use correct column names
-- ============================================================================
-- The vip_guest_passes table uses scanned_at/scanned_by columns,
-- but the RPC was using checked_in_at/checked_in_by which don't exist.
--
-- This migration fixes the RPC to use the correct column names.
-- ============================================================================

BEGIN;

-- Drop and recreate the function with correct column names
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
  -- Lock the pass row to prevent concurrent updates
  SELECT * INTO v_pass FROM vip_guest_passes WHERE id = p_pass_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'PASS_NOT_FOUND', 'message', 'Guest pass not found');
  END IF;

  IF v_pass.status = 'cancelled' THEN
    RETURN json_build_object('success', FALSE, 'error', 'PASS_CANCELLED', 'message', 'This pass has been cancelled');
  END IF;

  -- Lock the reservation row to prevent concurrent updates
  SELECT * INTO v_reservation FROM vip_reservations WHERE id = v_pass.reservation_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'RESERVATION_NOT_FOUND', 'message', 'Reservation not found');
  END IF;

  IF v_reservation.status NOT IN ('confirmed', 'checked_in') THEN
    RETURN json_build_object('success', FALSE, 'error', 'RESERVATION_NOT_CONFIRMED', 'message', 'Reservation is not confirmed. Status: ' || v_reservation.status);
  END IF;

  IF v_pass.status = 'issued' THEN
    -- FIRST ENTRY
    -- Use scanned_at and scanned_by (actual column names in schema)
    UPDATE vip_guest_passes
    SET status = 'checked_in',
        scanned_at = NOW(),
        scanned_by = p_scanned_by,
        updated_at = NOW()
    WHERE id = p_pass_id;

    SELECT COUNT(*) INTO v_checked_in_count
    FROM vip_guest_passes
    WHERE reservation_id = v_pass.reservation_id AND status = 'checked_in';

    SELECT COALESCE((package_snapshot->>'guestCount')::INTEGER, 1) INTO v_total_guests
    FROM vip_reservations
    WHERE id = v_pass.reservation_id;

    UPDATE vip_reservations
    SET checked_in_guests = v_checked_in_count,
        checked_in_at = COALESCE(checked_in_at, NOW()),
        status = 'checked_in',
        updated_at = NOW()
    WHERE id = v_pass.reservation_id;

    INSERT INTO vip_scan_logs (pass_id, reservation_id, scan_type, scanned_by)
    VALUES (p_pass_id, v_pass.reservation_id, 'first_entry', p_scanned_by);

    v_result := json_build_object(
      'success', TRUE,
      'entry_type', 'first_entry',
      'pass_id', p_pass_id,
      'reservation_id', v_pass.reservation_id,
      'guest_number', v_pass.pass_number,
      'checked_in_guests', v_checked_in_count,
      'total_guests', v_total_guests,
      'message', 'Guest checked in successfully'
    );

  ELSIF v_pass.status = 'checked_in' THEN
    -- RE-ENTRY
    INSERT INTO vip_scan_logs (pass_id, reservation_id, scan_type, scanned_by)
    VALUES (p_pass_id, v_pass.reservation_id, 'reentry', p_scanned_by);

    SELECT COUNT(*) INTO v_checked_in_count
    FROM vip_guest_passes
    WHERE reservation_id = v_pass.reservation_id AND status = 'checked_in';

    SELECT COALESCE((package_snapshot->>'guestCount')::INTEGER, 1) INTO v_total_guests
    FROM vip_reservations
    WHERE id = v_pass.reservation_id;

    v_result := json_build_object(
      'success', TRUE,
      'entry_type', 'reentry',
      'pass_id', p_pass_id,
      'reservation_id', v_pass.reservation_id,
      'guest_number', v_pass.pass_number,
      'checked_in_guests', v_checked_in_count,
      'total_guests', v_total_guests,
      'last_entry_time', v_pass.scanned_at,
      'message', 'Re-entry granted. Last entry: ' || TO_CHAR(v_pass.scanned_at, 'HH24:MI')
    );
  ELSE
    RETURN json_build_object('success', FALSE, 'error', 'INVALID_STATUS', 'message', 'Pass has unexpected status: ' || v_pass.status);
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_vip_scan_with_reentry TO authenticated, service_role;

-- Add helpful comment
COMMENT ON FUNCTION process_vip_scan_with_reentry IS 'Phase 4/9: Process VIP scan with re-entry support (fixed column names: scanned_at, scanned_by)';

COMMIT;
