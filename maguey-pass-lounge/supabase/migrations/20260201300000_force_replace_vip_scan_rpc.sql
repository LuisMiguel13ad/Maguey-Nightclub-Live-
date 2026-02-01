-- ============================================================================
-- Force replace VIP scan RPC - drop all existing versions
-- ============================================================================
-- This migration ensures the old version is completely replaced
-- ============================================================================

BEGIN;

-- Drop ALL possible signatures of the function
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Find and drop all functions named process_vip_scan_with_reentry
  FOR r IN
    SELECT oid::regprocedure
    FROM pg_proc
    WHERE proname = 'process_vip_scan_with_reentry'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
    RAISE NOTICE 'Dropped function: %', r.oid::regprocedure;
  END LOOP;
END $$;

-- Create the function with correct type handling
CREATE FUNCTION process_vip_scan_with_reentry(
  p_pass_id UUID,
  p_scanned_by TEXT DEFAULT NULL
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
  v_scanned_by_uuid UUID;
BEGIN
  -- Try to cast scanned_by to UUID, or use NULL if it's not a valid UUID
  BEGIN
    v_scanned_by_uuid := p_scanned_by::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_scanned_by_uuid := NULL;
  END;

  -- Lock the pass row to prevent concurrent updates
  SELECT * INTO v_pass FROM vip_guest_passes WHERE id = p_pass_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'PASS_NOT_FOUND', 'message', 'Guest pass not found');
  END IF;

  IF v_pass.status = 'cancelled' THEN
    RETURN json_build_object('success', FALSE, 'error', 'PASS_CANCELLED', 'message', 'This pass has been cancelled');
  END IF;

  -- Lock the reservation row to prevent concurrent updates
  -- Select specific columns to avoid enum array issues
  SELECT id, status::TEXT as status, checked_in_at, checked_in_guests, package_snapshot
  INTO v_reservation FROM vip_reservations WHERE id = v_pass.reservation_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'RESERVATION_NOT_FOUND', 'message', 'Reservation not found');
  END IF;

  -- Status is already text (casted in SELECT)
  IF v_reservation.status NOT IN ('confirmed', 'checked_in') THEN
    RETURN json_build_object('success', FALSE, 'error', 'RESERVATION_NOT_CONFIRMED', 'message', 'Reservation is not confirmed. Status: ' || v_reservation.status);
  END IF;

  IF v_pass.status::TEXT = 'issued' THEN
    -- FIRST ENTRY
    UPDATE vip_guest_passes
    SET status = 'checked_in',
        scanned_at = NOW(),
        scanned_by = v_scanned_by_uuid,
        updated_at = NOW()
    WHERE id = p_pass_id;

    SELECT COUNT(*) INTO v_checked_in_count
    FROM vip_guest_passes
    WHERE reservation_id = v_pass.reservation_id AND status::TEXT = 'checked_in';

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
    VALUES (p_pass_id, v_pass.reservation_id, 'first_entry', COALESCE(p_scanned_by, 'unknown'));

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

  ELSIF v_pass.status::TEXT = 'checked_in' THEN
    -- RE-ENTRY
    INSERT INTO vip_scan_logs (pass_id, reservation_id, scan_type, scanned_by)
    VALUES (p_pass_id, v_pass.reservation_id, 'reentry', COALESCE(p_scanned_by, 'unknown'));

    SELECT COUNT(*) INTO v_checked_in_count
    FROM vip_guest_passes
    WHERE reservation_id = v_pass.reservation_id AND status::TEXT = 'checked_in';

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
    RETURN json_build_object('success', FALSE, 'error', 'INVALID_STATUS', 'message', 'Pass has unexpected status: ' || v_pass.status::TEXT);
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_vip_scan_with_reentry(UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION process_vip_scan_with_reentry(UUID, TEXT) IS 'Phase 9: Process VIP scan with re-entry support (handles all enum types)';

COMMIT;
