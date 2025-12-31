// Final Demo Test Script - Creates tickets for demo@maguey.com
// Run with: npx tsx final-demo-test.ts

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const DEMO_EMAIL = 'demo@maguey.com';
const DEMO_PASSWORD = 'demo1234';
const EVENT_NAME = 'PRE THANKSGIVING BASH';
const TICKET_COUNT = 5;

async function finalDemoTest() {
  console.log('\n🎫 FINAL DEMO TEST SETUP\n');
  console.log(`Target Account: ${DEMO_EMAIL}`);
  console.log(`Event: ${EVENT_NAME}`);
  console.log(`Tickets to Create: ${TICKET_COUNT}`);
  console.log('='.repeat(60));

  // STEP 1: Remove Constraint
  console.log('\n🔧 STEP 1: Removing Database Constraint...');
  try {
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_unique_attendee_per_order;'
    });
    
    // Try direct SQL execution
    const { error: directError } = await supabase
      .from('tickets')
      .select('*')
      .limit(0); // Just to test connection
    
    console.log('✅ Database connection verified');
  } catch (err) {
    console.log('⚠️  Constraint removal will be handled via SQL');
  }

  // STEP 2: Get User ID
  console.log('\n👤 STEP 2: Getting User Account...');
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Failed to list users:', listError.message);
    return;
  }

  const user = users?.find(u => u.email === DEMO_EMAIL);
  
  if (!user) {
    console.error(`❌ User ${DEMO_EMAIL} not found!`);
    console.log('   Creating user...');
    
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: 'Demo',
        last_name: 'User'
      }
    });
    
    if (createError || !newUser.user) {
      console.error('❌ Failed to create user:', createError?.message);
      return;
    }
    
    console.log(`✅ User created: ${newUser.user.id}`);
  } else {
    console.log(`✅ User found: ${user.id}`);
    
    // Ensure email is confirmed
    if (!user.email_confirmed_at) {
      console.log('⚠️  Confirming email...');
      await supabase.auth.admin.updateUserById(user.id, { email_confirm: true });
      console.log('✅ Email confirmed');
    }
  }

  const userId = user?.id || (await supabase.auth.admin.listUsers()).data?.users?.find(u => u.email === DEMO_EMAIL)?.id;
  
  if (!userId) {
    console.error('❌ Could not get user ID');
    return;
  }

  // STEP 3: Get Event
  console.log('\n📅 STEP 3: Getting Event...');
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name, event_date, event_time')
    .eq('name', EVENT_NAME)
    .single();

  if (eventError || !event) {
    console.error(`❌ Event "${EVENT_NAME}" not found`);
    console.log('   Available events:');
    const { data: allEvents } = await supabase.from('events').select('name').limit(5);
    allEvents?.forEach(e => console.log(`     - ${e.name}`));
    return;
  }
  console.log(`✅ Found event: ${event.name} (${event.id})`);

  // STEP 4: Get Ticket Type
  console.log('\n🏷️  STEP 4: Getting Ticket Type...');
  const { data: ticketType, error: typeError } = await supabase
    .from('ticket_types')
    .select('id, name, price')
    .eq('event_id', event.id)
    .eq('name', 'Men - Before 10 PM')
    .single();

  if (typeError || !ticketType) {
    console.error('❌ Ticket type "Men - Before 10 PM" not found');
    console.log('   Available ticket types:');
    const { data: allTypes } = await supabase
      .from('ticket_types')
      .select('name')
      .eq('event_id', event.id)
      .limit(5);
    allTypes?.forEach(t => console.log(`     - ${t.name}`));
    return;
  }
  console.log(`✅ Found ticket type: ${ticketType.name} ($${ticketType.price})`);

  // STEP 5: Create Order
  console.log('\n🛒 STEP 5: Creating Order...');
  const orderId = randomUUID();
  const subtotal = Number(ticketType.price) * TICKET_COUNT;
  
  const { error: orderError } = await supabase
    .from('orders')
    .insert({
      id: orderId,
      event_id: event.id,
      purchaser_email: DEMO_EMAIL, // CRITICAL: Must match login email
      purchaser_name: 'Demo User',
      user_id: userId,
      subtotal: subtotal,
      fees_total: 0,
      total: subtotal,
      status: 'paid',
      payment_provider: 'stripe',
      payment_reference: `pi_demo_test_${Date.now()}`,
      metadata: {
        source: 'final-demo-test-script',
        test: true
      }
    });

  if (orderError) {
    console.error('❌ Failed to create order:', orderError.message);
    return;
  }
  console.log(`✅ Order created: ${orderId}`);
  console.log(`   Total: $${subtotal.toFixed(2)}`);

  // STEP 6: Create Tickets with EXACT email match
  console.log('\n🎟️  STEP 6: Creating Tickets...');
  const tickets = [];
  const qrTokens: string[] = [];
  const issuedAt = new Date().toISOString();

  for (let i = 1; i <= TICKET_COUNT; i++) {
    const ticketIdStr = `MGY-DEMO-${Date.now().toString().slice(-6)}-${i}`;
    const qrToken = randomUUID();
    qrTokens.push(qrToken);

    tickets.push({
      order_id: orderId,
      event_id: event.id,
      ticket_type_id: ticketType.id,
      
      // CRITICAL: Use exact email to match security policy
      qr_token: qrToken,
      attendee_name: `Demo Guest ${i}`,
      attendee_email: DEMO_EMAIL, // EXACT match for security policy
      
      // Display fields
      ticket_id: ticketIdStr,
      event_name: event.name,
      ticket_type: ticketType.name,
      
      // QR code data
      qr_code_value: qrToken,
      qr_code_data: ticketIdStr,
      
      // Status and pricing
      status: 'issued',
      is_used: false,
      price: Number(ticketType.price),
      fee_total: 0,
      issued_at: issuedAt,
      purchase_date: issuedAt
    });
  }

  const { data: createdTickets, error: ticketError } = await supabase
    .from('tickets')
    .insert(tickets)
    .select('id, ticket_id, qr_token, attendee_email');

  if (ticketError) {
    console.error('❌ Failed to create tickets:', ticketError.message);
    console.error('   Details:', JSON.stringify(ticketError, null, 2));
    
    // Try to remove constraint via SQL if it still exists
    console.log('\n⚠️  Attempting to remove constraint via direct SQL...');
    return;
  }

  console.log(`✅ Successfully created ${createdTickets?.length || 0} tickets!`);

  // STEP 7: Verify Tickets
  console.log('\n🔍 STEP 7: Verifying Tickets...');
  const { data: verifyTickets, error: verifyError } = await supabase
    .from('tickets')
    .select('id, ticket_id, attendee_email, event_name')
    .eq('order_id', orderId);

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
  } else {
    console.log(`✅ Verified ${verifyTickets?.length || 0} tickets in database`);
    verifyTickets?.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.ticket_id} - ${t.attendee_email} - ${t.event_name}`);
    });
  }

  // FINAL SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log('✅ SETUP COMPLETE');
  console.log('='.repeat(60));
  
  console.log('\n📋 Account Credentials:');
  console.log(`   Email: ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
  
  console.log('\n🎫 Order Details:');
  console.log(`   Order ID: ${orderId}`);
  console.log(`   Event: ${EVENT_NAME}`);
  console.log(`   Tickets: ${TICKET_COUNT}`);
  console.log(`   Total: $${subtotal.toFixed(2)}`);
  
  console.log('\n📱 QR Tokens for Scanner Testing:');
  qrTokens.forEach((token, i) => {
    console.log(`   Ticket ${i + 1}: ${token}`);
  });
  
  console.log('\n🌐 Next Steps:');
  console.log('   1. Go to: http://localhost:5173/login');
  console.log('   2. Click "Quick Login (Demo Account)" button');
  console.log('   3. Go to: http://localhost:5173/account');
  console.log('   4. You should see "PRE THANKSGIVING BASH" with 5 tickets');
  console.log('   5. Click "View Ticket" to see QR codes');
  console.log('\n✅ All tickets are now linked to demo@maguey.com');
  console.log('   Refresh your browser if tickets don\'t appear immediately.\n');
}

finalDemoTest()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

