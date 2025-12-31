import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://djbzjasdrwvbsoifxqzd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDA5ODAsImV4cCI6MjA3ODM3Njk4MH0.q5nWNWKpAkTmIWf_hbxINpyzUENySwjulQw1h3c5Xws';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createEvent() {
  try {
    // First, try to sign in as owner (you'll need to provide password or use existing session)
    // For now, we'll try to use an existing session if available
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('No existing session. Please sign in first.');
      console.log('Attempting to sign in with owner@test.maguey...');
      // You'll need to provide the password here or sign in via the UI first
      console.log('If you have the password, uncomment the signIn line below:');
      // const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      //   email: 'owner@test.maguey',
      //   password: 'YOUR_PASSWORD_HERE'
      // });
      // if (authError) throw authError;
      throw new Error('No session found. Please sign in via the UI first, or provide password in script.');
    }

    console.log('Authenticated as:', session.user.email);

    // Event details from the image
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

    console.log('Creating event...');
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();

    if (eventError) {
      console.error('Error creating event:', eventError);
      throw eventError;
    }

    console.log('Event created:', event.id);

    // Create ticket type
    const ticketTypeData = {
      event_id: event.id,
      name: 'GENERAL',
      code: 'GEN',
      price: 50.00,
      total_inventory: 500,
    };

    console.log('Creating ticket type...');
    const { data: ticketType, error: ticketTypeError } = await supabase
      .from('ticket_types')
      .insert(ticketTypeData)
      .select()
      .single();

    if (ticketTypeError) {
      console.error('Error creating ticket type:', ticketTypeError);
      throw ticketTypeError;
    }

    console.log('Ticket type created:', ticketType.id);
    console.log('\n✅ Event created successfully!');
    console.log('Event ID:', event.id);
    console.log('Event Name:', event.name);
    console.log('Event Date:', event.event_date);
    console.log('Ticket Type:', ticketType.name, '- $' + ticketType.price);

  } catch (error: any) {
    console.error('Failed to create event:', error);
    console.error('\nTo fix this:');
    console.error('1. Run the SQL migration: supabase/migrations/fix_rls_for_events.sql');
    console.error('2. Or sign in via the UI first, then run this script');
    console.error('3. Or provide the service role key to bypass RLS');
    process.exit(1);
  }
}

createEvent();

