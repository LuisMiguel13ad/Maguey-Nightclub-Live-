// Load environment variables from .env file FIRST
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
config({ path: resolve(__dirname, '../.env') });

/**
 * Test function to lookup a ticket by QR token and log the result
 */
async function testTicketLookup() {
  // Dynamic import after env vars are loaded
  const { supabase } = await import('./lib/supabase');
  const qrToken = '625a23e7-23b1-4f66-bbf3-6029b9e6a7aa';

  console.log('🔍 Testing ticket lookup...');
  console.log(`QR Token: ${qrToken}`);
  console.log('---');

  try {
    const { data, error } = await supabase
      .from('tickets')
      .select(
        `
        id,
        order_id,
        event_id,
        ticket_type_id,
        attendee_name,
        qr_token,
        qr_signature,
        status,
        scanned_at,
        issued_at,
        events (
          id,
          name,
          event_date,
          event_time,
          venue_name,
          city
        ),
        ticket_types (
          id,
          name,
          price
        )
      `
      )
      .eq('qr_token', qrToken)
      .maybeSingle();

    if (error) {
      console.error('❌ Error querying ticket:', error);
      return;
    }

    if (!data) {
      console.log('⚠️  No ticket found with that QR token');
      return;
    }

    console.log('✅ Ticket found!');
    console.log('---');
    console.log('Ticket Data:');
    console.log(JSON.stringify(data, null, 2));
    console.log('---');
    console.log('Summary:');
    console.log(`  Ticket ID: ${data.id}`);
    console.log(`  Order ID: ${data.order_id}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Attendee: ${data.attendee_name || 'N/A'}`);
    console.log(`  Issued At: ${data.issued_at || 'N/A'}`);
    console.log(`  Scanned At: ${data.scanned_at || 'Not scanned yet'}`);
    
    if (data.events) {
      const event = Array.isArray(data.events) ? data.events[0] : data.events;
      if (event) {
        console.log(`  Event: ${event.name}`);
        console.log(`  Event Date: ${event.event_date}`);
        console.log(`  Venue: ${event.venue_name || 'N/A'}`);
      }
    }

    if (data.ticket_types) {
      const ticketType = Array.isArray(data.ticket_types) ? data.ticket_types[0] : data.ticket_types;
      if (ticketType) {
        console.log(`  Ticket Type: ${ticketType.name}`);
        console.log(`  Price: $${ticketType.price}`);
      }
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

// Run the test when executed directly
testTicketLookup()
  .then(() => {
    console.log('---');
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });

export { testTicketLookup };

