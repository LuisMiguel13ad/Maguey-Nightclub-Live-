// Create tickets for demo@maguey.com
// Run with: npx tsx fix-demo-tickets.ts

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
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Target: demo@maguey.com (from your screenshot)
const TARGET_EMAIL = 'demo@maguey.com';
const EVENT_NAME = 'PRE THANKSGIVING BASH';

async function fixDemoTickets() {
  console.log(`\n🔧 FIXING TICKETS FOR: ${TARGET_EMAIL}\n`);

  // 1. Get User ID
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users?.find(u => u.email === TARGET_EMAIL);
  
  if (!user) {
    console.error('❌ User demo@maguey.com not found!');
    return;
  }
  console.log(`✅ Found user: ${user.id}`);

  // 2. Get Event
  const { data: event } = await supabase
    .from('events')
    .select('id, name, event_date')
    .eq('name', EVENT_NAME)
    .single();

  if (!event) {
    console.error('❌ Event not found');
    return;
  }
  console.log(`✅ Found event: ${event.name}`);

  // 3. Get Ticket Type
  const { data: ticketType } = await supabase
    .from('ticket_types')
    .select('id, price, name')
    .eq('event_id', event.id)
    .eq('name', 'Men - Before 10 PM')
    .single();

  if (!ticketType) {
    console.error('❌ Ticket type not found');
    return;
  }

  // 4. Create Order
  const orderId = randomUUID();
  await supabase.from('orders').insert({
    id: orderId,
    event_id: event.id,
    purchaser_email: TARGET_EMAIL, // IMPORTANT: Must match login email
    purchaser_name: 'Demo User',
    user_id: user.id,
    subtotal: ticketType.price * 5,
    fees_total: 0,
    total: ticketType.price * 5,
    status: 'paid',
    payment_provider: 'stripe',
    metadata: { source: 'fix-demo-tickets' }
  });
  console.log(`✅ Created Order: ${orderId}`);

  // 5. Create 5 Tickets
  const tickets = [];
  for (let i = 1; i <= 5; i++) {
    const ticketIdStr = `MGY-DEMO-${Date.now().toString().slice(-4)}-${i}`;
    const qrToken = randomUUID();
    
    tickets.push({
      order_id: orderId,
      event_id: event.id,
      ticket_type_id: ticketType.id,
      qr_token: qrToken,
      attendee_name: `Demo Guest ${i}`,
      attendee_email: `demo+guest${i}@maguey.com`, // Unique email per ticket to satisfy constraint
      ticket_id: ticketIdStr,
      event_name: event.name,
      ticket_type: ticketType.name,
      qr_code_value: qrToken,
      qr_code_data: ticketIdStr,
      status: 'issued',
      is_used: false,
      price: ticketType.price,
      purchase_date: new Date().toISOString()
    });
  }

  const { error: ticketError } = await supabase.from('tickets').insert(tickets);
  
  if (ticketError) {
    console.error('❌ Error creating tickets:', ticketError.message);
  } else {
    console.log(`✅ Successfully added 5 tickets to ${TARGET_EMAIL}`);
    console.log('\n👉 Refresh your browser page (http://localhost:5173/account)');
    console.log('   You should see the tickets now!');
  }
}

fixDemoTickets();

