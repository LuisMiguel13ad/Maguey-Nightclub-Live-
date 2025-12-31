// Setup script for Demo Account Tickets
// Run with: npx tsx setup-demo-tickets.ts

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role for user management

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials (SUPABASE_SERVICE_ROLE_KEY required)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TEST_USER_EMAIL = 'testcustomer@maguey.com';
const TEST_USER_PASSWORD = 'test1234';
const EVENT_NAME = 'PRE THANKSGIVING BASH';
const TICKET_COUNT = 5;

async function setupDemoTickets() {
  console.log('\n🎫 SETTING UP DEMO TICKETS\n');
  console.log(`User: ${TEST_USER_EMAIL}`);
  console.log(`Event: ${EVENT_NAME}`);
  console.log('='.repeat(50));

  // 1. Ensure User Exists
  console.log('\n👤 1. Checking User Account...');
  let userId: string | null = null;
  
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  const existingUser = users?.find(u => u.email === TEST_USER_EMAIL);

  if (existingUser) {
    console.log('✅ User exists');
    userId = existingUser.id;
    
    // Ensure email is confirmed
    if (!existingUser.email_confirmed_at) {
      console.log('⚠️  Confirming email...');
      await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
      console.log('✅ Email confirmed');
    }
  } else {
    console.log('⚠️  Creating user...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: 'Test',
        last_name: 'Customer'
      }
    });
    
    if (createError) {
      console.error('❌ Failed to create user:', createError.message);
      return;
    }
    console.log('✅ User created');
    userId = newUser.user!.id;
  }

  // 2. Get Event
  console.log('\n📅 2. Getting Event Details...');
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name, event_date')
    .eq('name', EVENT_NAME)
    .single();

  if (eventError || !event) {
    console.error('❌ Event not found. Please create "PRE THANKSGIVING BASH" first.');
    return;
  }
  console.log(`✅ Found event: ${event.name} (${event.id})`);

  // 3. Get Ticket Type
  console.log('\n🏷️  3. Getting Ticket Type...');
  const { data: ticketType, error: typeError } = await supabase
    .from('ticket_types')
    .select('id, price, name')
    .eq('event_id', event.id)
    .eq('name', 'Men - Before 10 PM')
    .single();

  if (typeError || !ticketType) {
    console.error('❌ Ticket type "Men - Before 10 PM" not found.');
    return;
  }
  console.log(`✅ Found type: ${ticketType.name} ($${ticketType.price})`);

  // 4. Create Order
  console.log('\n🛒 4. Creating Order...');
  const orderId = randomUUID();
  const subtotal = ticketType.price * TICKET_COUNT;
  
  const { error: orderError } = await supabase
    .from('orders')
    .insert({
      id: orderId,
      event_id: event.id,
      purchaser_email: TEST_USER_EMAIL,
      purchaser_name: 'Test Customer',
      user_id: userId,
      subtotal: subtotal,
      fees_total: 0,
      total: subtotal,
      status: 'paid',
      payment_provider: 'stripe',
      payment_reference: `pi_manual_test_${Date.now()}`,
      metadata: {
        source: 'setup-demo-tickets-script'
      }
    });

  if (orderError) {
    console.error('❌ Failed to create order:', orderError.message);
    return;
  }
  console.log(`✅ Order created: ${orderId}`);

  // 5. Generate Tickets
  console.log('\n🎟️  5. Generating Tickets...');
  const tickets = [];
  const issuedAt = new Date().toISOString();

  for (let i = 1; i <= TICKET_COUNT; i++) {
    const ticketIdStr = `MGY-TEST-${Date.now().toString().slice(-6)}-${i}`;
    const qrToken = randomUUID();
    const attendeeEmail = `guest${i}_${Date.now()}@test.com`; // Unique email per ticket if needed, or use main email

    tickets.push({
      order_id: orderId,
      event_id: event.id,
      ticket_type_id: ticketType.id,
      
      // Scanner fields
      qr_token: qrToken,
      attendee_name: `Test Guest ${i}`,
      attendee_email: attendeeEmail, // Use unique email per ticket
      
      // Display fields
      ticket_id: ticketIdStr,
      event_name: event.name,
      ticket_type: ticketType.name,
      
      // QR Data
      qr_code_value: qrToken,
      qr_code_data: ticketIdStr,
      
      // Status
      status: 'issued',
      is_used: false,
      price: ticketType.price,
      fee_total: 0,
      issued_at: issuedAt,
      purchase_date: issuedAt
    });
  }

  const { data: createdTickets, error: ticketError } = await supabase
    .from('tickets')
    .insert(tickets)
    .select('id, ticket_id, qr_token');

  if (ticketError) {
    console.error('❌ Failed to create tickets:', ticketError.message);
    return;
  }

  console.log(`✅ Successfully created ${createdTickets.length} tickets!`);
  
  // 6. Verification Info
  console.log('\n' + '='.repeat(50));
  console.log('✅ SETUP COMPLETE');
  console.log('='.repeat(50));
  console.log('\nYou can now test the full flow:');
  
  console.log('\n1️⃣  Login to Purchase Site');
  console.log('   URL: http://localhost:5173/login');
  console.log('   Use "Quick Login (Demo Account)" button');
  console.log(`   (Credentials: ${TEST_USER_EMAIL} / ${TEST_USER_PASSWORD})`);

  console.log('\n2️⃣  View Your Tickets');
  console.log('   Go to: http://localhost:5173/account');
  console.log('   You should see the new order with 5 tickets.');
  console.log('   Click "View Ticket" to see QR codes.');

  console.log('\n3️⃣  Scan Tickets');
  console.log('   Go to: http://localhost:5175/scanner');
  console.log('   Scan these QR tokens manually:');
  createdTickets.forEach((t, i) => {
    console.log(`   Ticket ${i+1}: ${t.qr_token}`);
  });
}

setupDemoTickets().catch(console.error);

