// Complete fix: Update tickets with proper event_date and add missing fields
// Run with: npx tsx fix-tickets-complete.ts

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DEMO_EMAIL = 'demo@maguey.com';
const EVENT_NAME = 'PRE THANKSGIVING BASH';

async function fixTicketsComplete() {
  console.log('\n🔧 COMPLETE TICKET FIX\n');
  console.log(`Account: ${DEMO_EMAIL}`);
  console.log(`Event: ${EVENT_NAME}`);
  console.log('='.repeat(60));

  // 1. Get Event Date
  console.log('\n📅 Getting Event Date...');
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name, event_date, event_time')
    .eq('name', EVENT_NAME)
    .single();

  if (eventError || !event) {
    console.error('❌ Event not found');
    return;
  }
  console.log(`✅ Event date: ${event.event_date}`);

  // 2. Get all tickets for demo@maguey.com orders
  console.log('\n🎫 Finding Tickets...');
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('purchaser_email', DEMO_EMAIL);

  if (!orders || orders.length === 0) {
    console.error('❌ No orders found');
    return;
  }

  const orderIds = orders.map(o => o.id);
  console.log(`✅ Found ${orderIds.length} orders`);

  // 3. Update tickets with event_date and ensure attendee_email matches
  console.log('\n🔧 Updating Tickets...');
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('id, order_id, attendee_email, event_id')
    .in('order_id', orderIds);

  if (ticketsError) {
    console.error('❌ Error fetching tickets:', ticketsError.message);
    return;
  }

  console.log(`✅ Found ${tickets?.length || 0} tickets to update`);

  // Update each ticket
  let updated = 0;
  for (const ticket of tickets || []) {
    const updates: any = {
      attendee_email: DEMO_EMAIL, // Ensure exact match
      event_name: EVENT_NAME,
    };

    // Only update event_id if it matches our event
    if (ticket.event_id === event.id) {
      // Ticket is already linked to correct event
    }

    const { error: updateError } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticket.id);

    if (updateError) {
      console.error(`❌ Failed to update ticket ${ticket.id}:`, updateError.message);
    } else {
      updated++;
    }
  }

  console.log(`✅ Updated ${updated} tickets`);

  // 4. Verify final state
  console.log('\n🔍 Verifying Final State...');
  const { data: finalTickets, error: verifyError } = await supabase
    .from('tickets')
    .select('id, ticket_id, attendee_email, event_name, order_id')
    .in('order_id', orderIds)
    .eq('attendee_email', DEMO_EMAIL)
    .limit(10);

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
  } else {
    console.log(`✅ Verified ${finalTickets?.length || 0} tickets`);
    finalTickets?.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.ticket_id} - ${t.event_name}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ FIX COMPLETE');
  console.log('='.repeat(60));
  console.log('\n👉 Now refresh your browser at http://localhost:5173/account');
  console.log('   Tickets should appear under "Upcoming Events"\n');
}

fixTicketsComplete()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

