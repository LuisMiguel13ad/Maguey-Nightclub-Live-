import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

async function testAPI() {
  const eventName = 'New Years Eve 2025 Celebration';
  
  console.log('🔍 Testing Availability API Logic\n');
  
  // Step 1: Get event
  console.log('Step 1: Getting event...');
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name')
    .eq('name', eventName)
    .single();
  
  if (eventError || !event) {
    console.error('❌ Event not found:', eventError);
    return;
  }
  
  console.log('✅ Event found:', event.name);
  console.log('Event ID:', event.id);
  console.log('Has ticket_types JSONB:', event.ticket_types ? 'Yes' : 'No');
  
  // Step 2: Check ticket_types table
  console.log('\nStep 2: Checking ticket_types table...');
  const { data: ticketTypes, error: ttError } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('event_id', event.id);
  
  if (ttError) {
    console.error('❌ Error:', ttError);
  } else {
    console.log(`✅ Found ${ticketTypes.length} ticket types`);
    ticketTypes.forEach((tt, i) => {
      console.log(`  ${i + 1}. ${tt.name} (${tt.code}): $${tt.price} - ${tt.total_inventory} capacity`);
    });
  }
  
  // Step 3: Count sold tickets
  console.log('\nStep 3: Counting sold tickets...');
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('ticket_type, status')
    .eq('event_name', eventName)
    .neq('status', 'cancelled');
  
  if (ticketsError) {
    console.error('❌ Error:', ticketsError);
  } else {
    console.log(`✅ Found ${tickets.length} tickets`);
  }
  
  // Step 4: Test the actual API
  console.log('\nStep 4: Testing API endpoint...');
  const response = await fetch(
    `${process.env.VITE_SUPABASE_URL}/functions/v1/event-availability/${encodeURIComponent(eventName)}`,
    {
      headers: {
        'apikey': process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
      }
    }
  );
  
  const apiData = await response.json();
  console.log('\n📊 API Response:');
  console.log(JSON.stringify(apiData, null, 2));
}

testAPI();
