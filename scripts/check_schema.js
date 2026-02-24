
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../maguey-gate-scanner/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Error: VITE_SUPABASE_URL environment variable is not set');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking vip_reservations schema...');

    // We can't query information_schema directly easily via supabase-js unless we have a wrapper or rpc.
    // However, we can TRY to select the column.

    const { data, error } = await supabase
        .from('vip_reservations')
        .select('id, checked_in_guests')
        .limit(1);

    if (error) {
        console.error('Error selecting column:', error);
    } else {
        console.log('Select success. Column exists.');
    }
}

checkSchema();
