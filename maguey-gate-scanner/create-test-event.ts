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
  console.log('🎉 Creating Test Event...\n');

  // Event details
  const eventData = {
    name: 'Summer Bash 2025',
    description: 'Epic summer party with live DJ and drinks',
    event_date: new Date('2025-07-15T21:00:00Z').toISOString(), // July 15, 2025 at 9 PM
    venue_capacity: 300,
    ticket_types: [
      {
        name: 'VIP',
        price: 75.00,
        capacity: 50
      },
      {
        name: 'General Admission',
        price: 35.00,
        capacity: 250
      }
    ],
    is_active: true
  };

  console.log('Event Details:');
  console.log(`  Name: ${eventData.name}`);
  console.log(`  Description: ${eventData.description}`);
  console.log(`  Date: ${new Date(eventData.event_date).toLocaleDateString()}`);
  console.log(`  Venue Capacity: ${eventData.venue_capacity}`);
  console.log(`  Ticket Types:`);
  eventData.ticket_types.forEach((tt, i) => {
    console.log(`    ${i + 1}. ${tt.name}: $${tt.price} (${tt.capacity} capacity)`);
  });
  console.log('');

  // Insert event
  const { data, error } = await supabase
    .from('events')
    .insert([eventData])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      console.error('❌ Event with this name already exists!');
      console.log('💡 Try a different event name or delete the existing one first.');
    } else {
      console.error('❌ Error creating event:', error.message);
    }
    return;
  }

  console.log('✅ Event Created Successfully!\n');
  console.log('Event ID:', data.id);
  console.log('Event Name:', data.name);
  console.log('\n📋 Next Steps:');
  console.log('1. Test the availability API again at: test-availability-api.html');
  console.log('2. Change the event name to "Summer Bash 2025" in the test');
  console.log('3. You should now see ticket types in the response!');
  console.log('\n🔗 Or test with curl:');
  console.log(`curl "https://djbzjasdrwvbsoifxqzd.supabase.co/functions/v1/event-availability/Summer%20Bash%202025" \\`);
  console.log(`  -H "apikey: ${supabaseKey}" \\`);
  console.log(`  -H "Authorization: Bearer ${supabaseKey}"`);
}

createTestEvent();

