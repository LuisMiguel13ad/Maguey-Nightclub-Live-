import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
  console.error('   Set them in your .env.local file or export them before running this script.');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkForDuplicate(eventName: string, eventDate: string): Promise<string | null> {
  console.log('🔍 Checking for existing event with same name and date...');
  
  const { data: existingEvents, error } = await supabase
    .from('events')
    .select('id, name, event_date')
    .ilike('name', `%${eventName}%`)
    .eq('event_date', eventDate);

  if (error) {
    console.warn('⚠️  Error checking for duplicates:', error.message);
    return null; // Continue if check fails
  }

  if (existingEvents && existingEvents.length > 0) {
    const existing = existingEvents[0];
    console.log(`⚠️  Found existing event: ${existing.name} (ID: ${existing.id})`);
    return existing.id;
  }

  console.log('✅ No duplicate found');
  return null;
}

async function createMisterKumbiaEvent() {
  console.log('🎵 Starting to create Mister Kumbia event...\n');

  try {
    const eventName = 'Mister Kumbia, Son Cubaney, Sensacion Bakano, Starboy y Cali-Rumba';
    const eventDate = '2025-12-14';

    // Check for duplicate before creating
    const existingEventId = await checkForDuplicate(eventName, eventDate);
    if (existingEventId) {
      console.log(`\n❌ Duplicate event detected!`);
      console.log(`   An event with the same name and date already exists.`);
      console.log(`   Existing Event ID: ${existingEventId}`);
      console.log(`\n   To update the existing event, use the owner dashboard at:`);
      console.log(`   http://localhost:3005/dashboard`);
      console.log(`\n   Or delete the existing event first if you want to recreate it.`);
      process.exit(1);
    }

    // Event data
    const eventData = {
      name: 'Mister Kumbia, Son Cubaney, Sensacion Bakano, Starboy y Cali-Rumba',
      description: 'Un evento épico con Mister Kumbia tocando todos sus 56 éxitos, junto con Son Cubaney, Sensacion Bakano, Starboy y Cali-Rumba. ¡No te lo pierdas!',
      event_date: '2025-12-14',
      event_time: '21:00:00', // 9:00 PM
      venue_name: 'El Maguey',
      venue_address: '3320 Old Capitol Trail',
      city: 'Wilmington, DE',
      image_url: 'https://boletaje.com/admin/img_principal/1762835068.png',
      status: 'published',
      published_at: new Date().toISOString(),
      is_active: true,
      genre: 'Cumbia',
      categories: ['Cumbia', 'Latin Music', 'Live Performance'],
      tags: ['Mister Kumbia', 'Son Cubaney', 'Sensacion Bakano', 'Starboy', 'Cali-Rumba']
    };

    console.log('📝 Inserting event into database...');
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();

    if (eventError) {
      throw new Error(`Failed to create event: ${eventError.message}`);
    }

    console.log('✅ Event created successfully!');
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Event Name: ${event.name}\n`);

    // Ticket types
    const ticketTypes = [
      {
        event_id: event.id,
        name: 'GENERAL',
        code: 'GENERAL',
        price: 3000, // $30.00 in cents
        fee: 370, // $3.70 in cents
        total_inventory: 500,
        limit_per_order: 10
      }
    ];

    console.log('🎫 Creating ticket types...');
    const { data: tickets, error: ticketsError } = await supabase
      .from('ticket_types')
      .insert(ticketTypes)
      .select();

    if (ticketsError) {
      throw new Error(`Failed to create ticket types: ${ticketsError.message}`);
    }

    console.log('✅ Ticket types created successfully!');
    tickets?.forEach((ticket, index) => {
      console.log(`   Ticket ${index + 1}: ${ticket.name} - $${(ticket.price / 100).toFixed(2)} + $${(ticket.fee / 100).toFixed(2)} fee`);
    });

    console.log('\n🎉 Event creation complete!');
    console.log(`\n📋 Event Details:`);
    console.log(`   Name: ${event.name}`);
    console.log(`   Date: ${event.event_date} at ${event.event_time}`);
    console.log(`   Venue: ${event.venue_name}, ${event.city}`);
    console.log(`   Image: ${event.image_url}`);
    console.log(`   Status: ${event.status}`);
    console.log(`\n🔗 Check the event at:`);
    console.log(`   Purchase Site: http://localhost:5173/checkout?event=${event.id}`);
    console.log(`   Main Site: http://localhost:3000/`);

  } catch (error) {
    console.error('❌ Error creating event:', error);
    process.exit(1);
  }
}

// Run the script
createMisterKumbiaEvent();

