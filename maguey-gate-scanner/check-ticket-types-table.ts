import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

async function checkTicketTypesTable() {
  console.log('Checking for ticket_types table...\n');
  
  const { data, error } = await supabase
    .from('ticket_types')
    .select('*')
    .limit(5);
  
  if (error) {
    console.log('❌ ticket_types table not found or not accessible');
    console.log('Error:', error.message);
    console.log('\n💡 Solution: The events table needs to be updated with the ticket_types JSONB field');
  } else {
    console.log('✅ ticket_types table exists!');
    console.log(`Found ${data.length} ticket types`);
    if (data.length > 0) {
      console.log('\nSample ticket type:');
      console.log(JSON.stringify(data[0], null, 2));
    }
  }
}

checkTicketTypesTable();
