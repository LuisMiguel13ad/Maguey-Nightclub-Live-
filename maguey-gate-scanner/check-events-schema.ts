import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

async function checkSchema() {
  // Get one event to see the schema
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Events table columns:');
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
    console.log('\nSample event:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('No events found');
  }
}

checkSchema();
