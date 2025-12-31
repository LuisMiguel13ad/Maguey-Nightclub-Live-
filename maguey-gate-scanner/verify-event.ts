import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://djbzjasdrwvbsoifxqzd.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDA5ODAsImV4cCI6MjA3ODM3Njk4MH0.q5nWNWKpAkTmIWf_hbxINpyzUENySwjulQw1h3c5Xws';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function verifyEvent() {
  console.log('🔍 Verifying event exists...\n');
  
  const { data: events, error } = await supabase
    .from('events')
    .select('id, name, event_date, event_time, status, is_active, image_url')
    .eq('name', 'La Maquinaria Norteña, La Energía Norteña y Mister Cumbia')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!events || events.length === 0) {
    console.log('❌ Event not found');
    return;
  }

  const event = events[0];
  console.log('✅ Event found!');
  console.log('   ID:', event.id);
  console.log('   Name:', event.name);
  console.log('   Date:', event.event_date);
  console.log('   Time:', event.event_time);
  console.log('   Status:', event.status);
  console.log('   Is Active:', event.is_active);
  console.log('   Image URL:', event.image_url);
  console.log('');

  // Check ticket types
  const { data: ticketTypes, error: ttError } = await supabase
    .from('ticket_types')
    .select('id, name, price, total_inventory')
    .eq('event_id', event.id);

  if (ttError) {
    console.error('❌ Error fetching ticket types:', ttError);
    return;
  }

  console.log('🎫 Ticket Types:');
  ticketTypes?.forEach(tt => {
    console.log(`   - ${tt.name}: $${tt.price} (${tt.total_inventory} available)`);
  });
}

verifyEvent();

