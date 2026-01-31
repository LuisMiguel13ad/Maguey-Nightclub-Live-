-- Migration: VIP Increment Checked-In Count
-- Purpose: Function to increment VIP reservation checked_in_guests when linked GA ticket scans
-- Context: Part of 04-06 GA scanner VIP link detection
-- Created: 2026-01-30

-- ============================================================================
-- Create increment_vip_checked_in function
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_vip_checked_in(
  p_reservation_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_new_count INTEGER;
BEGIN
  -- Lock and select the VIP reservation
  SELECT * INTO v_reservation
  FROM vip_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  -- Return error if not found
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'RESERVATION_NOT_FOUND',
      'message', 'VIP reservation not found'
    );
  END IF;

  -- Increment checked_in_guests count
  v_new_count := COALESCE(v_reservation.checked_in_guests, 0) + 1;

  -- Update the reservation
  UPDATE vip_reservations
  SET
    checked_in_guests = v_new_count,
    -- Update status to checked_in if currently confirmed
    status = CASE
      WHEN status = 'confirmed' THEN 'checked_in'
      ELSE status
    END,
    -- Set checked_in_at if null (first guest arrival)
    checked_in_at = COALESCE(checked_in_at, NOW()),
    updated_at = NOW()
  WHERE id = p_reservation_id;

  -- Return success with new count
  RETURN json_build_object(
    'success', TRUE,
    'reservation_id', p_reservation_id,
    'checked_in_guests', v_new_count,
    'message', 'Checked-in count incremented'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'INCREMENT_FAILED',
      'message', SQLERRM
    );
END;
$$;

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION increment_vip_checked_in TO authenticated, service_role;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION increment_vip_checked_in IS 'Increment VIP reservation checked_in_guests when linked GA ticket scans - atomically updates count and status';
