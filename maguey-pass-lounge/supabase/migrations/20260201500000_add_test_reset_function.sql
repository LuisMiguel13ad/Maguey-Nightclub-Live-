-- ============================================================================
-- Add test reset function for E2E testing
-- ============================================================================
-- This function bypasses the state machine to reset test data.
-- Only available via service_role (not callable by authenticated users).
-- ============================================================================

BEGIN;

-- Create a function to reset VIP test state
CREATE OR REPLACE FUNCTION reset_vip_test_state(
  p_reservation_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pass_count INTEGER;
BEGIN
  -- Temporarily disable the trigger
  ALTER TABLE vip_reservations DISABLE TRIGGER enforce_vip_status_transition;

  -- Reset reservation
  UPDATE vip_reservations
  SET status = 'confirmed',
      checked_in_guests = 0,
      checked_in_at = NULL,
      updated_at = NOW()
  WHERE id = p_reservation_id;

  -- Re-enable the trigger
  ALTER TABLE vip_reservations ENABLE TRIGGER enforce_vip_status_transition;

  -- Reset all guest passes for this reservation
  UPDATE vip_guest_passes
  SET status = 'issued',
      scanned_at = NULL,
      scanned_by = NULL,
      updated_at = NOW()
  WHERE reservation_id = p_reservation_id;

  SELECT COUNT(*) INTO v_pass_count FROM vip_guest_passes WHERE reservation_id = p_reservation_id;

  -- Delete scan logs for this reservation
  DELETE FROM vip_scan_logs WHERE reservation_id = p_reservation_id;

  RETURN json_build_object(
    'success', TRUE,
    'message', 'Test state reset successfully',
    'passes_reset', v_pass_count
  );
END;
$$;

-- Only allow service role to call this
REVOKE ALL ON FUNCTION reset_vip_test_state(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION reset_vip_test_state(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION reset_vip_test_state(UUID) TO service_role;

COMMENT ON FUNCTION reset_vip_test_state(UUID) IS 'Phase 9: Reset VIP test state (service_role only, for E2E testing)';

COMMIT;
