-- ============================================================================
-- PHASE 4 TEST DATA SETUP
-- Run this in Supabase SQL Editor to create test data for scanner tests
-- ============================================================================

-- 1. Create Test Event
INSERT INTO events (id, name, event_date, event_time, status, vip_enabled)
VALUES (
  'phase4-test-event-001',
  'Phase 4 Scanner Test Event',
  CURRENT_DATE,
  '20:00:00',
  'published',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Ticket Type
INSERT INTO ticket_types (id, event_id, code, name, price, total_inventory)
VALUES (
  'phase4-ticket-type-001',
  'phase4-test-event-001',
  'GA',
  'General Admission',
  25.00,
  100
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create VIP Table Template (if not exists)
INSERT INTO vip_table_templates (id, name, base_price, capacity)
VALUES ('phase4-template-001', 'Phase 4 Test Template', 1000, 10)
ON CONFLICT (id) DO NOTHING;

-- 4. Create VIP Table for the event
INSERT INTO event_vip_tables (id, event_id, table_number, table_template_id, tier, capacity, price_cents, bottles_included, is_available, table_name)
VALUES (
  'phase4-vip-table-001',
  'phase4-test-event-001',
  101,
  'phase4-template-001',
  'premium',
  10,
  100000,
  2,
  false,
  'Table 101'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SCENARIO 1: VIP Host Re-entry (Tests 4 & 5)
-- A VIP reservation that's already checked in
-- ============================================================================

INSERT INTO vip_reservations (
  id, event_id, event_vip_table_id, table_number,
  purchaser_email, purchaser_name, status, amount_paid_cents,
  qr_code_token, package_snapshot,
  disclaimer_accepted_at, refund_policy_accepted_at,
  checked_in_at, checked_in_guests
)
VALUES (
  'phase4-vip-res-001',
  'phase4-test-event-001',
  'phase4-vip-table-001',
  101,
  'vip.host@test.com',
  'VIP Host User',
  'checked_in',
  100000,
  'vip-host-token-phase4',
  '{"guestCount": 10}'::jsonb,
  NOW(),
  NOW(),
  NOW() - INTERVAL '1 hour',
  1
)
ON CONFLICT (id) DO UPDATE SET status = 'checked_in', checked_in_at = NOW() - INTERVAL '1 hour';

-- Create guest pass (already checked in)
INSERT INTO vip_guest_passes (
  id, vip_reservation_id, reservation_id, guest_number,
  guest_name, status, checked_in_at
)
VALUES (
  'phase4-vip-pass-001',
  'phase4-vip-res-001',
  'phase4-vip-res-001',
  1,
  'VIP Host',
  'checked_in',
  NOW() - INTERVAL '1 hour'
)
ON CONFLICT (id) DO UPDATE SET status = 'checked_in', checked_in_at = NOW() - INTERVAL '1 hour';

-- ============================================================================
-- SCENARIO 2: VIP-Linked GA Ticket (Test 6)
-- A GA ticket linked to VIP reservation for re-entry testing
-- ============================================================================

-- Create order for linked ticket
INSERT INTO orders (id, event_id, purchaser_name, purchaser_email, subtotal, total, status)
VALUES ('phase4-order-linked', 'phase4-test-event-001', 'Linked Guest', 'vip.linked@test.com', 25, 25, 'paid')
ON CONFLICT (id) DO NOTHING;

-- Create the linked GA ticket
INSERT INTO tickets (
  id, event_id, order_id, ticket_type_id, ticket_type,
  purchaser_email, purchaser_name, status, price_paid,
  qr_code, ticket_token
)
VALUES (
  'phase4-ticket-linked',
  'phase4-test-event-001',
  'phase4-order-linked',
  'phase4-ticket-type-001',
  'GA',
  'vip.linked@test.com',
  'Linked Guest',
  'valid',
  25.00,
  'linked-ga-qr-phase4',
  'linked-ga-token-phase4'
)
ON CONFLICT (id) DO UPDATE SET status = 'valid', is_used = false;

-- Link the ticket to VIP reservation
INSERT INTO vip_linked_tickets (id, ticket_id, vip_reservation_id, purchased_by_email)
VALUES (
  'phase4-link-001',
  'phase4-ticket-linked',
  'phase4-vip-res-001',
  'vip.linked@test.com'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SCENARIO 3: Regular GA Ticket (Test 7)
-- A regular GA ticket NOT linked to VIP - should reject on second scan
-- ============================================================================

-- Create order for regular ticket
INSERT INTO orders (id, event_id, purchaser_name, purchaser_email, subtotal, total, status)
VALUES ('phase4-order-regular', 'phase4-test-event-001', 'Regular Guest', 'regular@test.com', 25, 25, 'paid')
ON CONFLICT (id) DO NOTHING;

-- Create the regular GA ticket
INSERT INTO tickets (
  id, event_id, order_id, ticket_type_id, ticket_type,
  purchaser_email, purchaser_name, status, price_paid,
  qr_code, ticket_token
)
VALUES (
  'phase4-ticket-regular',
  'phase4-test-event-001',
  'phase4-order-regular',
  'phase4-ticket-type-001',
  'GA',
  'regular@test.com',
  'Regular Guest',
  'valid',
  25.00,
  'regular-ga-qr-phase4',
  'regular-ga-token-phase4'
)
ON CONFLICT (id) DO UPDATE SET status = 'valid', is_used = false;

-- ============================================================================
-- OUTPUT TEST DATA
-- ============================================================================

SELECT '=== PHASE 4 TEST DATA ===' AS info;

SELECT 'TEST 4/5: VIP Host Re-entry' AS test,
       'VIP Pass ID: phase4-vip-pass-001' AS data,
       'Reservation Token: vip-host-token-phase4' AS qr_content;

SELECT 'TEST 6: VIP-Linked GA Ticket' AS test,
       'Ticket ID: phase4-ticket-linked' AS data,
       'QR Token: linked-ga-token-phase4' AS qr_content;

SELECT 'TEST 7: Regular GA Ticket' AS test,
       'Ticket ID: phase4-ticket-regular' AS data,
       'QR Token: regular-ga-token-phase4' AS qr_content;

-- ============================================================================
-- TEST 8: Verify State Transition Protection
-- This should FAIL with "Invalid status transition" error
-- ============================================================================

-- Uncomment to test (will error if trigger is working):
-- UPDATE vip_reservations SET status = 'confirmed' WHERE id = 'phase4-vip-res-001';

SELECT 'TEST 8: Run this to verify state protection (should fail):' AS test,
       'UPDATE vip_reservations SET status = ''confirmed'' WHERE id = ''phase4-vip-res-001'';' AS sql_to_test;
