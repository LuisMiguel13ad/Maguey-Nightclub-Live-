import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://djbzjasdrwvbsoifxqzd.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwMDk4MCwiZXhwIjoyMDc4Mzc2OTgwfQ.EyrW9yk_q3VOP8AQ-f8nskDF7O-K83jg433NeEOmHwE';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate Mister Kumbia events...\n');

  const { data: events, error } = await supabase
    .from('events')
    .select('id, name, event_date, created_at')
    .ilike('name', '%Mister Kumbia%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching events:', error);
    return;
  }

  if (!events || events.length === 0) {
    console.log('No Mister Kumbia events found.');
    return;
  }

  console.log(`Found ${events.length} event(s):\n`);
  events.forEach((event, index) => {
    console.log(`${index + 1}. ID: ${event.id}`);
    console.log(`   Name: ${event.name}`);
    console.log(`   Date: ${event.event_date}`);
    console.log(`   Created: ${event.created_at}\n`);
  });

  if (events.length > 1) {
    console.log('⚠️  Duplicate events detected!');
    console.log('Keeping the most recent event and removing older duplicates...\n');
    
    // Keep the first one (most recent), delete the rest
    const toDelete = events.slice(1);
    
    for (const event of toDelete) {
      console.log(`🗑️  Deleting duplicate event: ${event.id}`);
      
      // First delete ticket types
      const { error: ticketError } = await supabase
        .from('ticket_types')
        .delete()
        .eq('event_id', event.id);
      
      if (ticketError) {
        console.error(`   ⚠️  Error deleting ticket types: ${ticketError.message}`);
      }
      
      // Then delete the event
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);
      
      if (deleteError) {
        console.error(`   ❌ Error deleting event: ${deleteError.message}`);
      } else {
        console.log(`   ✅ Deleted event: ${event.id}`);
      }
    }
    
    console.log('\n✅ Duplicate cleanup complete!');
  } else {
    console.log('✅ No duplicates found.');
  }
}

checkDuplicates().catch(console.error);

