
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function addEvent() {
  console.log('Adding event: La Maquinaria Norteña...');

  const eventData = {
    name: 'La Maquinaria Norteña, La Energia Norteña y Mister Cumbia',
    description: 'Llegan Los Energy Boyz y Mister Cumbia a El Maguey!',
    event_date: '2025-12-14',
    event_time: '21:00', // 9:00 PM
    venue_name: 'Maguey Delaware',
    venue_address: '3320 Old Capitol Trail',
    city: 'Wilmington',
    image_url: 'https://boletaje.com/admin/img_principal/1764023314.png',
    status: 'published',
    categories: ['Regional Mexicano', 'Cumbia'],
    tags: ['Norteña', 'Live Music'],
    is_active: true
  };

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert(eventData)
    .select()
    .single();

  if (eventError) {
    console.error('Error inserting event:', eventError);
    process.exit(1);
  }

  console.log('Event added:', event.id);

  const ticketTypeData = {
    event_id: event.id,
    name: 'General',
    price: 50.00,
    total_inventory: 500, // Default capacity
    tier: 'General'
  };

  const { error: ticketError } = await supabase
    .from('ticket_types')
    .insert(ticketTypeData);

  if (ticketError) {
    console.error('Error inserting ticket type:', ticketError);
    // Try to cleanup event? No, manual fix might be needed.
    process.exit(1);
  }

  console.log('Ticket type added. Event creation complete.');
}

addEvent();

