import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
                    process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test user email (use the same one from your sample account)
const TEST_USER_EMAIL = 'demo@maguey.com'; // Demo account from purchase site

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function logResult(step: string, success: boolean, message: string, data?: any) {
  results.push({ step, success, message, data });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${step}: ${message}`);
  if (data && !success) {
    console.log('   Details:', JSON.stringify(data, null, 2));
  }
}

async function testCompleteFlow() {
  console.log('🧪 Testing Complete Event Flow\n');
  console.log('=' .repeat(60));
  console.log('STEP 1: Verify Event Exists\n');
  
  // Step 1: Check if event exists
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('name', 'PRE THANKSGIVING BASH')
    .eq('status', 'published')
    .single();

  if (eventsError || !events) {
    await logResult(
      'Event Check',
      false,
      'Event "PRE THANKSGIVING BASH" not found or not published',
      eventsError
    );
    console.log('\n⚠️  Please create the event first through the dashboard!');
    return;
  }

  await logResult(
    'Event Check',
    true,
    `Event found: ${events.name} (ID: ${events.id})`,
    {
      event_id: events.id,
      event_date: events.event_date,
      event_time: events.event_time,
      status: events.status,
    }
  );

  console.log('\n' + '='.repeat(60));
  console.log('STEP 2: Verify Ticket Types\n');

  // Step 2: Check ticket types
  const { data: ticketTypes, error: ttError } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('event_id', events.id);

  if (ttError || !ticketTypes || ticketTypes.length === 0) {
    await logResult('Ticket Types Check', false, 'No ticket types found for event', ttError);
    return;
  }

  await logResult(
    'Ticket Types Check',
    true,
    `Found ${ticketTypes.length} ticket types`,
    ticketTypes.map(tt => ({
      name: tt.name,
      price: tt.price,
      capacity: tt.total_inventory,
      available: tt.total_inventory - (tt.sold_count || 0),
    }))
  );

  console.log('\n' + '='.repeat(60));
  console.log('STEP 3: Check for Existing Orders\n');

  // Step 3: Check for existing orders from test user
  const { data: existingOrders, error: ordersError } = await supabase
    .from('orders')
    .select('*, tickets(*)')
    .eq('customer_email', TEST_USER_EMAIL)
    .eq('event_name', events.name)
    .order('created_at', { ascending: false });

  if (ordersError) {
    await logResult('Orders Check', false, 'Error checking orders', ordersError);
  } else {
    await logResult(
      'Orders Check',
      true,
      `Found ${existingOrders?.length || 0} existing orders from ${TEST_USER_EMAIL}`,
      existingOrders?.map(order => ({
        order_id: order.id,
        status: order.status,
        total_amount: order.total_amount,
        ticket_count: order.ticket_count,
        created_at: order.created_at,
      }))
    );
  }

  console.log('\n' + '='.repeat(60));
  console.log('STEP 4: Verify Tickets Exist\n');

  // Step 4: Check for tickets
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .eq('event_name', events.name)
    .eq('guest_email', TEST_USER_EMAIL)
    .order('created_at', { ascending: false });

  if (ticketsError) {
    await logResult('Tickets Check', false, 'Error checking tickets', ticketsError);
  } else {
    await logResult(
      'Tickets Check',
      true,
      `Found ${tickets?.length || 0} tickets for ${TEST_USER_EMAIL}`,
      tickets?.map(ticket => ({
        ticket_id: ticket.ticket_id,
        qr_token: ticket.qr_token ? 'Present' : 'Missing',
        status: ticket.status,
        scanned_at: ticket.scanned_at,
        created_at: ticket.created_at,
      }))
    );
  }

  console.log('\n' + '='.repeat(60));
  console.log('STEP 5: Test QR Code Scanning\n');

  // Step 5: Test QR code lookup
  if (tickets && tickets.length > 0) {
    const testTicket = tickets[0];
    if (testTicket.qr_token) {
      const { data: scannedTicket, error: scanError } = await supabase
        .from('tickets')
        .select('*, events(*), ticket_types(*)')
        .eq('qr_token', testTicket.qr_token)
        .single();

      if (scanError) {
        await logResult('QR Scan Test', false, 'Error scanning QR code', scanError);
      } else {
        await logResult(
          'QR Scan Test',
          true,
          `QR code lookup successful for ticket ${testTicket.ticket_id}`,
          {
            ticket_id: scannedTicket.ticket_id,
            event_name: scannedTicket.events?.name,
            ticket_type: scannedTicket.ticket_types?.name,
            status: scannedTicket.status,
            scanned_at: scannedTicket.scanned_at,
          }
        );
      }
    } else {
      await logResult('QR Scan Test', false, 'Ticket has no QR token');
    }
  } else {
    await logResult('QR Scan Test', false, 'No tickets found to test scanning');
  }

  console.log('\n' + '='.repeat(60));
  console.log('STEP 6: Check Dashboard Analytics\n');

  // Step 6: Check dashboard stats
  const { data: allTickets, error: allTicketsError } = await supabase
    .from('tickets')
    .select('price_paid, created_at, scanned_at, event_name')
    .eq('event_name', events.name);

  if (!allTicketsError && allTickets) {
    const totalRevenue = allTickets.reduce((sum, t) => sum + (parseFloat(t.price_paid?.toString() || '0') || 0), 0);
    const totalTickets = allTickets.length;
    const scannedTickets = allTickets.filter(t => t.scanned_at).length;
    const conversionRate = totalTickets > 0 ? (scannedTickets / totalTickets) * 100 : 0;

    await logResult(
      'Dashboard Stats',
      true,
      'Event statistics calculated',
      {
        total_revenue: `$${totalRevenue.toFixed(2)}`,
        total_tickets: totalTickets,
        scanned_tickets: scannedTickets,
        conversion_rate: `${conversionRate.toFixed(1)}%`,
      }
    );
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('⚠️  Failed Steps:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.step}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 MANUAL TESTING CHECKLIST\n');
  console.log('Please verify these steps manually:\n');
  console.log('1. ✅ Event appears on Main Website');
  console.log('2. ✅ Event appears on Purchase Website');
  console.log('3. ✅ Can purchase ticket on Purchase Website');
  console.log('4. ✅ Order appears in Dashboard → Recent Purchases');
  console.log('5. ✅ Ticket appears in Dashboard → Analytics');
  console.log('6. ✅ Can scan ticket manually (by ticket ID)');
  console.log('7. ✅ Can scan ticket with QR code');
  console.log('8. ✅ Scan appears in Dashboard → Activity Feed');
  console.log('9. ✅ Revenue updates in Dashboard → KPI Cards');
  console.log('10. ✅ Transaction visible in Dashboard → Analytics\n');

  console.log('📸 SCREENSHOT CHECKLIST\n');
  console.log('Take screenshots of:\n');
  console.log('1. Event on Main Website');
  console.log('2. Event on Purchase Website');
  console.log('3. Ticket purchase checkout page');
  console.log('4. Order confirmation/email');
  console.log('5. Ticket QR code');
  console.log('6. Scanner page before scan');
  console.log('7. Scanner page after successful scan');
  console.log('8. Dashboard → Recent Purchases showing order');
  console.log('9. Dashboard → Analytics showing revenue');
  console.log('10. Dashboard → Activity Feed showing scan\n');

  return results;
}

// Run the test
testCompleteFlow().catch(console.error);

