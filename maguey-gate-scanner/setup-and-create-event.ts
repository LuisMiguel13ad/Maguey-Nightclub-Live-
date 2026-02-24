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

async function setupAndCreateEvent() {
  try {
    console.log('🔧 Step 1: Fixing RLS policies...\n');
    
    const rlsSQL = `
      DROP POLICY IF EXISTS "Owners can insert events" ON events;
      DROP POLICY IF EXISTS "Owners can update events" ON events;
      DROP POLICY IF EXISTS "Owners can delete events" ON events;
      DROP POLICY IF EXISTS "Owners can read events" ON events;
      DROP POLICY IF EXISTS "Public can read published events" ON events;
      DROP POLICY IF EXISTS "Authenticated users can insert events" ON events;
      DROP POLICY IF EXISTS "Authenticated users can update events" ON events;
      DROP POLICY IF EXISTS "Authenticated users can delete events" ON events;
      DROP POLICY IF EXISTS "Authenticated users can read events" ON events;

      CREATE POLICY "Authenticated users can insert events" ON events
        FOR INSERT TO authenticated WITH CHECK (true);

      CREATE POLICY "Authenticated users can update events" ON events
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

      CREATE POLICY "Authenticated users can delete events" ON events
        FOR DELETE TO authenticated USING (true);

      CREATE POLICY "Authenticated users can read events" ON events
        FOR SELECT TO authenticated USING (true);

      CREATE POLICY "Public can read published events" ON events
        FOR SELECT TO anon, authenticated
        USING (status = 'published' AND is_active = true);
    `;

    const { error: rlsError } = await supabase.rpc('exec_sql', { sql: rlsSQL });
    if (rlsError) {
      console.log('⚠️  Note: Could not run RLS migration via RPC. You may need to run it manually in Supabase Dashboard.');
      console.log('   Continuing with event creation using service role key...\n');
    } else {
      console.log('✅ RLS policies updated!\n');
    }

    console.log('🚀 Step 2: Creating event...\n');

    const eventData = {
      name: 'La Maquinaria Norteña, La Energía Norteña y Mister Cumbia',
      description: 'Concierto de música norteña con La Maquinaria Norteña, La Energía Norteña y Mister Cumbia',
      event_date: '2025-12-14',
      event_time: '21:00:00',
      venue_name: 'El Maguey',
      venue_address: null,
      city: null,
      image_url: 'https://boletaje.com/admin/img_principal/1764023314.png',
      status: 'published',
      published_at: new Date().toISOString(),
      categories: [],
      tags: [],
      is_active: true,
    };

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
    console.log('   ID:', event.id);
    console.log('   Name:', event.name);
    console.log('   Date:', event.event_date, event.event_time);
    console.log('');

    console.log('🎫 Step 3: Creating ticket type...\n');

    const ticketTypeData = {
      event_id: event.id,
      name: 'GENERAL',
      code: 'GEN',
      price: 50.00,
      total_inventory: 500,
    };

    const { data: ticketType, error: ticketTypeError } = await supabase
      .from('ticket_types')
      .insert(ticketTypeData)
      .select()
      .single();

    if (ticketTypeError) {
      console.error('❌ Error creating ticket type:', ticketTypeError);
      throw ticketTypeError;
    }

    console.log('✅ Ticket type created!');
    console.log('   Name:', ticketType.name);
    console.log('   Price: $' + ticketType.price);
    console.log('   Capacity:', ticketType.total_inventory);
    console.log('');

    console.log('🎉 Success! Event is ready.');
    console.log('\nNext steps:');
    console.log('1. Check owner dashboard: http://localhost:3005/events');
    console.log('2. Check main site: http://localhost:3000');
    console.log('3. Check purchase site: http://localhost:5173');
    console.log('4. Purchase a ticket and test scanning');

  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

setupAndCreateEvent();

