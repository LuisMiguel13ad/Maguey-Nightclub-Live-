-- Migration: VIP State Transition Enforcement
-- Purpose: Enforce forward-only state transitions for VIP reservations at database level
-- Created: 2026-01-30 (Phase 04-01)
--
-- Valid VIP reservation state machine:
--   pending → confirmed (payment success)
--   pending → cancelled (payment failed)
--   pending → expired (timeout - NOTE: 'expired' not in current schema, will be rejected)
--   confirmed → checked_in (first guest arrives)
--   confirmed → cancelled (owner cancellation, pre-event only)
--   checked_in → completed (event ends)
--
-- Invalid transitions (examples):
--   checked_in → confirmed (backward)
--   completed → checked_in (backward)
--   cancelled → confirmed (backward)

-- ============================================================================
-- Function: Validate VIP Status Transition
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

  -- Define valid transitions as array of [from_status, to_status] pairs
  -- Check if the attempted transition is in the allowed list
  v_transition_allowed := ARRAY[OLD.status, NEW.status] = ANY(ARRAY[
    ARRAY['pending', 'confirmed'],
    ARRAY['pending', 'cancelled'],
    ARRAY['confirmed', 'checked_in'],
    ARRAY['confirmed', 'cancelled'],
    ARRAY['checked_in', 'completed']
  ]);

  -- If transition not in allowed list, reject it
  IF NOT v_transition_allowed THEN
    RAISE EXCEPTION 'Invalid VIP status transition from % to %. Only forward transitions are allowed.',
      OLD.status, NEW.status
      USING HINT = 'Valid transitions: pending→confirmed, pending→cancelled, confirmed→checked_in, confirmed→cancelled (pre-event), checked_in→completed';
  END IF;

  -- Special case: confirmed → cancelled only allowed before event starts
  IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
    -- Get event start time
    SELECT e.start_time INTO v_event_start_time
    FROM events e
    WHERE e.id = NEW.event_id;

    -- Reject cancellation if event has started
    IF v_event_start_time IS NOT NULL AND NOW() >= v_event_start_time THEN
      RAISE EXCEPTION 'Cannot cancel VIP reservation after event has started'
        USING HINT = 'Event started at %. Cancellations only allowed pre-event.', v_event_start_time;
    END IF;
  END IF;

  -- Log the transition for debugging
  RAISE NOTICE 'VIP status transition: reservation=%, from=% to=%, at=%',
    OLD.id, OLD.status, NEW.status, NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger: Enforce VIP Status Transition
-- ============================================================================
DROP TRIGGER IF EXISTS enforce_vip_status_transition ON vip_reservations;

CREATE TRIGGER enforce_vip_status_transition
  BEFORE UPDATE OF status ON vip_reservations
  FOR EACH ROW
  EXECUTE FUNCTION validate_vip_status_transition();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION validate_vip_status_transition() IS
'Enforces forward-only state transitions for VIP reservations. Prevents data corruption from invalid status changes like checked_in→confirmed.';

COMMENT ON TRIGGER enforce_vip_status_transition ON vip_reservations IS
'Validates all VIP reservation status changes before they are committed to ensure state machine integrity.';
