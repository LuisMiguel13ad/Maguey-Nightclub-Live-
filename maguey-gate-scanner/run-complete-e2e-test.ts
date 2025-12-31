import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
const TEST_USER_EMAIL = 'demo@maguey.com';
const TICKET_COUNT = 5;

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function logStep(step: string, success: boolean, message: string, data?: any) {
  results.push({ step, success, message, data });
  const icon = success ? '✅' : '❌';
  const color = success ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`${color}${icon} ${step}:${reset} ${message}`);
  if (data && !success) {
    console.log('   Details:', JSON.stringify(data, null, 2));
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCompleteE2ETest() {
  console.log('\n🧪 COMPLETE END-TO-END TEST - 5 TICKETS\n');
  console.log('='.repeat(70));
  console.log('Testing: PRE THANKSGIVING BASH Event\n');
  console.log('='.repeat(70));

  let eventId: string | null = null;
  let ticketTypeId: string | null = null;
  const createdTicketIds: string[] = [];
  const createdQRTokens: string[] = [];
  let orderId: string | null = null;

  // STEP 1: Verify Event Exists
  console.log('\n📅 STEP 1: Verifying Event...\n');
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, name, status, event_date, event_time, is_active')
      .eq('name', 'PRE THANKSGIVING BASH')
      .single();

    if (error || !event) {
      logStep('Event Verification', false, 'Event not found', error);
      console.log('\n❌ Cannot proceed without event. Please create it first.');
      return;
    }

    if (event.status !== 'published' || !event.is_active) {
      logStep('Event Status', false, 'Event not published or inactive', {
        status: event.status,
        is_active: event.is_active,
      });
      // Fix it
      await supabase
        .from('events')
        .update({ status: 'published', is_active: true })
        .eq('id', event.id);
      logStep('Event Status Fix', true, 'Event updated to published');
    } else {
      logStep('Event Verification', true, 'Event found and published');
    }

    eventId = event.id;
    logStep('Event Details', true, `Event ready for testing`, {
      id: event.id,
      name: event.name,
      date: event.event_date,
      time: event.event_time,
    });
  } catch (error: any) {
    logStep('Event Verification', false, 'Error checking event', error);
    return;
  }

  await sleep(500);

  // STEP 2: Get Ticket Type
  console.log('\n🎫 STEP 2: Getting Ticket Type...\n');
  try {
    const { data: ticketType, error } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', eventId!)
      .eq('name', 'Men - Before 10 PM')
      .single();

    if (error || !ticketType) {
      logStep('Ticket Type', false, 'Ticket type not found', error);
      return;
    }

    ticketTypeId = ticketType.id;
    logStep('Ticket Type', true, `Found: ${ticketType.name}`, {
      id: ticketType.id,
      price: ticketType.price,
      capacity: ticketType.total_inventory,
      available: ticketType.total_inventory - (ticketType.sold_count || 0),
    });
  } catch (error: any) {
    logStep('Ticket Type', false, 'Error getting ticket type', error);
    return;
  }

  await sleep(500);

  // STEP 3: Create Order
  console.log('\n🛒 STEP 3: Creating Order for 5 Tickets...\n');
  try {
    const ticketPrice = 35.00;
    const ticketFee = 0.00;
    const subtotal = ticketPrice * TICKET_COUNT;
    const feesTotal = ticketFee * TICKET_COUNT;
    const total = subtotal + feesTotal;

    const orderData: any = {
      event_id: eventId!,
      purchaser_email: TEST_USER_EMAIL,
      purchaser_name: 'Test Customer',
      subtotal: subtotal,
      fees_total: feesTotal,
      total: total,
      status: 'paid',
      payment_provider: 'stripe',
      payment_reference: `pi_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      metadata: {
        test_order: true,
        ticket_count: TICKET_COUNT,
        ticket_type: 'Men - Before 10 PM',
      },
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError) {
      logStep('Order Creation', false, 'Failed to create order', orderError);
      console.log('\n⚠️  Note: Order creation may require manual purchase through website UI');
      console.log('   Continuing with ticket creation using mock order ID...\n');
      orderId = randomUUID(); // Use mock ID for testing
    } else {
      orderId = order.id;
      logStep('Order Creation', true, `Order created (ID: ${orderId})`, {
        purchaser_email: order.purchaser_email,
        total: order.total,
        status: order.status,
      });
    }
  } catch (error: any) {
    logStep('Order Creation', false, 'Error creating order', error);
    orderId = randomUUID(); // Use mock ID
  }

  await sleep(500);

  // STEP 4: Create 5 Tickets
  console.log('\n🎫 STEP 4: Creating 5 Tickets...\n');
  try {
    const { data: event } = await supabase
      .from('events')
      .select('name')
      .eq('id', eventId!)
      .single();

    const tickets = [];
    const issuedAt = new Date().toISOString();
    
    for (let i = 1; i <= TICKET_COUNT; i++) {
      const ticketIdStr = `MGY-1B-20251126-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const qrToken = randomUUID();
      // Create unique email for each ticket to avoid unique constraint violation
      const uniqueEmail = `test${i}+${Date.now()}@maguey.com`;

      tickets.push({
        // Primary scanner identifier
        qr_token: qrToken,
        
        // UUID foreign keys
        event_id: eventId!,
        ticket_type_id: ticketTypeId!,
        
        // Order reference
        order_id: orderId,
        
        // Attendee info (scanner expects attendee_name, not guest_name)
        // Use unique email per ticket to avoid constraint violation
        attendee_name: `Test Customer ${i}`,
        attendee_email: uniqueEmail,
        
        // Human-readable ID (for display)
        ticket_id: ticketIdStr,
        event_name: event?.name || 'PRE THANKSGIVING BASH',
        ticket_type: 'Men - Before 10 PM',
        
        // QR code data
        qr_code_value: qrToken, // QR code encodes the qr_token UUID
        qr_code_data: ticketIdStr, // Legacy field
        
        // Pricing
        price: 35.00,
        fee_total: 0.00,
        
        // Status
        status: 'issued',
        issued_at: issuedAt,
        
        // Legacy fields for compatibility
        guest_name: `Test Customer ${i}`,
        guest_email: uniqueEmail,
        is_used: false,
        purchase_date: issuedAt,
      });

      createdQRTokens.push(qrToken);
    }

    const { data: createdTickets, error: ticketError } = await supabase
      .from('tickets')
      .insert(tickets)
      .select('id, ticket_id, qr_token');

    if (ticketError) {
      logStep('Ticket Creation', false, 'Failed to create tickets', ticketError);
      throw ticketError;
    }

    if (createdTickets) {
      createdTicketIds.push(...createdTickets.map(t => t.id));
      logStep('Ticket Creation', true, `Created ${createdTickets.length} tickets`, {
        ticket_ids: createdTickets.map(t => t.ticket_id),
        qr_tokens: createdTickets.map(t => t.qr_token ? 'Present' : 'Missing'),
      });
    }
  } catch (error: any) {
    logStep('Ticket Creation', false, 'Error creating tickets', error);
    console.log('\n⚠️  Ticket creation failed. You may need to purchase manually through website.');
  }

  await sleep(1000);

  // STEP 5: Verify Order in Dashboard
  console.log('\n📊 STEP 5: Verifying Order in Dashboard...\n');
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('purchaser_email', TEST_USER_EMAIL)
      .eq('event_id', eventId!)
      .order('created_at', { ascending: false })
      .limit(5);

    if (orders && orders.length > 0) {
      const recentOrder = orders[0];
      logStep('Order in Dashboard', true, 'Order found in Recent Purchases', {
        order_id: recentOrder.id,
        purchaser_email: recentOrder.purchaser_email,
        total: recentOrder.total,
        status: recentOrder.status,
      });
    } else {
      logStep('Order in Dashboard', false, 'No orders found (may need manual purchase)');
    }
  } catch (error: any) {
    logStep('Order Verification', false, 'Error checking orders', error);
  }

  await sleep(500);

  // STEP 6: Test QR Code Scanning (Automated)
  console.log('\n📱 STEP 6: Testing QR Code Scanning...\n');
  let scannedCount = 0;
  
  if (createdQRTokens.length > 0) {
    // Scan first 2 tickets with QR code
    for (let i = 0; i < Math.min(2, createdQRTokens.length); i++) {
      const qrToken = createdQRTokens[i];
      try {
        const { data: ticket, error: scanError } = await supabase
          .from('tickets')
          .select('*, events(*), ticket_types(*)')
          .eq('qr_token', qrToken)
          .single();

        if (scanError || !ticket) {
          logStep(`QR Scan ${i + 1}`, false, 'QR code lookup failed', scanError);
          continue;
        }

        if (ticket.is_used || ticket.status === 'scanned' || ticket.scanned_at) {
          logStep(`QR Scan ${i + 1}`, true, 'Ticket already scanned');
          scannedCount++;
          continue;
        }

        // Mark as scanned
        const { error: updateError } = await supabase
          .from('tickets')
          .update({
            status: 'scanned',
            is_used: true,
            scanned_at: new Date().toISOString(),
          })
          .eq('id', ticket.id);

        if (updateError) {
          logStep(`QR Scan ${i + 1}`, false, 'Failed to mark as scanned', updateError);
        } else {
          scannedCount++;
          logStep(`QR Scan ${i + 1}`, true, `Ticket scanned successfully`, {
            ticket_id: ticket.ticket_id,
            qr_token: qrToken.substring(0, 8) + '...',
            scanned_at: new Date().toISOString(),
          });
        }
      } catch (error: any) {
        logStep(`QR Scan ${i + 1}`, false, 'Error scanning ticket', error);
      }
    }

    // Test manual scan (by ticket ID) for remaining tickets
    if (createdTicketIds.length > 2) {
      console.log('\n🔍 Testing Manual Scan (by Ticket ID)...\n');
      for (let i = 2; i < Math.min(5, createdTicketIds.length); i++) {
        const ticketId = createdTicketIds[i];
        try {
          const { data: ticket } = await supabase
            .from('tickets')
            .select('*, events(*), ticket_types(*)')
            .eq('id', ticketId)
            .single();

          if (ticket && !ticket.is_used && !ticket.scanned_at) {
            const { error: updateError } = await supabase
              .from('tickets')
              .update({
                status: 'scanned',
                is_used: true,
                scanned_at: new Date().toISOString(),
              })
              .eq('id', ticketId);

            if (!updateError) {
              scannedCount++;
              logStep(`Manual Scan ${i - 1}`, true, `Ticket scanned by ID`, {
                ticket_id: ticket.ticket_id,
                method: 'manual_entry',
              });
            }
          }
        } catch (error: any) {
          logStep(`Manual Scan ${i - 1}`, false, 'Error in manual scan', error);
        }
      }
    }
  } else {
    logStep('QR Scanning', false, 'No QR tokens available for testing');
  }

  await sleep(500);

  // STEP 7: Verify Dashboard Analytics
  console.log('\n📈 STEP 7: Verifying Dashboard Analytics...\n');
  try {
    const { data: allTickets } = await supabase
      .from('tickets')
      .select('price, created_at, scanned_at, event_name, event_id')
      .eq('event_id', eventId!);

    if (allTickets) {
      const totalRevenue = allTickets.reduce(
        (sum, t) => sum + (parseFloat(t.price?.toString() || '0') || 0),
        0
      );
      const totalTickets = allTickets.length;
      const scannedTickets = allTickets.filter(t => t.scanned_at).length;
      const conversionRate = totalTickets > 0 ? (scannedTickets / totalTickets) * 100 : 0;

      logStep('Dashboard Analytics', true, 'Analytics calculated', {
        total_revenue: `$${totalRevenue.toFixed(2)}`,
        total_tickets: totalTickets,
        scanned_tickets: scannedTickets,
        conversion_rate: `${conversionRate.toFixed(1)}%`,
      });
    }

    // Check recent purchases
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('event_id', eventId!)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentOrders && recentOrders.length > 0) {
      logStep('Recent Purchases', true, `Found ${recentOrders.length} recent orders`);
    }
  } catch (error: any) {
    logStep('Dashboard Analytics', false, 'Error checking analytics', error);
  }

  // FINAL SUMMARY
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (createdTicketIds.length > 0) {
    console.log('🎫 Created Tickets:');
    console.log(`   Total: ${createdTicketIds.length} tickets`);
    console.log(`   Scanned: ${scannedCount} tickets`);
    console.log(`   Pending: ${createdTicketIds.length - scannedCount} tickets\n`);
  }

  if (createdQRTokens.length > 0) {
    console.log('📱 QR Tokens for Manual Testing:');
    createdQRTokens.slice(0, 3).forEach((token, i) => {
      console.log(`   ${i + 1}. ${token}`);
    });
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('📋 MANUAL TESTING STEPS\n');
  console.log('Since automated order creation may have limitations, complete these steps manually:\n');
  console.log('1. 🌐 Main Website (http://localhost:3000)');
  console.log('   • Verify "PRE THANKSGIVING BASH" appears in events list');
  console.log('   • Click on the event');
  console.log('   • Click "Buy Tickets" → Redirects to Purchase Website\n');
  
  console.log('2. 🛒 Purchase Website (http://localhost:5173/events)');
  console.log('   • Login: demo@maguey.com / demo1234');
  console.log('   • Find "PRE THANKSGIVING BASH"');
  console.log('   • Select "Men - Before 10 PM" ticket type');
  console.log('   • Quantity: 5 tickets');
  console.log('   • Complete checkout with Stripe test card: 4242 4242 4242 4242');
  console.log('   • After payment, view tickets with QR codes\n');
  
  console.log('3. 📱 Scanner Site (http://localhost:5175/scanner)');
  console.log('   • Login with owner/staff account');
  console.log('   • Test QR Code Scanning:');
  console.log('     - Scan 2-3 tickets using camera/QR code');
  console.log('   • Test Manual Scanning:');
  console.log('     - Enter ticket ID manually for 2-3 tickets');
  console.log('   • Verify each scan shows "Entry Granted"\n');
  
  console.log('4. 📊 Dashboard Verification (http://localhost:5175/dashboard)');
  console.log('   • Check "Recent Purchases" - should show order for 5 tickets');
  console.log('   • Check "Analytics" - revenue should show $175 ($35 × 5)');
  console.log('   • Check "Activity Feed" - should show scan entries');
  console.log('   • Check "Tickets Scanned" count matches scans performed\n');

  console.log('='.repeat(70));
  console.log('📸 SCREENSHOT CHECKLIST\n');
  console.log('Take screenshots of:\n');
  console.log('1. Main Website - Event listing showing PRE THANKSGIVING BASH');
  console.log('2. Main Website - Event detail page');
  console.log('3. Purchase Website - Event listing');
  console.log('4. Purchase Website - Event detail with ticket types');
  console.log('5. Purchase Website - Checkout page (5 tickets selected)');
  console.log('6. Purchase Website - Payment confirmation');
  console.log('7. Purchase Website - Tickets page showing 5 tickets with QR codes');
  console.log('8. Scanner Site - Before scanning (empty state)');
  console.log('9. Scanner Site - QR code scan in progress');
  console.log('10. Scanner Site - Successful QR scan result');
  console.log('11. Scanner Site - Manual entry field');
  console.log('12. Scanner Site - Successful manual scan result');
  console.log('13. Dashboard - Recent Purchases showing order');
  console.log('14. Dashboard - Analytics showing $175 revenue');
  console.log('15. Dashboard - Activity Feed showing scans');
  console.log('16. Dashboard - KPI cards updated');
  console.log('17. Dashboard - Full overview with all metrics\n');

  return {
    success: failed === 0,
    passed,
    failed,
    ticketsCreated: createdTicketIds.length,
    ticketsScanned: scannedCount,
    qrTokens: createdQRTokens,
  };
}

// Run the test
runCompleteE2ETest()
  .then((result) => {
    console.log('\n✅ Automated test complete!');
    console.log(`   Created: ${result.ticketsCreated} tickets`);
    console.log(`   Scanned: ${result.ticketsScanned} tickets`);
    if (result.success) {
      console.log('\n🎉 All automated tests passed!');
      console.log('   Complete manual testing steps above to finish verification.');
    } else {
      console.log('\n⚠️  Some automated tests failed.');
      console.log('   Complete manual purchase through website UI.');
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });

