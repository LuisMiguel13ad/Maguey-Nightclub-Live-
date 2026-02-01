/**
 * Apply VIP E2E Test Data Seed
 *
 * Run: npx tsx scripts/apply-vip-seed.ts
 *
 * Schema verified against actual database 2026-01-31:
 * - events: event_date, event_time (NOT date, time)
 * - event_vip_tables: price_cents, display_order (NOT price, sort_order)
 * - vip_guest_passes: qr_token, pass_number, scanned_at (NOT qr_code_token, guest_number)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../maguey-pass-lounge/.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Prefer': 'resolution=merge-duplicates,return=minimal'
};

async function upsert(table: string, data: any | any[]): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(Array.isArray(data) ? data : [data])
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`   ❌ Failed to upsert to ${table}:`, errorText);
    return false;
  }
  return true;
}

async function deleteRows(table: string, column: string, value: string): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers
  });

  if (!response.ok) {
    // Don't fail on delete errors - might just not exist
  }
  return true;
}

async function updateRow(table: string, id: string, data: any): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify(data)
  });

  return response.ok;
}

async function applySeed() {
  console.log('🌱 Applying VIP E2E Test Data Seed\n');
  console.log('━'.repeat(60));

  // Step 1: Create test event
  // Using actual columns: event_date, event_time (NOT date, time)
  console.log('\n📅 Creating test event...');
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const eventSuccess = await upsert('events', {
    id: '99999999-9999-9999-9999-999999999999',
    name: 'VIP E2E Test Event',
    event_date: futureDate,       // NOT 'date'
    event_time: '22:00:00',       // NOT 'time'
    genre: 'Reggaeton',
    venue_name: 'Test Venue',
    venue_address: '123 Test Street',
    city: 'Test City',
    description: 'Test event for VIP end-to-end testing',
    image_url: 'https://via.placeholder.com/800x600',
    is_active: true,
    status: 'published',
    vip_enabled: true
  });

  if (!eventSuccess) return false;
  console.log('   ✓ Test event created');

  // Step 2: Create VIP tables
  // Using actual columns: price_cents, display_order, table_template_id (required FK)
  // Template IDs from vip_table_templates (existing production data)
  console.log('\n🪑 Creating VIP tables...');
  const tablesSuccess = await upsert('event_vip_tables', [
    {
      id: '11111111-1111-1111-1111-111111111111',
      event_id: '99999999-9999-9999-9999-999999999999',
      table_template_id: 'a813606e-0047-4bcf-8154-fa3b52c7518d', // Template 1 (premium)
      table_number: 101,
      tier: 'premium',
      price_cents: 75000,         // $750.00 in cents
      capacity: 8,
      bottles_included: 2,
      champagne_included: 0,
      package_description: 'Premium test table with 8 guest capacity',
      is_available: true,
      display_order: 1
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      event_id: '99999999-9999-9999-9999-999999999999',
      table_template_id: 'bb202b77-2595-461d-8daf-ec4f5018fc4c', // Template 4 (front_row)
      table_number: 102,
      tier: 'front_row',
      price_cents: 70000,         // $700.00 in cents
      capacity: 6,
      bottles_included: 1,
      champagne_included: 0,
      package_description: 'Front row test table with 6 guest capacity',
      is_available: true,
      display_order: 2
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      event_id: '99999999-9999-9999-9999-999999999999',
      table_template_id: '3961a80a-1b1d-4333-a968-3c65534a2953', // Template 8
      table_number: 103,
      tier: 'standard',
      price_cents: 60000,         // $600.00 in cents
      capacity: 6,
      bottles_included: 1,
      champagne_included: 0,
      package_description: 'Standard test table with 6 guest capacity',
      is_available: true,
      display_order: 3
    }
  ]);

  if (!tablesSuccess) return false;
  console.log('   ✓ 3 VIP tables created');

  // Step 3: Create VIP reservation
  console.log('\n🎫 Creating VIP reservation...');
  const reservationSuccess = await upsert('vip_reservations', {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    event_id: '99999999-9999-9999-9999-999999999999',
    event_vip_table_id: '11111111-1111-1111-1111-111111111111',
    table_number: 101,
    status: 'confirmed',
    purchaser_name: 'Test VIP Host',
    purchaser_email: '[email protected]',
    purchaser_phone: '+15555555555',
    checked_in_guests: 0,
    stripe_payment_intent_id: 'pi_test_vip_e2e_12345',
    amount_paid_cents: 75000,
    qr_code_token: 'VIP-RESERVATION-TEST-001',
    package_snapshot: { guestCount: 8, tier: 'premium', tableName: 'Test Premium Table' },
    disclaimer_accepted_at: new Date().toISOString(),
    refund_policy_accepted_at: new Date().toISOString()
  });

  if (!reservationSuccess) return false;
  console.log('   ✓ VIP reservation created (confirmed status)');

  // Mark table as unavailable
  await updateRow('event_vip_tables', '11111111-1111-1111-1111-111111111111', {
    is_available: false
  });

  // Step 4: Create VIP guest passes
  // Using actual columns: qr_token, pass_number, scanned_at (NOT qr_code_token, guest_number)
  console.log('\n👥 Creating VIP guest passes...');

  // Delete existing test passes
  await deleteRows('vip_guest_passes', 'reservation_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

  // Create 8 guest passes
  const guestPasses = [];
  for (let i = 1; i <= 8; i++) {
    const paddedNum = i.toString().padStart(2, '0');
    guestPasses.push({
      reservation_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      event_id: '99999999-9999-9999-9999-999999999999',
      pass_number: i,             // NOT 'guest_number'
      pass_type: 'guest',
      qr_token: `VIP-TEST-GUEST-${paddedNum}`,  // NOT 'qr_code_token'
      qr_signature: `test-signature-${paddedNum}`,
      status: 'issued'            // Schema uses 'issued', 'checked_in', or 'cancelled'
    });
  }

  const passesSuccess = await upsert('vip_guest_passes', guestPasses);

  if (!passesSuccess) return false;
  console.log('   ✓ 8 VIP guest passes created');

  // Success summary
  console.log('\n' + '━'.repeat(60));
  console.log('✨ VIP E2E Test Data Applied Successfully!\n');

  console.log('📋 QR Tokens for Testing:');
  console.log('   VIP Reservation Host: VIP-RESERVATION-TEST-001');
  console.log('   VIP Guest Pass 1:     VIP-TEST-GUEST-01');
  console.log('   VIP Guest Pass 2:     VIP-TEST-GUEST-02');
  console.log('   VIP Guest Pass 3:     VIP-TEST-GUEST-03');
  console.log('   VIP Guest Pass 4:     VIP-TEST-GUEST-04');
  console.log('   VIP Guest Pass 5:     VIP-TEST-GUEST-05');
  console.log('   VIP Guest Pass 6:     VIP-TEST-GUEST-06');
  console.log('   VIP Guest Pass 7:     VIP-TEST-GUEST-07');
  console.log('   VIP Guest Pass 8:     VIP-TEST-GUEST-08');

  console.log('\n📆 Test Event:');
  console.log('   ID: 99999999-9999-9999-9999-999999999999');
  console.log('   Name: VIP E2E Test Event');
  console.log(`   Date: ${futureDate}`);

  console.log('\n' + '━'.repeat(60));
  console.log('Use these tokens in Scanner app with ?qr=TOKEN parameter');
  console.log('━'.repeat(60) + '\n');

  return true;
}

applySeed()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
