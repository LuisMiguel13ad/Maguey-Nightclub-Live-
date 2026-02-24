-- VIP End-to-End Test Data Seed Script
-- Creates complete VIP test scenario with predictable data for E2E testing
-- Uses standard table numbering 1-26 matching the production layout
--
-- IMPORTANT: Run via TypeScript script for best results:
--   npx tsx scripts/apply-vip-seed.ts
--
-- Or copy this SQL to Supabase SQL Editor (remove \echo commands first)

-- ============================================================================
-- Test Event (30 days in future to ensure active)
-- ============================================================================
INSERT INTO events (
  id,
  name,
  event_date,
  event_time,
  genre,
  venue_name,
  venue_address,
  city,
  description,
  image_url,
  is_active,
  status,
  vip_enabled
)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  'VIP E2E Test Event',
  (CURRENT_DATE + INTERVAL '30 days')::date,
  '22:00:00',
  'Reggaeton',
  'Test Venue',
  '123 Test Street',
  'Test City',
  'Test event for VIP end-to-end testing',
  'https://via.placeholder.com/800x600',
  true,
  'published',
  true
)
ON CONFLICT (id) DO UPDATE SET
  event_date = EXCLUDED.event_date,
  is_active = true,
  status = 'published',
  vip_enabled = true,
  updated_at = NOW();

-- ============================================================================
-- VIP Tables - Full 26-table layout matching production design
-- Premium (1,2,3,8), Front Row (4,5,6,7), Standard (9-26)
-- ============================================================================

-- Clean up any existing tables for this event first
DELETE FROM event_vip_tables WHERE event_id = '99999999-9999-9999-9999-999999999999'
  AND id NOT IN (SELECT event_vip_table_id FROM vip_reservations WHERE event_id = '99999999-9999-9999-9999-999999999999');

-- Insert all 26 tables with proper positions
INSERT INTO event_vip_tables (
  event_id, table_template_id, table_number, tier, price_cents,
  capacity, bottles_included, champagne_included, package_description,
  is_available, display_order, position_x, position_y
)
SELECT
  '99999999-9999-9999-9999-999999999999',
  t.id,
  t.table_number,
  CASE
    WHEN t.table_number IN (1,2,3,8) THEN 'premium'
    WHEN t.table_number IN (4,5,6,7) THEN 'front_row'
    ELSE 'standard'
  END,
  CASE
    WHEN t.table_number IN (1,2,3,8) THEN 75000
    WHEN t.table_number IN (4,5,6,7) THEN 70000
    ELSE 60000
  END,
  CASE WHEN t.table_number IN (1,2,3,8) THEN 8 ELSE 6 END,
  1, -- bottles_included
  CASE WHEN t.table_number IN (1,2,3,8) THEN 1 ELSE 0 END, -- champagne
  CASE
    WHEN t.table_number IN (1,2,3,8) THEN '1 Bottle + 1 Champagne'
    ELSE '1 Bottle'
  END,
  true,
  t.table_number,
  -- Position X
  CASE
    WHEN t.table_number IN (1,2,3) THEN 50
    WHEN t.table_number = 4 THEN 250
    WHEN t.table_number = 5 THEN 400
    WHEN t.table_number = 6 THEN 550
    WHEN t.table_number = 7 THEN 700
    WHEN t.table_number = 8 THEN 900
    WHEN t.table_number IN (9,15,21) THEN 200
    WHEN t.table_number IN (10,16,22) THEN 350
    WHEN t.table_number IN (11,17,23) THEN 500
    WHEN t.table_number IN (12,18,24) THEN 650
    WHEN t.table_number IN (13,19,25) THEN 800
    WHEN t.table_number IN (14,20,26) THEN 950
  END,
  -- Position Y
  CASE
    WHEN t.table_number = 1 THEN 100
    WHEN t.table_number = 2 THEN 250
    WHEN t.table_number = 3 THEN 400
    WHEN t.table_number IN (4,5,6,7,8) THEN 100
    WHEN t.table_number BETWEEN 9 AND 14 THEN 350
    WHEN t.table_number BETWEEN 15 AND 20 THEN 500
    WHEN t.table_number BETWEEN 21 AND 26 THEN 600
  END
FROM vip_table_templates t
WHERE t.table_number BETWEEN 1 AND 26
ORDER BY t.table_number
ON CONFLICT (event_id, table_number) DO UPDATE SET
  position_x = EXCLUDED.position_x,
  position_y = EXCLUDED.position_y,
  tier = EXCLUDED.tier,
  price_cents = EXCLUDED.price_cents,
  capacity = EXCLUDED.capacity,
  is_available = true,
  updated_at = NOW();

-- ============================================================================
-- VIP Reservation on Table 1 (Premium, confirmed status)
-- ============================================================================

-- Get the actual table ID for table 1 in this event
DO $$
DECLARE
  v_table_id UUID;
BEGIN
  SELECT id INTO v_table_id
  FROM event_vip_tables
  WHERE event_id = '99999999-9999-9999-9999-999999999999' AND table_number = 1;

  -- Delete existing test reservation and passes
  DELETE FROM vip_guest_passes WHERE reservation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  DELETE FROM vip_reservations WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  -- Create test reservation on Table 1
  INSERT INTO vip_reservations (
    id, event_id, event_vip_table_id, table_number, status,
    purchaser_name, purchaser_email, purchaser_phone,
    checked_in_guests, stripe_payment_intent_id, amount_paid_cents,
    qr_code_token, package_snapshot,
    disclaimer_accepted_at, refund_policy_accepted_at
  )
  VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '99999999-9999-9999-9999-999999999999',
    v_table_id,
    1,
    'confirmed',
    'Test VIP Host',
    '[email protected]',
    '+15555555555',
    0,
    'pi_test_vip_e2e_12345',
    75000,
    'VIP-RESERVATION-TEST-001',
    '{"guestCount": 8, "tier": "premium", "tableName": "Table 1", "tableNumber": 1}'::jsonb,
    NOW(),
    NOW()
  );

  -- Mark table 1 as reserved
  UPDATE event_vip_tables
  SET is_available = false, updated_at = NOW()
  WHERE id = v_table_id;
END $$;

-- ============================================================================
-- VIP Guest Passes (8 guests with predictable QR tokens)
-- ============================================================================

-- Insert 8 guest passes
INSERT INTO vip_guest_passes (
  reservation_id,
  event_id,
  pass_number,
  pass_type,
  qr_token,
  qr_signature,
  status
)
SELECT
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '99999999-9999-9999-9999-999999999999',
  gs.n,
  'guest',
  'VIP-TEST-GUEST-' || LPAD(gs.n::text, 2, '0'),
  'test-signature-' || LPAD(gs.n::text, 2, '0'),
  'active'
FROM generate_series(1, 8) AS gs(n)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Output QR Tokens for Manual Testing
-- ============================================================================

\echo ''
\echo 'VIP E2E Test Data - QR Tokens for Manual UAT'
\echo ''

-- VIP Reservation QR
SELECT
  'VIP Reservation Host QR' AS type,
  qr_code_token AS token,
  'VIP host check-in' AS purpose
FROM vip_reservations
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo ''

-- VIP Guest Passes
SELECT
  'VIP Guest Pass' AS type,
  qr_token AS token,
  'Guest #' || pass_number || ' of 8' AS purpose
FROM vip_guest_passes
WHERE reservation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORDER BY pass_number;

\echo ''
\echo 'Setup complete! 26 tables created, reservation on Table 1'
\echo ''

/*
===============================================================================
QR TOKEN REFERENCE FOR COPY-PASTE
===============================================================================

VIP Reservation Host:
  VIP-RESERVATION-TEST-001

VIP Guest Passes (8):
  VIP-TEST-GUEST-01 through VIP-TEST-GUEST-08

===============================================================================
LAYOUT: 26 tables
===============================================================================

Premium (Tables 1,2,3,8): $750, 8 guests, left wing + right side
Front Row (Tables 4,5,6,7): $700, 6 guests, top center near stage
Standard (Tables 9-26): $600, 6 guests, rows 2-4

===============================================================================
*/
