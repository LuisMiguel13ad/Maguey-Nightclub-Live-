
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, 'maguey-pass-lounge/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://djbzjasdrwvbsoifxqzd.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role to check routines usually, or at least helpful

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFunction() {
    console.log('Checking for function check_in_vip_guest_atomic...');

    // Try to call it with dummy data to see if it errors with "not found" or "permission denied" or "invalid input"
    const { data, error } = await supabase.rpc('check_in_vip_guest_atomic', {
        p_pass_id: '00000000-0000-0000-0000-000000000000',
        p_checked_in_by: 'system'
    });

    if (error) {
        console.error('RPC Call Result:', error);
    } else {
        console.log('RPC Call Success (unexpected for dummy ID):', data);
    }
}

checkFunction();
