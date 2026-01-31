/**
 * End-to-End Test Script
 * Tests the complete flow: Event Creation → Purchase → Ticket Display → Scanning → Dashboard
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
config({ path: resolve(__dirname, 'maguey-gate-scanner/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEndToEndFlow() {
  console.log('🧪 Starting End-to-End Test Flow\n');
  console.log('=' .repeat(60));
  
  // Step 1: Create a test event
  console.log('\n📅 STEP 1: Creating Test Event...');
  const eventName = `E2E Test Event - ${new Date().toISOString().split('T')[0]}`;
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 7); // One week from now

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      name: eventName,
      description: 'End-to-end test event for system verification',
      event_date: eventDate.toISOString().split('T')[0],
      event_time: '21:00',
      venue_name: 'Maguey Nightclub',
      venue_address: '123 Nightlife Ave',
      city: 'Wilmington, DE',
      image_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
      genre: 'Reggaeton',
      status: 'published',
      is_active: true,
    })
    .select()
    .single();

  if (eventError) {
    console.error('❌ Error creating event:', eventError.message);
    return;
  }

  console.log(`✅ Event created: ${event.name} (ID: ${event.id})`);

  // Step 2: Create ticket types
  console.log('\n🎫 STEP 2: Creating Ticket Types...');
  const ticketTypes = [
    {
      event_id: event.id,
      name: 'General Admission',
      code: 'GA',
      price: 25.00,
      fee: 5.00,
      total_inventory: 100,
      limit_per_order: 10,
      category: 'general',
      display_order: 1,
    },
    {
      event_id: event.id,
      name: 'VIP',
      code: 'VIP',
      price: 75.00,
      fee: 10.00,
      total_inventory: 20,
      limit_per_order: 5,
      category: 'vip',
      display_order: 2,
    },
  ];

  const { data: createdTicketTypes, error: ticketTypeError } = await supabase
    .from('ticket_types')
    .insert(ticketTypes)
    .select();

  if (ticketTypeError) {
    console.error('❌ Error creating ticket types:', ticketTypeError.message);
    return;
  }

  console.log(`✅ Created ${createdTicketTypes.length} ticket types`);

  // Step 3: Verify event appears on main site
  console.log('\n🌐 STEP 3: Verifying Event on Main Site...');
  const { data: publishedEvents } = await supabase
    .from('events')
    .select('*')
    .eq('name', eventName)
    .eq('status', 'published')
    .eq('is_active', true)
    .single();

  if (publishedEvents) {
    console.log('✅ Event is published and visible on main site');
  }

  // Step 4: Create a test order
  console.log('\n🛒 STEP 4: Creating Test Order...');
  const testOrder = {
    event_id: event.id,
    purchaser_email: 'test@example.com',
    purchaser_name: 'Test Customer',
    subtotal: 25.00,
    fees_total: 5.00,
    total: 30.00,
    status: 'paid',
    payment_provider: 'stripe',
    payment_reference: 'test_payment_' + Date.now(),
  };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(testOrder)
    .select()
    .single();

  if (orderError) {
    console.error('❌ Error creating order:', orderError.message);
    return;
  }

  console.log(`✅ Order created: ${order.id}`);

  // Step 5: Create a test ticket
  console.log('\n🎟️ STEP 5: Creating Test Ticket...');
  const qrToken = `ticket_${order.id}_${Date.now()}`;
  const crypto = await import('crypto');
  const hmac = crypto.createHmac('sha256', process.env.VITE_QR_SIGNING_SECRET || 'test-secret');
  hmac.update(qrToken);
  const qrSignature = hmac.digest('hex');

  const testTicket = {
    order_id: order.id,
    ticket_type_id: createdTicketTypes[0].id,
    event_id: event.id,
    attendee_name: 'Test Customer',
    attendee_email: 'test@example.com',
    qr_token: qrToken,
    qr_signature: qrSignature,
    status: 'issued',
    price: 25.00,
    fee_total: 5.00,
  };

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert(testTicket)
    .select()
    .single();

  if (ticketError) {
    console.error('❌ Error creating ticket:', ticketError.message);
    return;
  }

  console.log(`✅ Ticket created: ${ticket.id}`);
  console.log(`   QR Token: ${qrToken.substring(0, 20)}...`);
  console.log(`   Status: ${ticket.status}`);

  // Step 6: Verify ticket appears in customer view
  console.log('\n👤 STEP 6: Verifying Customer Can View Ticket...');
  const { data: customerTickets } = await supabase
    .from('tickets')
    .select('*, orders(*), events(*)')
    .eq('attendee_email', 'test@example.com')
    .eq('order_id', order.id);

  if (customerTickets && customerTickets.length > 0) {
    console.log('✅ Customer can view their ticket');
    console.log(`   Ticket ID: ${customerTickets[0].id}`);
    console.log(`   Event: ${customerTickets[0].events?.name}`);
    console.log(`   Status: ${customerTickets[0].status}`);
  }

  // Step 7: Simulate ticket scan
  console.log('\n📱 STEP 7: Simulating Ticket Scan...');
  const { data: scannedTicket, error: scanError } = await supabase
    .from('tickets')
    .update({
      status: 'scanned',
      scanned_at: new Date().toISOString(),
    })
    .eq('id', ticket.id)
    .select()
    .single();

  if (scanError) {
    console.error('❌ Error scanning ticket:', scanError.message);
    return;
  }

  console.log('✅ Ticket scanned successfully');
  console.log(`   Scanned at: ${scannedTicket.scanned_at}`);

  // Step 8: Create scan log
  console.log('\n📝 STEP 8: Creating Scan Log...');
  const { error: logError } = await supabase
    .from('ticket_scan_logs')
    .insert({
      ticket_id: ticket.id,
      scan_result: 'success',
      scanned_at: new Date().toISOString(),
    });

  if (logError) {
    console.warn('⚠️ Could not create scan log (table may not exist):', logError.message);
  } else {
    console.log('✅ Scan log created');
  }

  // Step 9: Verify dashboard data
  console.log('\n📊 STEP 9: Verifying Dashboard Data...');
  
  // Get order stats
  const { count: totalOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id);

  const { count: totalTickets } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id);

  const { count: scannedTickets } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .eq('status', 'scanned');

  console.log('✅ Dashboard Statistics:');
  console.log(`   Total Orders: ${totalOrders || 0}`);
  console.log(`   Total Tickets: ${totalTickets || 0}`);
  console.log(`   Scanned Tickets: ${scannedTickets || 0}`);
  console.log(`   Scan Rate: ${totalTickets ? ((scannedTickets || 0) / totalTickets * 100).toFixed(1) : 0}%`);

  // Step 10: Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ END-TO-END TEST COMPLETE!\n');
  console.log('📋 Test Summary:');
  console.log(`   Event: ${eventName}`);
  console.log(`   Event ID: ${event.id}`);
  console.log(`   Order ID: ${order.id}`);
  console.log(`   Ticket ID: ${ticket.id}`);
  console.log(`   QR Token: ${qrToken}`);
  console.log(`   Ticket Status: ${scannedTicket.status}`);
  console.log('\n🔗 Test URLs:');
  console.log(`   Main Site: http://localhost:3000`);
  console.log(`   Purchase Site: http://localhost:5173/event/${event.id}`);
  console.log(`   Scanner Site: http://localhost:5175/scanner`);
  console.log(`   Dashboard: http://localhost:5175/dashboard`);
  console.log('\n💡 Next Steps:');
  console.log('   1. Open Main Site and verify event appears');
  console.log('   2. Click "Buy Tickets" → redirects to Purchase Site');
  console.log('   3. View ticket on Purchase Site');
  console.log('   4. Scan ticket on Scanner Site');
  console.log('   5. View analytics on Dashboard');
}

testEndToEndFlow().catch(console.error);
