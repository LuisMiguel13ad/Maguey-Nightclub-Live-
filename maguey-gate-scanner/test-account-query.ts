// Test the exact query the Account page uses
// Run with: npx tsx test-account-query.ts

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try both locations for .env
config({ path: resolve(__dirname, '.env') });
config({ path: resolve(__dirname, '../maguey-pass-lounge/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Use anon key to test RLS

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

// Simulate logged-in user session
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEMO_EMAIL = 'demo@maguey.com';

async function testAccountQuery() {
  console.log('\n🧪 TESTING ACCOUNT PAGE QUERY\n');
  console.log(`Simulating user: ${DEMO_EMAIL}`);
  console.log('='.repeat(60));

  // Step 1: Get orders (same as getUserTickets does)
  console.log('\n1️⃣  Getting Orders...');
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .eq('purchaser_email', DEMO_EMAIL);

  if (ordersError) {
    console.error('❌ Orders query failed:', ordersError.message);
    console.error('   This might be an RLS policy issue');
    return;
  }

  if (!orders || orders.length === 0) {
    console.error('❌ No orders found');
    return;
  }

  console.log(`✅ Found ${orders.length} orders`);
  const orderIds = orders.map(o => o.id);
  console.log(`   Order IDs: ${orderIds.slice(0, 3).join(', ')}...`);

  // Step 2: Get tickets (same query as getUserTickets)
  console.log('\n2️⃣  Getting Tickets...');
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select(`
      *,
      events (
        id,
        name,
        image_url,
        event_date,
        event_time,
        venue_name,
        venue_address,
        city
      ),
      orders (
        id,
        purchaser_email,
        purchaser_name
      ),
      ticket_types (
        code,
        name,
        description
      )
    `)
    .in('order_id', orderIds)
    .order('issued_at', { ascending: false });

  if (ticketsError) {
    console.error('❌ Tickets query failed:', ticketsError.message);
    console.error('   This is likely an RLS policy issue');
    console.error('   The policy requires attendee_email to match logged-in user email');
    return;
  }

  if (!tickets || tickets.length === 0) {
    console.error('❌ No tickets returned (RLS policy may be blocking)');
    console.log('\n💡 Possible issues:');
    console.log('   1. RLS policy requires attendee_email = user.email');
    console.log('   2. User session not properly authenticated');
    console.log('   3. Tickets have wrong attendee_email');
    return;
  }

  console.log(`✅ Found ${tickets.length} tickets!`);
  
  // Check attendee emails
  const attendeeEmails = [...new Set(tickets.map(t => t.attendee_email))];
  console.log(`\n📧 Attendee emails in tickets:`);
  attendeeEmails.forEach(email => {
    const count = tickets.filter(t => t.attendee_email === email).length;
    console.log(`   - ${email}: ${count} ticket(s)`);
  });

  // Check event dates
  console.log(`\n📅 Event dates:`);
  tickets.forEach((t, i) => {
    const event = t.events || {};
    console.log(`   ${i + 1}. ${event.name || 'Unknown'} - ${event.event_date || 'No date'}`);
  });

  // Filter upcoming (same logic as Account page)
  const now = new Date();
  const upcoming = tickets.filter(t => {
    const event = t.events || {};
    const eventDate = event.event_date ? new Date(event.event_date) : null;
    return eventDate && eventDate >= now && t.status !== 'checked_in';
  });

  console.log(`\n✅ Upcoming tickets: ${upcoming.length}`);
  console.log(`   (Filtered by: event_date >= now AND status != 'checked_in')`);

  if (upcoming.length === 0 && tickets.length > 0) {
    console.log('\n⚠️  All tickets are in the past or checked in');
    console.log('   Check event_date in events table');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ QUERY TEST COMPLETE');
  console.log('='.repeat(60));
  console.log('\n💡 If tickets exist but don\'t show:');
  console.log('   1. Check browser console for errors');
  console.log('   2. Verify user is logged in as demo@maguey.com');
  console.log('   3. Hard refresh browser (Cmd+Shift+R)');
  console.log('   4. Check RLS policies allow ticket viewing\n');
}

testAccountQuery()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

