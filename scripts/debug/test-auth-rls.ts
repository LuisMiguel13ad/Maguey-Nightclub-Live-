
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function testAuthRLS() {
    console.log('--- Testing Authenticated RLS ---');

    // 1. Sign In
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'demo@maguey.club',
        password: 'demo123',
    });

    if (authError) {
        console.error('Login Failed:', authError.message);
        return;
    }

    console.log('✅ Logged in as:', authData.user.email);
    console.log('User ID:', authData.user.id);

    const qrToken = '4bbf04e3-580c-4740-a061-0294e6dd2c33';
    const trimmedInput = qrToken;

    // 2. Run the Query
    console.log('Searching for ticket...');
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .or(`id.eq.${trimmedInput},ticket_id.eq.${trimmedInput},qr_code_data.eq.${trimmedInput},qr_token.eq.${trimmedInput}`)
        .maybeSingle();

    if (error) {
        console.error('❌ Query Error:', error);
    } else if (!data) {
        console.error('❌ Ticket NOT FOUND (RLS likely blocking)');
    } else {
        console.log('✅ Ticket FOUND:', data.id);
    }
}

testAuthRLS();
