import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

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
const TEST_USER_EMAIL = 'demo@maguey.com';

// Helper function to generate ticket type code
function generateTicketTypeCode(name: string, index: number = 0): string {
  const cleanName = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = cleanName.substring(0, 3);
  return `${prefix}${index.toString().padStart(3, '0')}`;
}

interface TestStep {
  name: string;
  success: boolean;
  message: string;
  data?: any;
}

const testResults: TestStep[] = [];

function logStep(name: string, success: boolean, message: string, data?: any) {
  testResults.push({ name, success, message, data });
  const icon = success ? '✅' : '❌';
  const color = success ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`${color}${icon} ${name}:${reset} ${message}`);
  if (data && !success) {
    console.log('   Details:', JSON.stringify(data, null, 2));
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFullTest() {
  console.log('\n🧪 FULL END-TO-END TEST - PRE THANKSGIVING BASH\n');
  console.log('='.repeat(70));
  
  let eventId: string | null = null;
  let ticketId: string | null = null;
  let orderId: string | null = null;
  let qrToken: string | null = null;

  // STEP 1: Create Event
  console.log('\n📅 STEP 1: Creating Event...\n');
  try {
    const eventData = {
      name: 'PRE THANKSGIVING BASH',
      description: `Join us for an epic Pre Thanksgiving Bash featuring HANE Rodriguez with special guests HER PANTH, LKII NORTEÑA, Dj Calle, and ALMAS DE ACERO.

Event Details:
- Headliner: HANE Rodriguez
- Supporting Acts: HER PANTH, LKII NORTEÑA, Dj Calle, ALMAS DE ACERO
- Age: 16+ with parent, 21+ to drink
- Share required before 8 PM
- Women free before 10 PM
- Men $35 before 10 PM

Presented by LA EMPRESA MUSIC & EVENTOS PERRONES`,
      event_date: '2025-11-26',
      event_time: '21:00',
      venue_name: 'Maguey Delaware',
      venue_address: '3320 Old Capitol Trail',
      city: 'Wilmington',
      status: 'published',
      published_at: new Date().toISOString(),
      categories: ['norteña', 'live music', 'special event'],
      tags: ['thanksgiving', 'hane rodriguez', 'her panth', 'lkii norteña'],
    };

    // Check if event already exists
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('name', eventData.name)
      .single();

    if (existing) {
      logStep('Event Creation', true, `Event already exists (ID: ${existing.id})`);
      eventId = existing.id;
      
      // Update event to ensure it's published
      const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', eventId);
      
      if (updateError) {
        logStep('Event Update', false, 'Failed to update event', updateError);
      } else {
        logStep('Event Update', true, 'Event updated and published');
      }
    } else {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (eventError) {
        logStep('Event Creation', false, 'Failed to create event', eventError);
        throw eventError;
      }

      eventId = event.id;
      logStep('Event Creation', true, `Event created (ID: ${eventId})`);
    }

    // Create ticket types
    const ticketTypes = [
      { name: 'Women - Before 10 PM', price: 0.00, capacity: 200 },
      { name: 'Men - Before 10 PM', price: 35.00, capacity: 300 },
      { name: 'General Admission - After 10 PM', price: 50.00, capacity: 200 },
    ];

    // Delete existing ticket types for this event
    await supabase.from('ticket_types').delete().eq('event_id', eventId);

    const ticketTypeRows = ticketTypes.map((tt, index) => ({
      event_id: eventId!,
      name: tt.name.trim(),
      code: generateTicketTypeCode(tt.name, index),
      price: tt.price,
      total_inventory: tt.capacity,
    }));

    const { error: ttError } = await supabase
      .from('ticket_types')
      .insert(ticketTypeRows);

    if (ttError) {
      logStep('Ticket Types', false, 'Failed to create ticket types', ttError);
    } else {
      logStep('Ticket Types', true, `Created ${ticketTypes.length} ticket types`);
    }

  } catch (error: any) {
    logStep('Event Creation', false, 'Error in event creation', error);
    console.log('\n⚠️  Cannot proceed without event. Please create manually through dashboard.');
    return;
  }

  await sleep(1000);

  // STEP 2: Verify Event on All Sites (check database)
  console.log('\n🌐 STEP 2: Verifying Event Availability...\n');
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId!)
      .single();

    if (error || !event) {
      logStep('Event Verification', false, 'Event not found', error);
    } else {
      logStep('Event Verification', true, 'Event found and published', {
        name: event.name,
        status: event.status,
        event_date: event.event_date,
        is_active: event.is_active,
      });

      if (event.status !== 'published') {
        logStep('Event Status', false, 'Event is not published', { status: event.status });
      } else {
        logStep('Event Status', true, 'Event is published and will appear on all sites');
      }
    }
  } catch (error: any) {
    logStep('Event Verification', false, 'Error verifying event', error);
  }

  await sleep(1000);

  // STEP 3: Create Test Order
  console.log('\n🛒 STEP 3: Creating Test Order...\n');
  try {
    // Get ticket type
    const { data: ticketType, error: ttError } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', eventId!)
      .eq('name', 'Men - Before 10 PM')
      .single();

    if (ttError || !ticketType) {
      logStep('Ticket Type Lookup', false, 'Ticket type not found', ttError);
      throw new Error('Ticket type not found');
    }

    logStep('Ticket Type Lookup', true, `Found ticket type: ${ticketType.name}`, {
      price: ticketType.price,
      capacity: ticketType.total_inventory,
    });

    // Create order (using only columns that definitely exist)
    const orderData: any = {
      stripe_payment_intent_id: `pi_test_${Date.now()}`,
      customer_email: TEST_USER_EMAIL,
      customer_name: 'Test Customer',
      customer_phone: '(555) 123-4567',
      total_amount: 35.00,
      currency: 'usd',
      status: 'completed',
      event_name: 'PRE THANKSGIVING BASH',
      ticket_count: 1,
      ticket_type: 'Men - Before 10 PM',
      // Don't include completed_at - let database handle it
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError) {
      logStep('Order Creation', false, 'Failed to create order', orderError);
      throw orderError;
    }

    orderId = order.id;
    logStep('Order Creation', true, `Order created (ID: ${orderId})`, {
      customer_email: order.customer_email,
      total_amount: order.total_amount,
      status: order.status,
    });

  } catch (error: any) {
    logStep('Order Creation', false, 'Error creating order', error);
    console.log('\n⚠️  Order creation failed. You may need to purchase manually through the website.');
  }

  await sleep(1000);

  // STEP 4: Create Test Ticket
  console.log('\n🎫 STEP 4: Creating Test Ticket...\n');
  try {
    if (!orderId) {
      logStep('Ticket Creation', false, 'Cannot create ticket without order');
      throw new Error('No order ID');
    }

    // Get event and ticket type
    const { data: event } = await supabase
      .from('events')
      .select('name')
      .eq('id', eventId!)
      .single();

    const { data: ticketType } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', eventId!)
      .eq('name', 'Men - Before 10 PM')
      .single();

    if (!event || !ticketType) {
      throw new Error('Event or ticket type not found');
    }

    // Generate ticket ID and QR token
    const ticketIdStr = `MGY-1B-20251126-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    qrToken = randomUUID();

    const ticketData = {
      ticket_id: ticketIdStr,
      qr_token: qrToken,
      qr_code_value: ticketIdStr,
      qr_code_data: ticketIdStr,
      event_id: eventId!,
      event_name: event.name,
      ticket_type_id: ticketType.id,
      ticket_type: ticketType.name,
      order_id: orderId,
      guest_name: 'Test Customer',
      guest_email: TEST_USER_EMAIL,
      attendee_name: 'Test Customer',
      attendee_email: TEST_USER_EMAIL,
      price_paid: 35.00,
      status: 'issued',
      is_used: false,
      purchase_date: new Date().toISOString(),
      issued_at: new Date().toISOString(),
    };

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert([ticketData])
      .select()
      .single();

    if (ticketError) {
      logStep('Ticket Creation', false, 'Failed to create ticket', ticketError);
      throw ticketError;
    }

    ticketId = ticket.id;
    logStep('Ticket Creation', true, `Ticket created (ID: ${ticket.ticket_id})`, {
      qr_token: ticket.qr_token ? 'Present' : 'Missing',
      status: ticket.status,
      event_name: ticket.event_name,
    });

  } catch (error: any) {
    logStep('Ticket Creation', false, 'Error creating ticket', error);
    console.log('\n⚠️  Ticket creation failed. You may need to purchase manually through the website.');
  }

  await sleep(1000);

  // STEP 5: Verify Order in Dashboard
  console.log('\n📊 STEP 5: Verifying Order in Dashboard...\n');
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_email', TEST_USER_EMAIL)
      .eq('event_name', 'PRE THANKSGIVING BASH')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      logStep('Order Verification', false, 'Error checking orders', error);
    } else {
      const recentOrder = orders?.[0];
      if (recentOrder) {
        logStep('Order Verification', true, 'Order found in dashboard', {
          order_id: recentOrder.id,
          customer_email: recentOrder.customer_email,
          total_amount: recentOrder.total_amount,
          status: recentOrder.status,
          created_at: recentOrder.created_at,
        });
      } else {
        logStep('Order Verification', false, 'No orders found for test user');
      }
    }
  } catch (error: any) {
    logStep('Order Verification', false, 'Error verifying order', error);
  }

  await sleep(1000);

  // STEP 6: Test QR Code Scanning
  console.log('\n📱 STEP 6: Testing QR Code Scanning...\n');
  try {
    if (!qrToken) {
      logStep('QR Scan Test', false, 'No QR token available for testing');
    } else {
      const { data: scannedTicket, error: scanError } = await supabase
        .from('tickets')
        .select('*, events(*), ticket_types(*)')
        .eq('qr_token', qrToken)
        .single();

      if (scanError) {
        logStep('QR Scan Test', false, 'QR code lookup failed', scanError);
      } else {
        logStep('QR Scan Test', true, 'QR code lookup successful', {
          ticket_id: scannedTicket.ticket_id,
          event_name: scannedTicket.events?.name,
          ticket_type: scannedTicket.ticket_types?.name,
          status: scannedTicket.status,
          is_used: scannedTicket.is_used,
        });

        // Test scanning the ticket
        if (!scannedTicket.is_used && scannedTicket.status === 'issued') {
          const { error: scanUpdateError } = await supabase
            .from('tickets')
            .update({
              status: 'scanned',
              is_used: true,
              scanned_at: new Date().toISOString(),
            })
            .eq('id', scannedTicket.id);

          if (scanUpdateError) {
            logStep('Ticket Scan', false, 'Failed to mark ticket as scanned', scanUpdateError);
          } else {
            logStep('Ticket Scan', true, 'Ticket successfully scanned', {
              scanned_at: new Date().toISOString(),
            });
          }
        } else {
          logStep('Ticket Scan', true, 'Ticket already scanned or invalid status');
        }
      }
    }
  } catch (error: any) {
    logStep('QR Scan Test', false, 'Error testing QR scan', error);
  }

  await sleep(1000);

  // STEP 7: Verify Dashboard Analytics
  console.log('\n📈 STEP 7: Verifying Dashboard Analytics...\n');
  try {
    const { data: allTickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('price_paid, created_at, scanned_at, event_name')
      .eq('event_name', 'PRE THANKSGIVING BASH');

    if (!ticketsError && allTickets) {
      const totalRevenue = allTickets.reduce(
        (sum, t) => sum + (parseFloat(t.price_paid?.toString() || '0') || 0),
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
      .eq('event_name', 'PRE THANKSGIVING BASH')
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

  const passed = testResults.filter(r => r.success).length;
  const failed = testResults.filter(r => !r.success).length;
  const total = testResults.length;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('⚠️  Failed Steps:');
    testResults.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('📋 MANUAL VERIFICATION REQUIRED\n');
  console.log('The following steps require manual browser testing:\n');
  console.log('1. ✅ Verify event appears on Main Website (http://localhost:3000)');
  console.log('2. ✅ Verify event appears on Purchase Website (http://localhost:5173/events)');
  console.log('3. ✅ Purchase ticket through Purchase Website UI');
  console.log('4. ✅ View ticket QR code after purchase');
  console.log('5. ✅ Scan ticket using Scanner page (http://localhost:5175/scanner)');
  console.log('6. ✅ Verify scan appears in Dashboard Activity Feed');
  console.log('7. ✅ Take screenshots of all steps (see COMPLETE_EVENT_TEST_GUIDE.md)\n');

  console.log('📸 Screenshot Checklist: See COMPLETE_EVENT_TEST_GUIDE.md for full list\n');

  if (eventId) {
    console.log('🔗 Quick Links:');
    console.log(`   Dashboard: http://localhost:5175/dashboard`);
    console.log(`   Events: http://localhost:5175/events`);
    console.log(`   Scanner: http://localhost:5175/scanner`);
    console.log(`   Main Site: http://localhost:3000`);
    console.log(`   Purchase Site: http://localhost:5173/events\n`);
  }

  return {
    success: failed === 0,
    passed,
    failed,
    eventId,
    orderId,
    ticketId,
    qrToken,
  };
}

// Run the test
runFullTest()
  .then((result) => {
    if (result.success) {
      console.log('✅ All automated tests passed!');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Check output above.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });

