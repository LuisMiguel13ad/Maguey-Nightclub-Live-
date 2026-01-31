-- VIP End-to-End Test Data Seed Script
-- Creates complete VIP test scenario with predictable data for E2E testing
--
-- IMPORTANT: Run via TypeScript script for best results:
--   npx tsx scripts/apply-vip-seed.ts
--
-- Or copy this SQL to Supabase SQL Editor (remove \echo commands first)
--
-- Schema verified against actual database 2026-01-31:
-- - events: event_date, event_time (NOT date, time)
-- - event_vip_tables: price_cents, display_order, table_template_id (required)
-- - vip_guest_passes: qr_token, pass_number, scanned_at (NOT qr_code_token)

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
-- VIP Tables (3 tiers for testing)
-- Using actual schema: price_cents, display_order, table_template_id
-- ============================================================================
INSERT INTO event_vip_tables (
  id,
  event_id,
  table_template_id,
  table_number,
  tier,
  price_cents,
  capacity,
  bottles_included,
  champagne_included,
  package_description,
  is_available,
  display_order
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '99999999-9999-9999-9999-999999999999',
    'a813606e-0047-4bcf-8154-fa3b52c7518d',  -- Existing template (premium)
    101,
    'premium',
    75000,  -- $750.00 in cents
    8,
    2,
    0,
    'Premium test table with 8 guest capacity',
    true,
    1
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '99999999-9999-9999-9999-999999999999',
    'bb202b77-2595-461d-8daf-ec4f5018fc4c',  -- Existing template (front_row)
    102,
    'front_row',
    70000,  -- $700.00 in cents
    6,
    1,
    0,
    'Front row test table with 6 guest capacity',
    true,
    2
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '99999999-9999-9999-9999-999999999999',
    '3961a80a-1b1d-4333-a968-3c65534a2953',  -- Existing template
    103,
    'standard',
    60000,  -- $600.00 in cents
    6,
    1,
    0,
    'Standard test table with 6 guest capacity',
    true,
    3
  )
ON CONFLICT (id) DO UPDATE SET
  is_available = true,
  updated_at = NOW();

-- ============================================================================
-- VIP Reservation (confirmed status)
-- ============================================================================
INSERT INTO vip_reservations (
  id,
  event_id,
  event_vip_table_id,
  table_number,
  status,
  purchaser_name,
  purchaser_email,
  purchaser_phone,
  checked_in_guests,
  stripe_payment_intent_id,
  amount_paid_cents,
  qr_code_token,
  package_snapshot,
  disclaimer_accepted_at,
  refund_policy_accepted_at
)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '99999999-9999-9999-9999-999999999999',
  '11111111-1111-1111-1111-111111111111',
  101,
  'confirmed',
  'Test VIP Host',
  '[email protected]',
  '+15555555555',
  0,
  'pi_test_vip_e2e_12345',
  75000,
  'VIP-RESERVATION-TEST-001',
  '{"guestCount": 8, "tier": "premium", "tableName": "Test Premium Table"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  status = 'confirmed',
  checked_in_guests = 0,
  updated_at = NOW();

-- Mark table as unavailable after reservation
UPDATE event_vip_tables
SET is_available = false, updated_at = NOW()
WHERE id = '11111111-1111-1111-1111-111111111111';

-- ============================================================================
-- VIP Guest Passes (8 guests with predictable QR tokens)
-- Using actual schema: qr_token (NOT qr_code_token), pass_number (NOT guest_number)
-- ============================================================================

-- Delete existing test passes to ensure clean state
DELETE FROM vip_guest_passes
WHERE reservation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

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
FROM generate_series(1, 8) AS gs(n);

-- ============================================================================
-- Output QR Tokens for Manual Testing
-- ============================================================================

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'VIP E2E Test Data - QR Tokens for Manual UAT'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
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
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test Event Details'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  name,
  event_date,
  event_time,
  'Event ID: 99999999-9999-9999-9999-999999999999' AS note
FROM events
WHERE id = '99999999-9999-9999-9999-999999999999';

\echo ''
\echo 'Setup complete! Use tokens above for UAT plans 09-04 and 09-05'
\echo ''

/*
===============================================================================
QR TOKEN REFERENCE FOR COPY-PASTE
===============================================================================

VIP Reservation Host:
  VIP-RESERVATION-TEST-001

VIP Guest Passes (8):
  VIP-TEST-GUEST-01
  VIP-TEST-GUEST-02
  VIP-TEST-GUEST-03
  VIP-TEST-GUEST-04
  VIP-TEST-GUEST-05
  VIP-TEST-GUEST-06
  VIP-TEST-GUEST-07
  VIP-TEST-GUEST-08

===============================================================================
USAGE
===============================================================================

Recommended: Run via TypeScript script:
  npx tsx scripts/apply-vip-seed.ts

Alternative: Copy SQL (excluding \echo) to Supabase SQL Editor

Scanner Testing:
  http://localhost:3017/scanner?qr=VIP-TEST-GUEST-01

===============================================================================
*/
