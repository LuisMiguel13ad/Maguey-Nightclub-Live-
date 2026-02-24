import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Error: VITE_SUPABASE_URL environment variable is not set');
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testPurchase() {
  try {
    console.log('🛒 Testing purchase flow...\n');

    // Find the event
    const { data: events } = await supabase
      .from('events')
      .select('id, name')
      .eq('name', 'La Maquinaria Norteña, La Energía Norteña y Mister Cumbia')
      .limit(1);

    if (!events || events.length === 0) {
      console.error('❌ Event not found');
      return;
    }

    const event = events[0];
    console.log('✅ Found event:', event.name);
    console.log('   Event ID:', event.id);
    console.log('');

    // Get ticket type
    const { data: ticketTypes } = await supabase
      .from('ticket_types')
      .select('id, name, price')
      .eq('event_id', event.id)
      .limit(1);

    if (!ticketTypes || ticketTypes.length === 0) {
      console.error('❌ No ticket types found');
      return;
    }

    const ticketType = ticketTypes[0];
    console.log('✅ Found ticket type:', ticketType.name);
    console.log('   Price: $' + ticketType.price);
    console.log('   Ticket Type ID:', ticketType.id);
    console.log('');

    // Create order
    const orderData = {
      event_id: event.id,
      purchaser_name: 'Test Customer',
      purchaser_email: 'test@maguey.com',
      subtotal: ticketType.price * 100, // in cents
      fees_total: 550, // $5.50 in cents
      total: (ticketType.price * 100) + 550,
      status: 'paid',
      payment_provider: 'test',
      payment_reference: 'test_' + Date.now(),
    };

    console.log('📝 Creating order...');
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('❌ Error creating order:', orderError);
      return;
    }

    console.log('✅ Order created!');
    console.log('   Order ID:', order.id);
    console.log('   Total: $' + (order.total / 100).toFixed(2));
    console.log('');

    // Create ticket (using only fields that exist in schema)
    const qrToken = 'test-qr-' + Date.now();
    const ticketData = {
      order_id: order.id,
      event_id: event.id,
      ticket_type_id: ticketType.id,
      attendee_name: 'Test Customer',
      attendee_email: 'test@maguey.com',
      status: 'valid',
      price: ticketType.price * 100,
      fee_total: 550,
      qr_token: qrToken,
      qr_code_value: qrToken,
    };

    console.log('🎫 Creating ticket...');
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select()
      .single();

    if (ticketError) {
      console.error('❌ Error creating ticket:', ticketError);
      return;
    }

    console.log('✅ Ticket created!');
    console.log('   Ticket ID:', ticket.id);
    console.log('   QR Token:', ticket.qr_token);
    console.log('   Status:', ticket.status);
    console.log('');

    console.log('🎉 Purchase test complete!');
    console.log('\nNext steps:');
    console.log('1. Use QR token to test scanning:', ticket.qr_token);
    console.log('2. Check scanner at: http://localhost:3005/scanner');
    console.log('3. Verify ticket appears in owner dashboard');

  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

testPurchase();

