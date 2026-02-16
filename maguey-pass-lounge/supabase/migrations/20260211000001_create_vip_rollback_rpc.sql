-- Migration: Create transactional VIP checkout rollback
-- Replaces three independent operations with a single atomic rollback
-- to prevent ghost reservations when Stripe payment intent creation fails.

BEGIN;

CREATE OR REPLACE FUNCTION rollback_vip_checkout(
  p_reservation_id UUID,
  p_ticket_id UUID,
  p_table_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_reservation_deleted BOOLEAN := false;
  v_ticket_deleted BOOLEAN := false;
  v_table_restored BOOLEAN := false;
BEGIN
  -- Delete the pending reservation
  DELETE FROM vip_reservations WHERE id = p_reservation_id AND status = 'pending';
  IF FOUND THEN
    v_reservation_deleted := true;
  END IF;

  -- Delete the associated ticket
  DELETE FROM tickets WHERE id = p_ticket_id;
  IF FOUND THEN
    v_ticket_deleted := true;
  END IF;

  -- Restore table availability
  UPDATE event_vip_tables SET is_available = true, updated_at = NOW() WHERE id = p_table_id;
  IF FOUND THEN
    v_table_restored := true;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'reservation_deleted', v_reservation_deleted,
    'ticket_deleted', v_ticket_deleted,
    'table_restored', v_table_restored
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION rollback_vip_checkout TO service_role, authenticated, anon;

COMMENT ON FUNCTION rollback_vip_checkout IS 'Atomically rollback a VIP checkout (reservation + ticket + table) when payment intent creation fails';

COMMIT;
