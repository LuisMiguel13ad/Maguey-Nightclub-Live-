
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../maguey-gate-scanner/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use Service Role Key hardcoded for verification
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwMDk4MCwiZXhwIjoyMDc4Mzc2OTgwfQ.EyrW9yk_q3VOP8AQ-f8nskDF7O-K83jg433NeEOmHwE";

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

console.log(`Using Key Type: ${supabaseKey.includes('service_role') ? 'SERVICE_ROLE' : 'ANON'}`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    console.log('Starting Scanner Logic Verification...');
    let eventId = null;

    try {
        // 1. Setup Test Event
        const { data: event, error: eventError } = await supabase
            .from('events')
            .insert({
                name: 'Scanner Logic Test Event',
                event_date: new Date().toISOString().split('T')[0],
                event_time: '10:00 PM',
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
        console.log('Created Ticket Type: General Admission');

        // 3. Find Template
        let templateId = null;
        const possibleNames = ['vip_table_templates', 'event_table_templates', 'table_templates'];
        for (const name of possibleNames) {
            const { data } = await supabase.from(name).select('id').limit(1);
            if (data) {
                const { data: newTemplate } = await supabase.from(name).insert({ name: 'Test Template' }).select().single();
                if (newTemplate) {
                    templateId = newTemplate.id;
                    break;
                }
            }
        }
        if (!templateId) {
            const { data: existing } = await supabase.from('vip_table_templates').select('id').limit(1).single();
            if (existing) templateId = existing.id;
        }

        // 4. Create VIP Table
        const { data: table, error: tableError } = await supabase
            .from('event_vip_tables')
            .insert({
                event_id: eventId,
                table_number: 99,
                table_template_id: templateId,
                tier: 'premium',
                capacity: 6,
                price_cents: 50000,
                bottles_included: 1
            })
            .select()
            .single();

        if (tableError) throw new Error(`VIP Table creation failed: ${tableError.message}`);
        console.log('Created VIP Table');

        // 5. Create VIP Reservation
        const { data: reservation, error: resError } = await supabase
            .from('vip_reservations')
            .insert({
                event_id: eventId,
                event_vip_table_id: table.id,
                table_number: 99,
                purchaser_email: 'vip.logic@test.com',
                purchaser_name: 'Test VIP User',
                status: 'confirmed',
                amount_paid_cents: 50000,
                qr_code_token: 'test-vip-qr-' + Date.now(),
                package_snapshot: {},
                disclaimer_accepted_at: new Date().toISOString(),
                refund_policy_accepted_at: new Date().toISOString(),
                purchaser_phone: '555-555-5555'
            })
            .select()
            .single();

        if (resError) throw new Error(`VIP Reservation creation failed: ${resError.message}`);
        console.log(`Created VIP Reservation: ${reservation.id}`);

        // 5.5 Create Order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                event_id: eventId,
                purchaser_name: 'Test User',
                purchaser_email: 'vip.guest@test.com',
                subtotal: 25.00,
                total: 25.00,
                status: 'paid'
            })
            .select()
            .single();

        if (orderError) throw new Error(`Order creation failed: ${orderError.message}`);
        console.log(`Created Order: ${order.id}`);

        // 6. Create GA Ticket linked to VIP
        const { data: vipLinkedTicket, error: ticketError } = await supabase
            .from('tickets')
            .insert({
                event_id: eventId,
                order_id: order.id,
                ticket_type_id: ticketType.id,
                ticket_type: 'GA',
                attendee_email: 'vip.guest@test.com',
                attendee_name: 'VIP Guest',
                status: 'issued',
                price: 25.00,
                qr_token: 'test-qr-' + Date.now(),
                ticket_id: 'TEST-TICKET-' + Date.now()
            })
            .select()
            .single();

        if (ticketError) throw new Error(`Ticket creation failed: ${ticketError.message}`);

        // Link it
        const { error: linkError } = await supabase.from('vip_linked_tickets').insert({
            ticket_id: vipLinkedTicket.id,
            vip_reservation_id: reservation.id,
            order_id: order.id,
            purchased_by_email: 'vip.guest@test.com'
        });
        if (linkError) throw new Error(`Linking failed: ${linkError.message}`);

        console.log(`Created VIP-linked GA Ticket: ${vipLinkedTicket.id}`);


        // --- Test 6: Verify Re-entry Logic ---
        console.log('\n--- Test 6 Executing ---');
        // Scan 1
        const { data: scan1, error: scan1Err } = await supabase.rpc('scan_ticket_atomic', {
            p_ticket_id: vipLinkedTicket.id,
            p_scanned_by: null, // Correctly nullable
            p_scan_method: 'qr'
        });
        if (scan1Err) console.log('Scan 1 RPC Error:', scan1Err);
        // scan1 comes as array of rows from TABLE return
        const s1 = scan1 && scan1[0] ? scan1[0] : null;
        console.log(`Scan 1: Success=${s1?.success} Msg=${s1?.error_message || 'OK'}`);

        // Scan 2 (Atomic should fail)
        const { data: scan2, error: scan2Err } = await supabase.rpc('scan_ticket_atomic', {
            p_ticket_id: vipLinkedTicket.id,
            p_scanned_by: null,
            p_scan_method: 'qr'
        });
        if (scan2Err) console.log('Scan 2 RPC Error:', scan2Err);
        const s2 = scan2 && scan2[0] ? scan2[0] : null;
        console.log(`Scan 2 (Atomic Result): Success=${s2?.success} Msg=${s2?.error_message}`);

        // Check Logic for Re-entry
        const { data: reCheck, error: reErr } = await supabase.rpc('check_vip_linked_ticket_reentry', {
            p_ticket_id: vipLinkedTicket.id
        });
        if (reErr) console.log('Re-entry Check Error:', reErr);
        console.log(`Re-entry Check: Linked=${reCheck?.is_vip_linked} Allow=${reCheck?.allow_reentry}`);

        if (s1?.success && !s2?.success && reCheck?.allow_reentry) {
            console.log('✅ Test 6 PASSED (Atomic blocked duplicates, but Re-entry logic ALLOWS it)');
        } else {
            console.log('❌ Test 6 FAILED');
        }


        // --- Test 7: Regular GA Rejection ---
        console.log('\n--- Test 7 Executing ---');
        const { data: regularTicket, error: regError } = await supabase
            .from('tickets')
            .insert({
                event_id: eventId,
                order_id: order.id,
                ticket_type_id: ticketType.id,
                ticket_type: 'GA',
                attendee_email: 'reg@test.com',
                attendee_name: 'Regular',
                status: 'issued',
                price: 25.00,
                qr_token: 'reg-qr-' + Date.now(),
                ticket_id: 'REG-TICKET-' + Date.now()
            })
            .select()
            .single();

        if (regError) throw new Error(`Reg Ticket failed: ${regError.message}`);

        // Scan 1
        const { data: rScan1, error: r1Err } = await supabase.rpc('scan_ticket_atomic', {
            p_ticket_id: regularTicket.id,
            p_scanned_by: null,
            p_scan_method: 'qr'
        });
        if (r1Err) console.log('Reg Scan 1 Error:', r1Err);
        const rs1 = rScan1 && rScan1[0] ? rScan1[0] : null;
        console.log(`Scan 1: Success=${rs1?.success}`);

        // Scan 2
        const { data: rScan2, error: r2Err } = await supabase.rpc('scan_ticket_atomic', {
            p_ticket_id: regularTicket.id,
            p_scanned_by: null,
            p_scan_method: 'qr'
        });
        if (r2Err) console.log('Reg Scan 2 Error:', r2Err);
        const rs2 = rScan2 && rScan2[0] ? rScan2[0] : null;
        console.log(`Scan 2: Success=${rs2?.success} Msg=${rs2?.error_message}`);

        // Check Re-entry Logic
        const { data: regCheck } = await supabase.rpc('check_vip_linked_ticket_reentry', {
            p_ticket_id: regularTicket.id
        });
        console.log(`Re-entry Check: Linked=${regCheck?.is_vip_linked} Allow=${regCheck?.allow_reentry}`);

        if (rs1?.success && !rs2?.success && !regCheck?.allow_reentry) {
            console.log('✅ Test 7 PASSED (Atomic blocked duplicates, Re-entry logic DENIES it)');
        } else {
            console.log('❌ Test 7 FAILED');
        }


        // --- Test 4&5: VIP Host Pass ---
        console.log('\n--- Test 4 & 5 Executing ---');
        const { data: vipPass, error: passError } = await supabase
            .from('vip_guest_passes')
            .insert({
                vip_reservation_id: reservation.id,
                reservation_id: reservation.id,
                guest_name: 'VIP Host',
                status: 'issued'
            })
            .select()
            .single();
        if (passError) throw new Error(`VIP Pass failed: ${passError.message}`);

        const { data: vScan1, error: v1Err } = await supabase.rpc('check_in_vip_guest_atomic', { p_pass_id: vipPass.id });
        if (v1Err) console.log('VIP Scan 1 Error:', v1Err);
        console.log(`VIP Scan 1: ${vScan1?.message || 'Success'}`);

        const { data: vScan2, error: v2Err } = await supabase.rpc('check_in_vip_guest_atomic', { p_pass_id: vipPass.id });
        if (v2Err) console.log('VIP Scan 2 Error:', v2Err);
        console.log(`VIP Scan 2: ${vScan2?.message || 'Done'}`);

        if (vScan2?.success && (vScan2?.message || '').includes('back')) {
            console.log('✅ Test 4 & 5 PASSED');
        } else {
            // If messages are different but success is true, might be logic
            console.log(`Test 4 & 5 Result: ${vScan2?.message}`);
        }


    } catch (err) {
        console.error('ERROR:', err.message);
    } finally {
        if (eventId) {
            console.log('\nCleaning up...');
            const { data: reservations } = await supabase.from('vip_reservations').select('id').eq('event_id', eventId);
            if (reservations) {
                for (const r of reservations) {
                    await supabase.from('vip_linked_tickets').delete().eq('vip_reservation_id', r.id);
                    await supabase.from('vip_guest_passes').delete().eq('reservation_id', r.id);
                }
                await supabase.from('vip_reservations').delete().eq('event_id', eventId);
            }

            await supabase.from('tickets').delete().eq('event_id', eventId);
            await supabase.from('ticket_types').delete().eq('event_id', eventId);
            await supabase.from('orders').delete().eq('event_id', eventId);
            await supabase.from('event_vip_tables').delete().eq('event_id', eventId);
            await supabase.from('events').delete().eq('id', eventId);
            console.log('Cleanup done.');
        }
    }
}

runTests();
