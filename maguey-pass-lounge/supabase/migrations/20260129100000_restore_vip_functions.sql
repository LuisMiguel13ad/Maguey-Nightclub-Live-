-- Migration: Restore VIP Functions
-- Purpose: Restore missing atomic functions for VIP scanner and check-in
-- Created: 2026-01-29

-- 1. verify_vip_pass_signature
CREATE OR REPLACE FUNCTION verify_vip_pass_signature(
  p_qr_token VARCHAR,
  p_signature VARCHAR,
  p_reservation_id UUID DEFAULT NULL,
  p_guest_number INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pass RECORD;
BEGIN
  -- Note: Using qr_code_token to match database schema
  SELECT gp.*, r.status as reservation_status, r.event_id
  INTO v_pass
  FROM vip_guest_passes gp
  JOIN vip_reservations r ON r.id = gp.reservation_id
  WHERE gp.qr_code_token = p_qr_token;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', FALSE, 'error', 'PASS_NOT_FOUND', 'message', 'Guest pass not found');
  END IF;

  IF v_pass.qr_signature != p_signature THEN
    RETURN json_build_object('valid', FALSE, 'error', 'INVALID_SIGNATURE', 'message', 'QR code signature is invalid');
  END IF;

  IF p_reservation_id IS NOT NULL AND v_pass.reservation_id != p_reservation_id THEN
    RETURN json_build_object('valid', FALSE, 'error', 'RESERVATION_MISMATCH', 'message', 'Reservation ID does not match');
  END IF;

  IF p_guest_number IS NOT NULL AND v_pass.guest_number != p_guest_number THEN
    RETURN json_build_object('valid', FALSE, 'error', 'GUEST_NUMBER_MISMATCH', 'message', 'Guest number does not match');
  END IF;

  IF v_pass.status = 'checked_in' THEN
    RETURN json_build_object('valid', FALSE, 'error', 'ALREADY_CHECKED_IN', 'message', 'This pass has already been used', 'checked_in_at', v_pass.checked_in_at);
  END IF;

  IF v_pass.status = 'cancelled' THEN
    RETURN json_build_object('valid', FALSE, 'error', 'PASS_CANCELLED', 'message', 'This pass has been cancelled');
  END IF;

  IF v_pass.reservation_status NOT IN ('confirmed', 'checked_in') THEN
    RETURN json_build_object('valid', FALSE, 'error', 'RESERVATION_NOT_CONFIRMED', 'message', 'Reservation is not confirmed or paid');
  END IF;

  RETURN json_build_object('valid', TRUE, 'pass_id', v_pass.id, 'reservation_id', v_pass.reservation_id, 'guest_number', v_pass.guest_number, 'event_id', v_pass.event_id, 'status', v_pass.status);
END;
$$;

-- 2. check_in_vip_guest_atomic
CREATE OR REPLACE FUNCTION check_in_vip_guest_atomic(
  p_pass_id UUID,
  p_checked_in_by VARCHAR DEFAULT 'system'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pass RECORD;
  v_reservation RECORD;
  v_checked_in_count INTEGER;
BEGIN
  SELECT * INTO v_pass FROM vip_guest_passes WHERE id = p_pass_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'PASS_NOT_FOUND', 'message', 'Guest pass not found');
  END IF;

  IF v_pass.status = 'checked_in' THEN
    RETURN json_build_object('success', FALSE, 'error', 'ALREADY_CHECKED_IN', 'message', 'This pass has already been checked in', 'checked_in_at', v_pass.checked_in_at);
  END IF;

  IF v_pass.status = 'cancelled' THEN
    RETURN json_build_object('success', FALSE, 'error', 'PASS_CANCELLED', 'message', 'This pass has been cancelled');
  END IF;

  SELECT * INTO v_reservation FROM vip_reservations WHERE id = v_pass.reservation_id FOR UPDATE;

  IF v_reservation.status NOT IN ('confirmed', 'checked_in') THEN
    RETURN json_build_object('success', FALSE, 'error', 'RESERVATION_NOT_CONFIRMED', 'message', 'Reservation is not confirmed');
  END IF;

  UPDATE vip_guest_passes SET status = 'checked_in', checked_in_at = NOW(), checked_in_by = p_checked_in_by, updated_at = NOW() WHERE id = p_pass_id;

  SELECT COUNT(*) INTO v_checked_in_count FROM vip_guest_passes WHERE reservation_id = v_pass.reservation_id AND status = 'checked_in';

  UPDATE vip_reservations SET checked_in_guests = v_checked_in_count, checked_in_at = COALESCE(checked_in_at, NOW()), status = 'checked_in', updated_at = NOW() WHERE id = v_pass.reservation_id;

  RETURN json_build_object('success', TRUE, 'pass_id', p_pass_id, 'reservation_id', v_pass.reservation_id, 'guest_number', v_pass.guest_number, 'checked_in_guests', v_checked_in_count, 'checked_in_at', NOW());
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION verify_vip_pass_signature TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_in_vip_guest_atomic TO authenticated, service_role;
