-- Migration: Unified VIP Checkout - Link VIP reservations to purchaser's GA ticket
-- Phase: 04-vip-system-reliability
-- Plan: 04-07
-- Purpose: VIP purchaser must buy GA ticket + VIP table in single atomic transaction

-- ============================================================================
-- 1. Add purchaser_ticket_id column to vip_reservations
-- ============================================================================
ALTER TABLE vip_reservations
ADD COLUMN IF NOT EXISTS purchaser_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;

COMMENT ON COLUMN vip_reservations.purchaser_ticket_id IS
  'Links VIP reservation to purchaser''s GA ticket. This ticket grants entry and identifies them as VIP host.';

-- Index for lookups (e.g., when scanning GA ticket, check if they're a VIP purchaser)
CREATE INDEX IF NOT EXISTS idx_vip_reservations_purchaser_ticket
  ON vip_reservations(purchaser_ticket_id) WHERE purchaser_ticket_id IS NOT NULL;

-- ============================================================================
-- 2. Create unified VIP checkout RPC function
-- ============================================================================
-- This function atomically creates:
-- 1. GA ticket for the VIP purchaser
-- 2. VIP reservation linked to that GA ticket
-- 3. Marks the table as reserved
-- 4. Returns both IDs and the unified QR token (from the GA ticket)

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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id UUID;
  v_reservation_id UUID;
  v_unified_token VARCHAR;
  v_ticket_token VARCHAR;
BEGIN
  -- Generate unified QR token (will be used by the GA ticket)
  v_unified_token := encode(gen_random_bytes(32), 'hex');
  v_ticket_token := encode(gen_random_bytes(16), 'hex');

  -- 1. Create GA ticket for the VIP purchaser
  INSERT INTO tickets (
    event_id,
    ticket_type_id,
    purchaser_email,
    purchaser_name,
    purchaser_phone,
    price_paid,
    qr_code,
    ticket_token,
    purchase_date,
    status
  ) VALUES (
    p_event_id,
    p_tier_id,
    p_purchaser_email,
    p_purchaser_name,
    p_purchaser_phone,
    p_tier_price_cents / 100.0, -- Convert cents to dollars
    v_unified_token,
    v_ticket_token,
    NOW(),
    'valid'
  )
  RETURNING id INTO v_ticket_id;

  -- 2. Create VIP reservation linked to the GA ticket
  INSERT INTO vip_reservations (
    event_id,
    event_vip_table_id,
    table_number,
    purchaser_name,
    purchaser_email,
    purchaser_phone,
    amount_paid_cents,
    stripe_payment_intent_id,
    status,
    qr_code_token,
    purchaser_ticket_id,
    package_snapshot,
    special_requests,
    disclaimer_accepted_at,
    refund_policy_accepted_at
  ) VALUES (
    p_event_id,
    p_table_id,
    p_table_number,
    p_purchaser_name,
    p_purchaser_email,
    p_purchaser_phone,
    p_vip_price_cents, -- Just the VIP table price (GA ticket separate)
    p_stripe_payment_intent_id,
    'pending',
    v_unified_token, -- Use same QR as GA ticket for unified scanning
    v_ticket_id, -- Link to the GA ticket
    p_package_snapshot,
    p_special_requests,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_reservation_id;

  -- 3. Mark table as unavailable (will be confirmed by webhook on payment success)
  UPDATE event_vip_tables
  SET is_available = false,
      updated_at = NOW()
  WHERE id = p_table_id;

  -- 4. Return both IDs and the unified QR token
  RETURN QUERY
  SELECT
    v_ticket_id,
    v_reservation_id,
    v_unified_token,
    v_ticket_token;
END;
$$;

COMMENT ON FUNCTION create_unified_vip_checkout IS
  'Atomically creates GA ticket + VIP reservation in single transaction. Returns unified QR token that serves both purposes: entry + VIP identification.';

-- ============================================================================
-- 3. Grant execution permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION create_unified_vip_checkout TO service_role;
GRANT EXECUTE ON FUNCTION create_unified_vip_checkout TO authenticated;
GRANT EXECUTE ON FUNCTION create_unified_vip_checkout TO anon;
