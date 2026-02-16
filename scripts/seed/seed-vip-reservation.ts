
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
config({ path: resolve(__dirname, 'maguey-gate-scanner/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedReservation() {
    console.log('🌱 Seeding Test Reservation...');

    // 1. Get Event
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name')
        .ilike('name', '%Sexy Pijama PERREO%')
        .single();

    if (eventError || !event) {
        console.error('❌ Event not found:', eventError);
        return;
    }
    console.log(`✅ Found Event: ${event.name} (${event.id})`);

    // 2. Get Available Table
    const { data: table, error: tableError } = await supabase
        .from('event_vip_tables')
        .select('*')
        .eq('event_id', event.id)
        .eq('is_available', true)
        .limit(1)
        .single();

    if (tableError || !table) {
        console.error('❌ No available tables found:', tableError);
        return;
    }

    const price = table.price || (table.price_cents ? table.price_cents / 100 : 0);
    console.log(`✅ Found Table: #${table.table_number} ($${price})`);

    // DEBUG: Check reservation schema
    const { data: existingRes } = await supabase.from('vip_reservations').select('*').limit(1);
    if (existingRes && existingRes.length > 0) {
        console.log('📋 Existing Reservation Keys:', Object.keys(existingRes[0]));
    }

    // 3. Create Confirmed Reservation with Invite Code
    const inviteCode = 'TEST' + Math.floor(Math.random() * 10000);
    const qrToken = 'VIP-' + Math.random().toString(36).substring(2, 12).toUpperCase();

    const packageSnapshot = {
        tier: 'premium', // assuming
        tableNumber: table.table_number,
        guestCount: 6,
        price: price,
        displayName: `Table ${table.table_number}`,
        firstName: 'Test',
        lastName: 'Setup',
    };

    const reservationData = {
        event_id: event.id,
        event_vip_table_id: table.id,
        table_number: table.table_number, // ADDED: Required field
        purchaser_name: 'Test Setup User',
        purchaser_email: 'test_setup@example.com',
        purchaser_phone: '555-000-0000',
        status: 'confirmed',
        invite_code: inviteCode,
        amount_paid_cents: price * 100, // assuming price is in dollars
        qr_code_token: qrToken,
        package_snapshot: packageSnapshot,
        disclaimer_accepted_at: new Date().toISOString(),
        refund_policy_accepted_at: new Date().toISOString(),
    };

    const { data: reservation, error: resError } = await supabase
        .from('vip_reservations')
        .insert(reservationData)
        .select()
        .single();

    if (resError) {
        console.error('❌ Failed to create reservation:', resError);
        return;
    }

    console.log(`✅ Reservation Created: ${reservation.id}`);
    console.log(`🔑 Invite Code: ${reservation.invite_code}`);

    const link = `http://localhost:3016/checkout?event=${event.id}&vip=${reservation.invite_code}`;
    console.log(`🔗 Invite Link: ${link}`);

    // Mark table as unavailable
    await supabase
        .from('event_vip_tables')
        .update({ is_available: false })
        .eq('id', table.id);

    console.log('✅ Table marked as unavailable');
}

seedReservation().catch(console.error);
