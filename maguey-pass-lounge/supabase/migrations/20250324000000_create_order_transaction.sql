-- Migration: Create Atomic Order Transaction Function
-- This migration creates a PostgreSQL function that wraps order and ticket creation
-- in a single transaction to prevent orphaned records

BEGIN;

-- Enable pgcrypto extension for HMAC signature generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. HELPER FUNCTION: Generate QR Signature
-- ============================================

-- Function to generate HMAC-SHA256 signature for QR tokens
CREATE OR REPLACE FUNCTION generate_qr_signature(
  p_token TEXT,
  p_secret TEXT
)
RETURNS TEXT AS $$
BEGIN
  -- Generate HMAC-SHA256 signature and encode as base64
  RETURN encode(hmac(p_token, p_secret, 'sha256'), 'base64');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 2. HELPER FUNCTION: Generate Human-Readable Ticket ID
-- ============================================

CREATE OR REPLACE FUNCTION generate_human_readable_ticket_id(
  p_event_id TEXT,
  p_order_id UUID,
  p_index INTEGER
)
RETURNS TEXT AS $$
DECLARE
  v_date_str TEXT;
  v_short_order_id TEXT;
  v_random_suffix TEXT;
BEGIN
  v_date_str := to_char(NOW(), 'YYYYMMDD');
  v_short_order_id := UPPER(SUBSTRING(p_order_id::TEXT, 1, 8));
  -- Generate random suffix (4 alphanumeric chars)
  v_random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || p_index::TEXT), 1, 4));
  RETURN format('MGY-%s-%s-%s-%s', 
    UPPER(SUBSTRING(p_event_id, 1, 2)), 
    v_date_str, 
    v_short_order_id, 
    v_random_suffix
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. MAIN FUNCTION: Atomic Order Creation
-- ============================================

CREATE OR REPLACE FUNCTION create_order_with_tickets_atomic(
  -- Required parameters (no defaults) - must come first
  p_event_id TEXT,
  p_purchaser_email TEXT,
  p_purchaser_name TEXT,
  p_subtotal NUMERIC,
  p_fees_total NUMERIC,
  p_total NUMERIC,
  p_line_items JSONB,
  
  -- Optional parameters (with defaults) - must come after required
  p_user_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'paid',
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_promo_code_id UUID DEFAULT NULL,
  p_attendee_name TEXT DEFAULT NULL,
  p_attendee_email TEXT DEFAULT NULL,
  p_qr_signing_secret TEXT DEFAULT 'your-super-secret-key-change-this-in-production-12345'
)
RETURNS TABLE(
  order_id UUID,
  order_data JSONB,
  tickets_data JSONB,
  ticket_email_payloads JSONB
) AS $$
DECLARE
  v_order_id UUID;
  v_line_item JSONB;
  v_ticket_type_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC;
  v_unit_fee NUMERIC;
  v_display_name TEXT;
  v_ticket_rows JSONB[] := ARRAY[]::JSONB[];
  v_email_payloads JSONB[] := ARRAY[]::JSONB[];
  v_qr_token UUID;
  v_qr_signature TEXT;
  v_ticket_id TEXT;
  v_issued_at TIMESTAMPTZ := NOW();
  v_reservation_result RECORD;
  v_ticket_count INTEGER := 0;
  v_attendee_name TEXT;
  v_attendee_email TEXT;
BEGIN
  -- Validate inputs
  IF p_line_items IS NULL OR jsonb_array_length(p_line_items) = 0 THEN
    RAISE EXCEPTION 'No line items provided';
  END IF;

  -- Set attendee info defaults
  v_attendee_name := COALESCE(p_attendee_name, p_purchaser_name);
  v_attendee_email := COALESCE(p_attendee_email, p_purchaser_email);

  -- Step 1: Reserve tickets atomically (from Prompt 1)
  -- This uses FOR UPDATE locking to prevent race conditions
  SELECT * INTO v_reservation_result
  FROM reserve_tickets_batch(p_line_items);

  IF NOT FOUND OR NOT (v_reservation_result.success) THEN
    RAISE EXCEPTION 'Failed to reserve tickets: %', 
      COALESCE(v_reservation_result.error_message, 'Unknown error');
  END IF;

  -- Step 2: Create order record
  INSERT INTO orders (
    event_id,
    purchaser_email,
    purchaser_name,
    user_id,
    subtotal,
    fees_total,
    total,
    status,
    metadata,
    promo_code_id
  ) VALUES (
    p_event_id,
    p_purchaser_email,
    p_purchaser_name,
    p_user_id,
    p_subtotal,
    p_fees_total,
    p_total,
    p_status,
    p_metadata,
    p_promo_code_id
  ) RETURNING id INTO v_order_id;

  -- Step 3: Create tickets for each line item
  FOR v_line_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    v_ticket_type_id := (v_line_item->>'ticket_type_id')::UUID;
    v_quantity := (v_line_item->>'quantity')::INTEGER;
    v_unit_price := (v_line_item->>'unit_price')::NUMERIC;
    v_unit_fee := (v_line_item->>'unit_fee')::NUMERIC;
    v_display_name := v_line_item->>'display_name';

    -- Create tickets for this line item
    FOR i IN 1..v_quantity
    LOOP
      -- Generate QR token (UUID)
      v_qr_token := gen_random_uuid();
      
      -- Generate QR signature
      v_qr_signature := generate_qr_signature(v_qr_token::TEXT, p_qr_signing_secret);
      
      -- Generate human-readable ticket ID
      v_ticket_id := generate_human_readable_ticket_id(p_event_id, v_order_id, v_ticket_count);
      
      -- Build ticket row
      v_ticket_rows := array_append(v_ticket_rows, jsonb_build_object(
        'qr_token', v_qr_token,
        'event_id', p_event_id,
        'ticket_type_id', v_ticket_type_id,
        'attendee_name', v_attendee_name,
        'attendee_email', v_attendee_email,
        'order_id', v_order_id,
        'status', 'issued',
        'issued_at', v_issued_at,
        'price', v_unit_price,
        'fee_total', v_unit_fee,
        'qr_signature', v_qr_signature,
        'qr_code_value', v_qr_token,
        'ticket_id', v_ticket_id
      ));

      -- Build email payload (for return to application)
      v_email_payloads := array_append(v_email_payloads, jsonb_build_object(
        'ticketId', v_qr_token,
        'qrToken', v_qr_token,
        'qrSignature', v_qr_signature,
        'ticket_id', v_ticket_id
      ));

      v_ticket_count := v_ticket_count + 1;
    END LOOP;
  END LOOP;

  -- Bulk insert all tickets
  IF array_length(v_ticket_rows, 1) > 0 THEN
    INSERT INTO tickets (
      qr_token,
      event_id,
      ticket_type_id,
      attendee_name,
      attendee_email,
      order_id,
      status,
      issued_at,
      price,
      fee_total,
      qr_signature,
      qr_code_value,
      ticket_id
    )
    SELECT
      (t->>'qr_token')::UUID,
      t->>'event_id',
      (t->>'ticket_type_id')::UUID,
      t->>'attendee_name',
      t->>'attendee_email',
      (t->>'order_id')::UUID,
      t->>'status',
      (t->>'issued_at')::TIMESTAMPTZ,
      (t->>'price')::NUMERIC,
      (t->>'fee_total')::NUMERIC,
      t->>'qr_signature',
      t->>'qr_code_value',
      t->>'ticket_id'
    FROM unnest(v_ticket_rows) AS t;
  END IF;

  -- Return order and tickets data
  RETURN QUERY SELECT
    v_order_id,
    (SELECT row_to_json(o)::JSONB FROM orders o WHERE o.id = v_order_id) AS order_data,
    (SELECT jsonb_agg(t) FROM unnest(v_ticket_rows) AS t) AS tickets_data,
    (SELECT jsonb_agg(e) FROM unnest(v_email_payloads) AS e) AS ticket_email_payloads;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================

-- Grant execute permission to authenticated users and anon role
GRANT EXECUTE ON FUNCTION create_order_with_tickets_atomic TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_qr_signature TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_human_readable_ticket_id TO authenticated, anon;

COMMIT;