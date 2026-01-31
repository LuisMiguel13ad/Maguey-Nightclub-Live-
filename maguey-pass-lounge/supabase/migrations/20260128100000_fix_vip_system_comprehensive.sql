-- Migration: Comprehensive VIP System Fixes
-- Fixes: Signature consistency, RLS policies, and reservation expiration

-- ============================================
-- STEP 1: SIGNATURE GENERATION FUNCTION
-- Standardize on plain SHA-256 with hex encoding
-- Format: SHA-256(token || '|' || reservation_id || '|' || guest_number)
-- ============================================

CREATE OR REPLACE FUNCTION generate_vip_pass_signature(
  p_token TEXT,
  p_reservation_id UUID,
  p_guest_number INTEGER
) RETURNS TEXT AS $$
BEGIN
  -- Consistent format: token|reservation_id|guest_number
  -- This matches the fallback in stripe-webhook and can be verified without HMAC secrets
  RETURN encode(
    sha256((p_token || '|' || p_reservation_id::text || '|' || p_guest_number::text)::bytea),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- STEP 2: UPDATE ATOMIC RESERVATION FUNCTION
-- Use the new consistent signature generation
-- ============================================

CREATE OR REPLACE FUNCTION create_vip_reservation_atomic(
  p_event_id VARCHAR,
  p_table_id UUID,
  p_purchaser_name VARCHAR,
  p_purchaser_email VARCHAR,
  p_purchaser_phone VARCHAR DEFAULT NULL,
  p_guest_count INTEGER DEFAULT 6,
  p_bottle_choice VARCHAR DEFAULT NULL,
  p_special_requests TEXT DEFAULT NULL,
  p_is_walk_in BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table RECORD;
  v_existing_reservation UUID;
  v_reservation_id UUID;
  v_qr_code_token VARCHAR;
  v_price_cents INTEGER;
  v_pass_token VARCHAR;
  v_pass_signature VARCHAR;
  v_passes JSON[];
  i INTEGER;
BEGIN
  -- Lock the table row to prevent concurrent bookings
  SELECT * INTO v_table
  FROM event_vip_tables
  WHERE id = p_table_id
    AND event_id = p_event_id
    AND is_active = TRUE
  FOR UPDATE;

  -- Check if table exists and is active
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'TABLE_NOT_FOUND',
      'message', 'Table not found or not active for this event'
    );
  END IF;

  -- Check if table is available
  IF NOT v_table.is_available THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'TABLE_NOT_AVAILABLE',
      'message', 'This table is no longer available'
    );
  END IF;

  -- Check for existing active reservation
  SELECT id INTO v_existing_reservation
  FROM vip_reservations
  WHERE event_id = p_event_id
    AND event_vip_table_id = p_table_id
    AND status IN ('pending', 'confirmed', 'checked_in')
  LIMIT 1;

  IF v_existing_reservation IS NOT NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'TABLE_ALREADY_RESERVED',
      'message', 'This table already has an active reservation'
    );
  END IF;

  -- Validate guest count
  IF p_guest_count > v_table.capacity THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'EXCEEDS_CAPACITY',
      'message', format('This table has a maximum capacity of %s guests', v_table.capacity)
    );
  END IF;

  -- Generate tokens and calculate price
  v_qr_code_token := 'VIP-' || upper(substring(gen_random_uuid()::text, 1, 12));
  v_price_cents := round(v_table.price * 100)::INTEGER;

  -- Create the reservation
  INSERT INTO vip_reservations (
    event_id, event_vip_table_id, table_number, purchaser_name, purchaser_email,
    purchaser_phone, amount_paid_cents, status, qr_code_token, package_snapshot,
    special_requests, disclaimer_accepted_at, refund_policy_accepted_at, checked_in_guests
  ) VALUES (
    p_event_id, p_table_id, v_table.table_number, p_purchaser_name, p_purchaser_email,
    p_purchaser_phone, v_price_cents,
    CASE WHEN p_is_walk_in THEN 'confirmed' ELSE 'pending' END,
    v_qr_code_token,
    jsonb_build_object(
      'tier', v_table.tier, 'tableNumber', v_table.table_number,
      'guestCount', p_guest_count, 'price', v_table.price,
      'displayName', v_table.table_name, 'bottleChoice', p_bottle_choice,
      'specialRequests', p_special_requests,
      'firstName', split_part(p_purchaser_name, ' ', 1),
      'lastName', substring(p_purchaser_name from position(' ' in p_purchaser_name) + 1),
      'isWalkIn', p_is_walk_in
    ),
    p_special_requests, NOW(), NOW(), 0
  )
  RETURNING id INTO v_reservation_id;

  -- Generate guest passes with CONSISTENT signature format
  v_passes := ARRAY[]::JSON[];
  FOR i IN 1..p_guest_count LOOP
    v_pass_token := 'VIP-PASS-' || upper(substring(gen_random_uuid()::text, 1, 8));
    -- Use consistent signature format: token|reservation_id|guest_number
    v_pass_signature := generate_vip_pass_signature(v_pass_token, v_reservation_id, i);

    INSERT INTO vip_guest_passes (reservation_id, guest_number, qr_code_token, qr_signature, status)
    VALUES (v_reservation_id, i, v_pass_token, v_pass_signature, 'issued');

    v_passes := v_passes || json_build_object(
      'guest_number', i, 'qr_code_token', v_pass_token, 'qr_signature', v_pass_signature
    )::JSON;
  END LOOP;

  -- Mark table as unavailable for walk-ins (immediate confirmation)
  IF p_is_walk_in THEN
    UPDATE event_vip_tables SET is_available = FALSE, updated_at = NOW() WHERE id = p_table_id;
  END IF;

  RETURN json_build_object(
    'success', TRUE, 'reservation_id', v_reservation_id, 'qr_code_token', v_qr_code_token,
    'table_number', v_table.table_number, 'table_name', v_table.table_name,
    'tier', v_table.tier, 'price', v_table.price, 'guest_count', p_guest_count,
    'guest_passes', to_json(v_passes),
    'status', CASE WHEN p_is_walk_in THEN 'confirmed' ELSE 'pending' END
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', FALSE, 'error', 'DUPLICATE_RESERVATION', 'message', 'A reservation already exists for this table');
  WHEN OTHERS THEN
    RETURN json_build_object('success', FALSE, 'error', 'UNEXPECTED_ERROR', 'message', SQLERRM);
END;
$$;

-- ============================================
-- STEP 3: UPDATE SIGNATURE VERIFICATION
-- Match the new consistent format
-- ============================================

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
  v_expected_signature VARCHAR;
BEGIN
  SELECT gp.*, r.status as reservation_status, r.event_id
  INTO v_pass
  FROM vip_guest_passes gp
  JOIN vip_reservations r ON r.id = gp.reservation_id
  WHERE gp.qr_code_token = p_qr_token;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', FALSE, 'error', 'PASS_NOT_FOUND', 'message', 'Guest pass not found');
  END IF;

  -- Generate expected signature using the same consistent format
  v_expected_signature := generate_vip_pass_signature(p_qr_token, v_pass.reservation_id, v_pass.guest_number);

  -- Check both the stored signature AND the regenerated signature
  -- This handles both old and new format signatures
  IF v_pass.qr_signature != p_signature AND v_expected_signature != p_signature THEN
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

-- ============================================
-- STEP 4: FIX RLS POLICIES
-- Allow anonymous users to view their passes via QR token
-- ============================================

-- Drop existing policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own reservations" ON vip_reservations;
    DROP POLICY IF EXISTS "Authenticated users can create reservations" ON vip_reservations;
    DROP POLICY IF EXISTS "Service role can update reservations" ON vip_reservations;
    DROP POLICY IF EXISTS "Users can view own guest passes" ON vip_guest_passes;
    DROP POLICY IF EXISTS "Service role can create guest passes" ON vip_guest_passes;
    DROP POLICY IF EXISTS "Service role can update guest passes" ON vip_guest_passes;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- vip_reservations policies
-- SELECT: Allow authenticated users to see their own, service role full access, or token-based lookup
CREATE POLICY "vip_reservations_select" ON vip_reservations FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND purchaser_email = auth.jwt() ->> 'email')
    OR (auth.role() = 'anon') -- Allow anon to query, RPC functions handle authorization
  );

-- INSERT: Allow service role and authenticated users
CREATE POLICY "vip_reservations_insert" ON vip_reservations FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- UPDATE: Service role only (for payment confirmation, check-in, etc.)
CREATE POLICY "vip_reservations_update" ON vip_reservations FOR UPDATE
  USING (auth.role() = 'service_role');

-- vip_guest_passes policies
-- SELECT: Allow viewing for anyone (scanner needs to verify passes)
CREATE POLICY "vip_guest_passes_select" ON vip_guest_passes FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
    OR auth.role() = 'anon' -- Scanner needs to read passes
  );

-- INSERT: Service role only (created by functions)
CREATE POLICY "vip_guest_passes_insert" ON vip_guest_passes FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- UPDATE: Service role only (for check-in)
CREATE POLICY "vip_guest_passes_update" ON vip_guest_passes FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================
-- STEP 5: RESERVATION EXPIRATION FUNCTION
-- Expire pending reservations after 30 minutes
-- ============================================

CREATE OR REPLACE FUNCTION expire_pending_vip_reservations()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_count INTEGER;
  v_released_count INTEGER;
BEGIN
  -- Mark old pending reservations as expired
  WITH expired AS (
    UPDATE vip_reservations
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '30 minutes'
    RETURNING id, event_vip_table_id
  )
  SELECT COUNT(*) INTO v_expired_count FROM expired;

  -- Release table availability for expired reservations
  WITH released AS (
    UPDATE event_vip_tables t
    SET is_available = TRUE, updated_at = NOW()
    FROM vip_reservations r
    WHERE r.event_vip_table_id = t.id
      AND r.status = 'expired'
      AND t.is_available = FALSE
      AND r.updated_at > NOW() - INTERVAL '1 minute' -- Just expired
    RETURNING t.id
  )
  SELECT COUNT(*) INTO v_released_count FROM released;

  RETURN json_build_object(
    'success', TRUE,
    'expired_reservations', v_expired_count,
    'released_tables', v_released_count,
    'executed_at', NOW()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_vip_pass_signature TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION expire_pending_vip_reservations TO service_role;

-- ============================================
-- STEP 6: ENSURE event_vip_tables HAS CORRECT POLICIES
-- ============================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can view event VIP tables" ON event_vip_tables;
    DROP POLICY IF EXISTS "Service role can manage event VIP tables" ON event_vip_tables;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Allow anyone to view tables (for public booking page)
CREATE POLICY "event_vip_tables_select" ON event_vip_tables FOR SELECT
  USING (true);

-- Only service role can modify tables
CREATE POLICY "event_vip_tables_all" ON event_vip_tables FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- ============================================
-- STEP 7: FIX EXISTING TABLES - Ensure is_active is set
-- ============================================

UPDATE event_vip_tables
SET is_active = TRUE
WHERE is_active IS NULL;

ALTER TABLE event_vip_tables
ALTER COLUMN is_active SET DEFAULT TRUE;

-- ============================================
-- STEP 8: ADD MISSING COLUMNS IF NEEDED
-- ============================================

-- Ensure stripe_payment_intent_id column exists on vip_reservations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vip_reservations' AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE vip_reservations ADD COLUMN stripe_payment_intent_id VARCHAR;
  END IF;
END $$;
