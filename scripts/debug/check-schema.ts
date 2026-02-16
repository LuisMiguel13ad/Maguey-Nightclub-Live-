
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, 'maguey-pass-lounge/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://djbzjasdrwvbsoifxqzd.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking schema for vip_guest_passes...');

    // Try to select one row to see keys if I can't query information_schema directly easily with anon key
    // But RLS might block. simpler to just try to select * limit 1

    const { data, error } = await supabase
        .from('vip_guest_passes')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching vip_guest_passes:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found based on data:', Object.keys(data[0]));
    } else {
        console.log('No data found in vip_guest_passes, cannot infer columns easily.');
    }

    console.log('\nChecking schema for vip_linked_tickets...');
    const { data: linkData, error: linkError } = await supabase
        .from('vip_linked_tickets')
        .select('*')
        .limit(1);

    if (linkError) {
        console.error('Error fetching vip_linked_tickets:', linkError);
    } else if (linkData && linkData.length > 0) {
        console.log('Columns found based on data:', Object.keys(linkData[0]));
    } else {
        console.log('No data found in vip_linked_tickets.');
    }

}

checkSchema();
