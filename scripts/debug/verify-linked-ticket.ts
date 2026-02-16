
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

async function verifyLinkedTicket() {
    console.log('Verifying linked tickets for reservation: 4eaf782a-1efd-4a15-9e2a-1c9d052bd23a');

    const { data, error } = await supabase
        .from('vip_linked_tickets')
        .select('*')
        .eq('vip_reservation_id', '4eaf782a-1efd-4a15-9e2a-1c9d052bd23a');

    if (error) {
        console.error('Error fetching linked tickets:', error);
        return;
    }

    console.log('Linked Tickets Found:', data.length);
    console.log(JSON.stringify(data, null, 2));

    if (data.length > 0) {
        const ticket = data[0];
        if (ticket.order_id === '85f8ab88-ef5f-48ec-92bf-be148480ea33') {
            console.log('SUCCESS: Ticket linked to correct order ID.');
        } else {
            console.log('WARNING: Ticket found but order ID mismatch or check needed.');
        }

        if (ticket.purchased_by_name === 'Invite Guest') {
            console.log('SUCCESS: Ticket purchased by correct guest.');
        }
    } else {
        console.log('FAILURE: No linked tickets found.');
    }
}

verifyLinkedTicket();
