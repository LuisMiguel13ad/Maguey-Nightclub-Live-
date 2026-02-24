
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

async function setupPhase4Data() {
    console.log('Starting Phase 4 Test Data Setup...');
    let eventId = null;

    try {
        // 0. Verify Migration (RPC check)
        console.log('Verifying Migration...');
        const { error: rpcError } = await supabase.rpc('process_vip_scan_with_reentry', { p_pass_id: '00000000-0000-0000-0000-000000000000' });
        // We expect an error (UUID invalid or not found), but NOT "function not found"
        if (rpcError && rpcError.message.includes('function process_vip_scan_with_reentry() does not exist')) {
            throw new Error('MIGRATION MISSING: process_vip_scan_with_reentry RPC not found. Apply 20260201000000_phase4_vip_system_consolidated.sql');
        }
        console.log('✅ Migration appears to be applied (RPC found).');

        // 1. Setup Test Event
        const { data: event, error: eventError } = await supabase
            .from('events')
            .insert({
                name: 'Phase 4 Scanner Test Event',
                event_date: new Date().toISOString().split('T')[0],
                event_time: '20:00:00',
                status: 'published',
                vip_enabled: true
            })
            .select()
            .single();

        if (eventError) throw new Error(`Event creation failed: ${eventError.message}`);
        eventId = event.id;
        console.log(`Created test event: ${eventId}`);

        // 2. Setup Ticket Type
        const { data: ticketType, error: typeError } = await supabase
            .from('ticket_types')
            .insert({
                event_id: eventId,
                code: 'GA',
                name: 'General Admission',
                price: 25.00,
                total_inventory: 100
            })
            .select()
            .single();
        if (typeError) throw new Error(`Ticket Type creation failed: ${typeError.message}`);

        // 3. Create VIP Table
        // Find a template first
        const { data: template } = await supabase.from('vip_table_templates').select('id').limit(1).single();
        let templateId = template?.id;
        if (!templateId) {
            const { data: newTemplate } = await supabase.from('vip_table_templates').insert({ name: 'Phase 4 Template' }).select().single();
            templateId = newTemplate.id;
        }

        const { data: table, error: tableError } = await supabase
            .from('event_vip_tables')
            .insert({
                event_id: eventId,
                table_number: 101, // Test Table
                table_template_id: templateId,
                tier: 'premium',
                capacity: 10,
                price_cents: 100000,
                bottles_included: 2
            })
            .select()
            .single();
        if (tableError) throw new Error(`VIP Table creation failed: ${tableError.message}`);

        // --- SCENARIO 1: VIP Host Re-entry ---
        console.log('\n--- Setup Scenario 1: VIP Host Re-entry ---');
        const vip1Token = 'vip-host-' + Date.now();
        const { data: vipReservation1, error: resError } = await supabase
            .from('vip_reservations')
            .insert({
                event_id: eventId,
                event_vip_table_id: table.id,
                table_number: 101,
                purchaser_email: 'vip.host@test.com',
                purchaser_name: 'VIP Host User',
                status: 'checked_in', // Already checked in
                amount_paid_cents: 100000,
                qr_code_token: vip1Token,
                package_snapshot: { guestCount: 10 },
                disclaimer_accepted_at: new Date().toISOString(),
                refund_policy_accepted_at: new Date().toISOString(),
                checked_in_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                checked_in_guests: 1
            })
            .select()
            .single();

        if (resError) {
            console.error('VIP Reservation Insert Error:', resError);
            throw new Error(`VIP Reservation creation failed: ${resError.message}`);
        }

        // Use RPC to check-in the guest pass initially so re-entry works?
        // Actually, just create the guest pass as 'checked_in'
        const { data: vipPass } = await supabase
            .from('vip_guest_passes')
            .insert({
                vip_reservation_id: vipReservation1.id,
                reservation_id: vipReservation1.id,
                guest_name: 'VIP Host',
                status: 'checked_in',
                checked_in_at: new Date(Date.now() - 3600000).toISOString()
            })
            .select()
            .single();

        console.log(`[TEST 4/5] VIP Host Pass ID: ${vipPass.id}`);
        console.log(`[TEST 4/5] Note: VIP Scanner usually scans QR codes that map to Pass IDs or Reservation Tokens.`);
        // Important: The UI might expect a QR content. If the QR content is the Pass ID, we use that.
        // If it's the token, we use token. 
        // For 'Guest Pass', usually it's a UUID? Or a signed token? 
        // Let's assume for this test we might need the Pass ID if we are simulating the scan result, 
        // or a formatted string if scanning via camera simulation.
        console.log(`[TEST 4/5] VIP Reservation Token: ${vip1Token}`);


        // --- SCENARIO 2: VIP-Linked GA Ticket Re-entry ---
        console.log('\n--- Setup Scenario 2: VIP-Linked GA Ticket ---');
        const mkOrder = async (email) => {
            const { data: o } = await supabase.from('orders').insert({
                event_id: eventId,
                purchaser_name: 'Test Purchase',
                purchaser_email: email,
                subtotal: 25, total: 25, status: 'paid'
            }).select().single();
            return o;
        };
        const order2 = await mkOrder('vip.linked@test.com');

        const linkedToken = 'linked-ga-' + Date.now();
        const { data: linkedTicket } = await supabase
            .from('tickets')
            .insert({
                event_id: eventId,
                order_id: order2.id,
                ticket_type_id: ticketType.id,
                ticket_type: 'GA',
                attendee_email: 'vip.linked@test.com',
                attendee_name: 'Linked Guest',
                status: 'issued', // Not scanned yet
                price: 25.00,
                qr_token: linkedToken,
                ticket_id: 'LINKED-' + Date.now()
            })
            .select()
            .single();

        await supabase.from('vip_linked_tickets').insert({
            ticket_id: linkedTicket.id,
            vip_reservation_id: vipReservation1.id,
            order_id: order2.id,
            purchased_by_email: 'vip.linked@test.com'
        });
        console.log(`[TEST 6] Linked Ticket Token: ${linkedToken}`);
        console.log(`[TEST 6] Ticket ID: ${linkedTicket.id}`);


        // --- SCENARIO 3: Regular GA Ticket Rejection ---
        console.log('\n--- Setup Scenario 3: Regular GA Ticket ---');
        const order3 = await mkOrder('regular@test.com');
        const regToken = 'reg-ga-' + Date.now();
        const { data: regTicket } = await supabase
            .from('tickets')
            .insert({
                event_id: eventId,
                order_id: order3.id,
                ticket_type_id: ticketType.id,
                ticket_type: 'GA',
                attendee_email: 'regular@test.com',
                attendee_name: 'Regular Guest',
                status: 'issued',
                price: 25.00,
                qr_token: regToken,
                ticket_id: 'REG-' + Date.now()
            })
            .select()
            .single();
        console.log(`[TEST 7] Regular Ticket Token: ${regToken}`);
        console.log(`[TEST 7] Ticket ID: ${regTicket.id}`);

        console.log('\n✅ SETUP COMPLETE. Save the tokens above.');

        // Verification of Status Protection (Test 8)
        console.log('\n--- Verifying Test 8 Logic (SQL Status Protection) ---');
        console.log(`Attempting to update Reservation ${vipReservation1.id} from checked_in back to confirmed...`);

        const { error: updateError } = await supabase
            .from('vip_reservations')
            .update({ status: 'confirmed' })
            .eq('id', vipReservation1.id);

        if (updateError) {
            console.log(`✅ Test 8 PASSED: Update failed as expected: ${updateError.message}`);
        } else {
            // Double check if it actually changed, sometimes Supabase/PostgREST doesn't throw if no rows updated, 
            // but here the trigger RAISE EXCEPTION should cause an error.
            // If no error, check the status
            const { data: check } = await supabase.from('vip_reservations').select('status').eq('id', vipReservation1.id).single();
            if (check.status === 'checked_in') {
                console.log(`✅ Test 8 PASSED: Status remained 'checked_in' (Trigger silently blocked or error swallowed?)`);
            } else {
                console.log(`❌ Test 8 FAILED: Status changed to ${check.status}`);
            }
        }

    } catch (err) {
        console.error('SETUP FAILED:', err.message);
    }
}

setupPhase4Data();
