-- VIP End-to-End Test Data Seed Script
-- Creates complete VIP test scenario with predictable data for E2E testing
-- Idempotent: Can be run multiple times without errors

-- ============================================================================
-- Test Event (30 days in future to ensure active)
-- ============================================================================
INSERT INTO events (
  id,
  name,
  date,
  time,
  genre,
  venue_name,
  city,
  state,
  description,
  image_url,
  status
)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  'VIP E2E Test Event',
  (CURRENT_DATE + INTERVAL '30 days')::date,
  '22:00:00',
  'Reggaeton',
  'Test Venue',
  'Test City',
  'CA',
  'Test event for VIP end-to-end testing',
  'https://via.placeholder.com/800x600',
  'published'
)
ON CONFLICT (id) DO UPDATE SET
  date = EXCLUDED.date,
  status = 'published',
  updated_at = NOW();

-- ============================================================================
-- VIP Tables (3 tiers for testing)
-- ============================================================================
INSERT INTO event_vip_tables (
  id,
  event_id,
  table_name,
  tier,
  price,
  guest_capacity,
  is_active,
  description
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '99999999-9999-9999-9999-999999999999',
    'Test Premium Table',
    'premium',
    750.00,
    8,
    true,
    'Premium test table with 8 guest capacity'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '99999999-9999-9999-9999-999999999999',
    'Test Front Row Table',
    'front_row',
    700.00,
    6,
    true,
    'Front row test table with 6 guest capacity'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '99999999-9999-9999-9999-999999999999',
    'Test Standard Table',
    'standard',
    600.00,
    6,
    true,
    'Standard test table with 6 guest capacity'
  )
ON CONFLICT (id) DO UPDATE SET
  is_active = true,
  updated_at = NOW();

-- ============================================================================
-- VIP Reservation (confirmed status)
-- ============================================================================
INSERT INTO vip_reservations (
  id,
  event_id,
  table_id,
  status,
  host_name,
  host_email,
  host_phone,
  total_guests,
  checked_in_guests,
  stripe_payment_intent_id,
  total_amount,
  qr_code_token,
  qr_signature
)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '99999999-9999-9999-9999-999999999999',
  '11111111-1111-1111-1111-111111111111',
  'confirmed',
  'Test VIP Host',
  '[email protected]',
  '+15555555555',
  8,
  0,
  'pi_test_vip_e2e_12345',
  750.00,
  'VIP-RESERVATION-TEST-001',
  encode(hmac('VIP-RESERVATION-TEST-001', 'test-secret', 'sha256'), 'hex')
)
ON CONFLICT (id) DO UPDATE SET
  status = 'confirmed',
  checked_in_guests = 0,
  updated_at = NOW();

-- ============================================================================
-- VIP Guest Passes (8 guests with predictable QR tokens)
-- Using generate_series for scalability
-- ============================================================================
INSERT INTO vip_guest_passes (
  id,
  reservation_id,
  guest_number,
  qr_token,
  qr_signature,
  status
)
SELECT
  gen_random_uuid(),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  gs.n,
  'VIP-TEST-GUEST-' || LPAD(gs.n::text, 2, '0'),
  encode(hmac('VIP-TEST-GUEST-' || LPAD(gs.n::text, 2, '0'), 'test-secret', 'sha256'), 'hex'),
  'active'
FROM generate_series(1, 8) AS gs(n)
ON CONFLICT (qr_token) DO UPDATE SET
  status = 'active',
  scanned_at = NULL,
  scanned_by = NULL;

-- ============================================================================
-- GA Ticket Tier (for linked tickets)
-- ============================================================================
INSERT INTO ticket_tiers (
  id,
  event_id,
  name,
  price,
  quantity,
  available_quantity,
  description
)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '99999999-9999-9999-9999-999999999999',
  'General Admission - Test',
  25.00,
  100,
  96, -- 3 linked + 1 regular = 4 sold
  'Test GA tier for VIP linking'
)
ON CONFLICT (id) DO UPDATE SET
  available_quantity = 96;

-- ============================================================================
-- Linked GA Tickets (3 tickets with VIP re-entry privilege)
-- These tickets are linked to VIP reservation via vip_linked_tickets
-- ============================================================================
INSERT INTO tickets (
  id,
  event_id,
  tier_id,
  qr_code_token,
  qr_signature,
  buyer_name,
  buyer_email,
  status,
  stripe_payment_intent_id,
  price_paid
)
VALUES
  (
    'cccccccc-1111-cccc-cccc-cccccccccccc',
    '99999999-9999-9999-9999-999999999999',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'GA-VIP-LINKED-01',
    encode(hmac('GA-VIP-LINKED-01', 'test-secret', 'sha256'), 'hex'),
    'Test VIP Guest 1',
    '[email protected]',
    'valid',
    'pi_test_ga_linked_01',
    25.00
  ),
  (
    'cccccccc-2222-cccc-cccc-cccccccccccc',
    '99999999-9999-9999-9999-999999999999',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'GA-VIP-LINKED-02',
    encode(hmac('GA-VIP-LINKED-02', 'test-secret', 'sha256'), 'hex'),
    'Test VIP Guest 2',
    '[email protected]',
    'valid',
    'pi_test_ga_linked_02',
    25.00
  ),
  (
    'cccccccc-3333-cccc-cccc-cccccccccccc',
    '99999999-9999-9999-9999-999999999999',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'GA-VIP-LINKED-03',
    encode(hmac('GA-VIP-LINKED-03', 'test-secret', 'sha256'), 'hex'),
    'Test VIP Guest 3',
    '[email protected]',
    'valid',
    'pi_test_ga_linked_03',
    25.00
  )
ON CONFLICT (qr_code_token) DO UPDATE SET
  status = 'valid',
  scanned_at = NULL,
  scanned_by = NULL;

-- ============================================================================
-- Link GA Tickets to VIP Reservation
-- ============================================================================
INSERT INTO vip_linked_tickets (
  id,
  reservation_id,
  ticket_id
)
VALUES
  (
    gen_random_uuid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-1111-cccc-cccc-cccccccccccc'
  ),
  (
    gen_random_uuid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-2222-cccc-cccc-cccccccccccc'
  ),
  (
    gen_random_uuid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-3333-cccc-cccc-cccccccccccc'
  )
ON CONFLICT (ticket_id) DO NOTHING;

-- ============================================================================
-- Regular GA Ticket (for comparison testing - no VIP link)
-- ============================================================================
INSERT INTO tickets (
  id,
  event_id,
  tier_id,
  qr_code_token,
  qr_signature,
  buyer_name,
  buyer_email,
  status,
  stripe_payment_intent_id,
  price_paid
)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '99999999-9999-9999-9999-999999999999',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'GA-REGULAR-TEST-01',
  encode(hmac('GA-REGULAR-TEST-01', 'test-secret', 'sha256'), 'hex'),
  'Test Regular Customer',
  '[email protected]',
  'valid',
  'pi_test_ga_regular_01',
  25.00
)
ON CONFLICT (qr_code_token) DO UPDATE SET
  status = 'valid',
  scanned_at = NULL,
  scanned_by = NULL;

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
  'Guest #' || guest_number || ' of 8' AS purpose
FROM vip_guest_passes
WHERE reservation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORDER BY guest_number;

\echo ''

-- Linked GA Tickets
SELECT
  'GA Ticket (VIP Linked)' AS type,
  qr_code_token AS token,
  'Re-entry allowed via VIP link' AS purpose
FROM tickets
WHERE qr_code_token LIKE 'GA-VIP-LINKED-%'
ORDER BY qr_code_token;

\echo ''

-- Regular GA Ticket
SELECT
  'GA Ticket (Regular)' AS type,
  qr_code_token AS token,
  'One-time entry only' AS purpose
FROM tickets
WHERE qr_code_token = 'GA-REGULAR-TEST-01';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test Event Details'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  name,
  date,
  time,
  status,
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

GA Tickets with VIP Re-entry (3):
  GA-VIP-LINKED-01
  GA-VIP-LINKED-02
  GA-VIP-LINKED-03

Regular GA Ticket (1):
  GA-REGULAR-TEST-01

===============================================================================
*/
