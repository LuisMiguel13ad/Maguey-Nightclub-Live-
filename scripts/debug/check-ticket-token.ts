
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

async function checkTicketToken() {
    const ticketId = 'dd58f7a7-8e08-451c-b4c2-bbe4446659a8';
    console.log(`Checking token for ticket: ${ticketId}`);

    const { data, error } = await supabase
        .from('tickets')
        .select('id, qr_token, status')
        .eq('id', ticketId);

    if (error) {
        console.error('Error fetching ticket:', error);
        return;
    }

    console.log('Ticket Data:', JSON.stringify(data, null, 2));
}

checkTicketToken();
