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

async function createNengoFlowEvent() {
  console.log('🎵 Step 1: Creating Nengo Flow Event...\n');
  
  const eventData = {
    name: 'Ñengo Flow',
    description: 'Maguey La Casa Del Perreo presenta Ñengo Flow con DJ Tory Flow, DJ Patrick, DJ Calle, DJ Houdini',
    event_date: '2025-12-12',
    event_time: '21:00:00',
    venue_name: 'El Maguey',
    venue_address: '3320 Old Capital Trail, Wilmington, DE 19808',
    city: 'Wilmington',
    image_url: 'https://boletaje.com/admin/img_principal/1762821097.png',
    status: 'published',
    published_at: new Date().toISOString(),
    categories: [],
    tags: [],
    is_active: true,
  };

  console.log('📝 Event Details:');
  console.log('   Name:', eventData.name);
  console.log('   Date:', eventData.event_date);
  console.log('   Time:', eventData.event_time);
  console.log('   Venue:', eventData.venue_name);
  console.log('');

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert(eventData)
    .select()
    .single();

  if (eventError) {
    console.error('❌ Error creating event:', eventError);
    throw eventError;
  }

  console.log('✅ Event created!');
  console.log('   Event ID:', event.id);
  console.log('');

  console.log('🎫 Step 2: Creating ticket types...\n');

  const ticketTypes = [
    {
      event_id: event.id,
      name: 'GENERAL',
      code: 'GEN',
      price: 60.00,
      total_inventory: 500,
    }
  ];

  for (const tt of ticketTypes) {
    console.log(`   Creating: ${tt.name} - $${tt.price} (${tt.total_inventory} capacity)`);
    const { data: ticketType, error: ttError } = await supabase
      .from('ticket_types')
      .insert(tt)
      .select()
      .single();

    if (ttError) {
      console.error(`   ❌ Error creating ${tt.name}:`, ttError);
      throw ttError;
    }
    console.log(`   ✅ Created: ${ticketType.name} (ID: ${ticketType.id})`);
  }

  console.log('\n🎉 Event creation complete!');
  console.log('\nEvent Summary:');
  console.log('   Name:', event.name);
  console.log('   Date:', event.event_date);
  console.log('   Venue:', event.venue_name);
  console.log('   Ticket Type:', ticketTypes[0].name, '- $' + ticketTypes[0].price);
  console.log('');
}

createNengoFlowEvent().catch(console.error);
