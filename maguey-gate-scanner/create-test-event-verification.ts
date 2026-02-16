/**
 * Create Test Event for Verification
 * Uses current schema with separate ticket_types table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestEvent() {
  console.log('🎉 Creating Test Event for Verification...\n');

  // Use current schema: event_date (date string), event_time (time string), status
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 7); // 7 days from now
  const eventDateStr = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const eventTime = '21:00'; // 9 PM

  const eventData = {
    name: `Verification Test Event - ${new Date().toISOString().split('T')[0]}`,
    description: 'Integration verification test event - created automatically',
    event_date: eventDateStr,
    event_time: eventTime,
    venue_name: 'Test Venue',
    venue_address: '123 Test Street',
    city: 'Test City',
    status: 'published',
    is_active: true,
  };

  console.log('Event Details:');
  console.log(`  Name: ${eventData.name}`);
  console.log(`  Date: ${eventData.event_date}`);
  console.log(`  Time: ${eventData.event_time}`);
  console.log(`  Status: ${eventData.status}\n`);

  try {
    // Insert event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert([eventData])
      .select()
      .single();

    if (eventError) {
      if (eventError.code === '23505') {
        console.log('⚠️  Event with this name already exists!');
        console.log('💡 Using existing event for verification...');
        // Try to find existing event
        const { data: existing } = await supabase
          .from('events')
          .select('*')
          .eq('name', eventData.name)
          .single();
        if (existing) {
          console.log(`✅ Found existing event: ${existing.id}`);
          return existing;
        }
      }
      throw eventError;
    }

    console.log('✅ Event Created Successfully!');
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Event Name: ${event.name}\n`);

    // Create ticket types in separate table
    const ticketTypes = [
      { name: 'General Admission', price: 25.00, capacity: 100 },
      { name: 'VIP', price: 50.00, capacity: 50 },
    ];

    const ticketTypeRows = ticketTypes.map((tt, index) => ({
      event_id: event.id,
      name: tt.name.trim(),
      code: `GEN${index}`,
      price: tt.price,
      total_inventory: tt.capacity,
    }));

    const { error: ttError } = await supabase
      .from('ticket_types')
      .insert(ticketTypeRows);

    if (ttError) {
      console.log('⚠️  Warning: Could not create ticket types:', ttError.message);
    } else {
      console.log('✅ Ticket Types Created:');
      ticketTypes.forEach((tt, i) => {
        console.log(`   ${i + 1}. ${tt.name}: $${tt.price} (${tt.capacity} capacity)`);
      });
    }

    console.log('\n📋 Verification URLs:');
    console.log(`   Scanner Site: http://localhost:5175/events`);
    console.log(`   Main Site: http://localhost:3000/events`);
    console.log(`   Purchase Site: http://localhost:5173/events`);
    console.log(`\n   Main Event Page: http://localhost:3000/event/${event.id}`);
    console.log(`   Purchase Event Page: http://localhost:5173/event/${event.id}`);

    return event;
  } catch (error: any) {
    console.error('❌ Error creating event:', error.message);
    throw error;
  }
}

createTestEvent()
  .then(() => {
    console.log('\n✨ Test event creation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });


