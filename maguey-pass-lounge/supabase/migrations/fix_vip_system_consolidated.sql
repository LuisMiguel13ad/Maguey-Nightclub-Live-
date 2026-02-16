-- ============================================================================
-- CONSOLIDATED VIP SYSTEM FIX
-- targets: event_vip_tables, vip_reservations, vip_guest_passes
-- ============================================================================

-- STEP 1: DROP OLD POLICIES (Ensures clean state)
DO $$ 
BEGIN
    -- Drop policies on vip_reservations
    DROP POLICY IF EXISTS "vip_reservations_select_policy" ON vip_reservations;
    DROP POLICY IF EXISTS "vip_reservations_insert_policy" ON vip_reservations;
    DROP POLICY IF EXISTS "vip_reservations_update_policy" ON vip_reservations;
    DROP POLICY IF EXISTS "Anyone can view reservations" ON vip_reservations;
    DROP POLICY IF EXISTS "Authenticated users can create reservations" ON vip_reservations;
    DROP POLICY IF EXISTS "Service role can do anything" ON vip_reservations;
    DROP POLICY IF EXISTS "Users can view their own VIP reservations" ON vip_reservations;
    DROP POLICY IF EXISTS "Anyone can create VIP reservations" ON vip_reservations;
    DROP POLICY IF EXISTS "Service role can manage VIP reservations" ON vip_reservations;
    DROP POLICY IF EXISTS "Users can view own reservations" ON vip_reservations;

    -- Drop policies on vip_guest_passes
    DROP POLICY IF EXISTS "vip_guest_passes_select_policy" ON vip_guest_passes;
    DROP POLICY IF EXISTS "vip_guest_passes_insert_policy" ON vip_guest_passes;
    DROP POLICY IF EXISTS "vip_guest_passes_update_policy" ON vip_guest_passes;
    DROP POLICY IF EXISTS "Anyone can view guest passes" ON vip_guest_passes;
    DROP POLICY IF EXISTS "Users can view their VIP guest passes" ON vip_guest_passes;
    DROP POLICY IF EXISTS "Service role can manage VIP guest passes" ON vip_guest_passes;
    DROP POLICY IF EXISTS "Users can view own guest passes" ON vip_guest_passes;
    DROP POLICY IF EXISTS "Service role can create guest passes" ON vip_guest_passes;
    DROP POLICY IF EXISTS "Service role can update guest passes" ON vip_guest_passes;

    -- Enable RLS
    ALTER TABLE IF EXISTS vip_reservations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS vip_guest_passes ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN undefined_table THEN
        NULL; -- Handle if tables don't exist yet
END $$;

-- STEP 2: CREATE/UPDATE ATOMIC FUNCTIONS

-- 2a. create_vip_reservation_atomic
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

  -- Generate guest passes
  v_passes := ARRAY[]::JSON[];
  FOR i IN 1..p_guest_count LOOP
    v_pass_token := 'VIP-PASS-' || upper(substring(gen_random_uuid()::text, 1, 8));
    v_pass_signature := encode(sha256((v_pass_token || v_reservation_id::text || i::text)::bytea), 'hex');

    INSERT INTO vip_guest_passes (reservation_id, guest_number, qr_code_token, qr_signature, status)
    VALUES (v_reservation_id, i, v_pass_token, v_pass_signature, 'issued');

    v_passes := v_passes || json_build_object(
      'guest_number', i, 'qr_code_token', v_pass_token, 'qr_signature', v_pass_signature
    )::JSON;
  END LOOP;

  -- Mark table as unavailable for walk-ins
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

-- 2b. verify_vip_pass_signature
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

-- 2c. check_in_vip_guest_atomic
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

-- Permissions
GRANT EXECUTE ON FUNCTION create_vip_reservation_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION verify_vip_pass_signature TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_in_vip_guest_atomic TO authenticated, service_role;

-- STEP 3: CREATE NEW POLICIES
CREATE POLICY "Users can view own reservations" ON vip_reservations FOR SELECT
  USING (purchaser_email = auth.jwt() ->> 'email' OR auth.role() = 'service_role');

CREATE POLICY "Authenticated users can create reservations" ON vip_reservations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role can update reservations" ON vip_reservations FOR UPDATE
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view own guest passes" ON vip_guest_passes FOR SELECT
  USING (EXISTS (SELECT 1 FROM vip_reservations r WHERE r.id = vip_guest_passes.reservation_id AND r.purchaser_email = auth.jwt() ->> 'email') OR auth.role() = 'service_role');

CREATE POLICY "Service role can create guest passes" ON vip_guest_passes FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update guest passes" ON vip_guest_passes FOR UPDATE
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- STEP 4: INDEXES
DROP INDEX IF EXISTS idx_unique_active_reservation_per_table;
CREATE UNIQUE INDEX idx_unique_active_reservation_per_table
  ON vip_reservations (event_id, event_vip_table_id)
  WHERE status IN ('pending', 'confirmed', 'checked_in');

CREATE INDEX IF NOT EXISTS idx_vip_reservations_email ON vip_reservations (purchaser_email);
CREATE INDEX IF NOT EXISTS idx_vip_guest_passes_reservation ON vip_guest_passes (reservation_id);
CREATE INDEX IF NOT EXISTS idx_vip_guest_passes_qr_token ON vip_guest_passes (qr_code_token);

-- STEP 5: SYNC MIGRATION HISTORY (Optional but recommended)
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version TEXT PRIMARY KEY, statements TEXT[], name TEXT);
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260122000000', '20260122000000_fix_vip_race_condition_and_rls.sql') ON CONFLICT (version) DO NOTHING;

SELECT 'VIP System Consolidation Complete!' as status;
