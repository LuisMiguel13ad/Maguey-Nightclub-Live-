-- ============================================================================
-- Fix VIP status transition trigger to handle enum types correctly
-- ============================================================================
-- The trigger was comparing vip_reservation_status enum to text arrays,
-- which caused type mismatch errors.
-- ============================================================================

BEGIN;

-- Recreate the trigger function with proper type casting
CREATE OR REPLACE FUNCTION validate_vip_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_transition_allowed BOOLEAN := false;
  v_event_start_time TIMESTAMP WITH TIME ZONE;
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  -- Cast enum to text for comparison
  v_old_status := OLD.status::TEXT;
  v_new_status := NEW.status::TEXT;

  -- Allow if status hasn't changed
  IF v_old_status = v_new_status THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions (simple concatenation for comparison)
  v_transition_allowed := (v_old_status || '->' || v_new_status) IN (
    'pending->confirmed',
    'pending->cancelled',
    'confirmed->checked_in',
    'confirmed->cancelled',
    'checked_in->completed'
  );

  IF NOT v_transition_allowed THEN
    RAISE EXCEPTION 'Invalid VIP status transition from % to %. Only forward transitions are allowed.',
      v_old_status, v_new_status
      USING HINT = 'Valid transitions: pending->confirmed, pending->cancelled, confirmed->checked_in, confirmed->cancelled (pre-event), checked_in->completed';
  END IF;

  -- confirmed -> cancelled only allowed before event starts
  IF v_old_status = 'confirmed' AND v_new_status = 'cancelled' THEN
    SELECT e.start_time INTO v_event_start_time
    FROM events e
    WHERE e.id = NEW.event_id;

    IF v_event_start_time IS NOT NULL AND NOW() >= v_event_start_time THEN
      RAISE EXCEPTION 'Cannot cancel VIP reservation after event has started';
    END IF;
  END IF;

  RAISE NOTICE 'VIP status transition: reservation=%, from=% to=%', OLD.id, v_old_status, v_new_status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_vip_status_transition() IS 'Phase 9: Enforces forward-only VIP state transitions (with proper enum handling)';

COMMIT;
