
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './lib/supabase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });

async function repro() {
    console.log('--- Testing Minimal Scan ---');
    console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
    console.log('VITE_SUPABASE_ANON_KEY (first 10 chars):', process.env.VITE_SUPABASE_ANON_KEY?.substring(0, 10));

    const qrToken = '4bbf04e3-580c-4740-a061-0294e6dd2c33';
    console.log('Searching for QR:', qrToken);

    const { data: ticket, error } = await supabase
        .from('tickets')
        .select(`
            id, 
            qr_token, 
            status, 
            events(name), 
            ticket_types(name)
        `)
        .eq('qr_token', qrToken)
        .maybeSingle();

    if (error) {
        console.error('Error:', error);
    } else if (!ticket) {
        console.error('Ticket NOT FOUND in DB');
    } else {
        console.log('Ticket FOUND:', ticket);
    }
}

repro();
