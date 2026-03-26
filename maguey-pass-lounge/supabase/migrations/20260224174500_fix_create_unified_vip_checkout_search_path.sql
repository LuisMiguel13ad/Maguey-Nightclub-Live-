-- Fix create_unified_vip_checkout by explicitly adding search_path for pgcrypto
-- This resolves a 'gen_random_bytes(integer) does not exist' issue in the VIP checkout

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
SET search_path = public, extensions
AS $$
DECLARE
  v_ticket_id UUID;
  v_reservation_id UUID;
  v_order_id UUID;
  v_unified_token VARCHAR;
  v_ticket_token VARCHAR;
BEGIN
  v_unified_token := encode(gen_random_bytes(32), 'hex');
  v_ticket_token := encode(gen_random_bytes(16), 'hex');

  -- Create parent order
  INSERT INTO orders (event_id, purchaser_email, purchaser_name, subtotal, fees_total, total, status, metadata)
  VALUES (
    p_event_id::uuid, 
    p_purchaser_email, 
    p_purchaser_name, 
    p_total_amount_cents / 100.0, 
    0, 
    p_total_amount_cents / 100.0, 
    'paid', 
    '{"type": "vip_unified"}'::jsonb
  )
  RETURNING id INTO v_order_id;

  -- Create GA ticket
  INSERT INTO tickets (order_id, event_id, ticket_type_id, attendee_email, attendee_name, price, qr_code_value, qr_token, purchase_date, status)
  VALUES (v_order_id, p_event_id::uuid, p_tier_id, p_purchaser_email, p_purchaser_name, p_tier_price_cents / 100.0, v_unified_token, v_ticket_token, NOW(), 'valid')
  RETURNING id INTO v_ticket_id;

  -- Create VIP reservation
  INSERT INTO vip_reservations (event_id, event_vip_table_id, table_number, purchaser_name, purchaser_email, purchaser_phone, amount_paid_cents, stripe_payment_intent_id, status, qr_code_token, purchaser_ticket_id, package_snapshot, special_requests, disclaimer_accepted_at, refund_policy_accepted_at)
  VALUES (p_event_id::uuid, p_table_id, p_table_number, p_purchaser_name, p_purchaser_email, p_purchaser_phone, p_vip_price_cents, p_stripe_payment_intent_id, 'pending', v_unified_token, v_ticket_id, p_package_snapshot, p_special_requests, NOW(), NOW())
  RETURNING id INTO v_reservation_id;

  -- Mark table as unavailable
  UPDATE event_vip_tables SET is_available = false, updated_at = NOW() WHERE id = p_table_id;

  RETURN QUERY SELECT v_ticket_id, v_reservation_id, v_unified_token, v_ticket_token;
END;
$$;
