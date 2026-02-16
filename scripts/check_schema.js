
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../maguey-gate-scanner/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwMDk4MCwiZXhwIjoyMDc4Mzc2OTgwfQ.EyrW9yk_q3VOP8AQ-f8nskDF7O-K83jg433NeEOmHwE";

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
