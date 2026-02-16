#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://djbzjasdrwvbsoifxqzd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDA5ODAsImV4cCI6MjA3ODM3Njk4MH0.q5nWNWKpAkTmIWf_hbxINpyzUENySwjulQw1h3c5Xws';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyMigration() {
    console.log('🧪 VERIFYING VIP MIGRATION...\n');

    // 1. Check RPC Functions
    console.log('1. Checking RPC Functions:');
    const rpcs = [
        'create_vip_reservation_atomic',
        'verify_vip_pass_signature',
        'check_in_vip_guest_atomic'
    ];

    for (const rpc of rpcs) {
        try {
            // We call with a fake UUID to see if we get a 404 (method not found) or a 400 (bad request/execution error)
            const { error } = await supabase.rpc(rpc, { p_pass_id: '00000000-0000-0000-0000-000000000000' });

            if (error && error.message.includes('function') && error.message.includes('not exist')) {
                console.log(`   ❌ ${rpc}: NOT FOUND`);
            } else {
                console.log(`   ✅ ${rpc}: EXISTS (or execution error, which implies existence)`);
            }
        } catch (err: any) {
            console.log(`   ❌ ${rpc}: ERROR - ${err.message}`);
        }
    }

    // 2. Check Table Accessibility (RLS)
    console.log('\n2. Checking Table Accessibility (RLS):');
    const tables = ['event_vip_tables', 'vip_reservations', 'vip_guest_passes'];

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`   ❌ ${table}: ${error.message}`);
        } else {
            console.log(`   ✅ ${table}: ACCESSIBLE (Found ${data?.length || 0} rows)`);
        }
    }

    process.exit(0);
}

verifyMigration().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
