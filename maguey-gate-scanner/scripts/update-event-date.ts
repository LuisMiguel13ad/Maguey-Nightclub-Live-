import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const EVENT_NAME = 'PRE THANKSGIVING BASH';
const NEW_DATE = '2025-12-27';
const NEW_TIME = '21:00';

async function updateEventDate() {
  console.log(`\n🛠️  Updating event date for "${EVENT_NAME}"...\n`);

  const { data, error } = await supabase
    .from('events')
    .update({
      event_date: NEW_DATE,
      event_time: NEW_TIME,
      status: 'published',
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .eq('name', EVENT_NAME)
    .select('id, event_date, event_time')
    .single();

  if (error) {
    console.error('❌ Failed to update event:', error.message);
    process.exit(1);
  }

  console.log('✅ Event updated:', data);
}

updateEventDate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  });

