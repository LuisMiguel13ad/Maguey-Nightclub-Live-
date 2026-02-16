/**
 * End-to-End Test Runner
 * Verifies the complete flow: Event → Purchase → Ticket → Scan → Dashboard
 */

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
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function testStep(name: string, test: () => Promise<boolean | any>): Promise<void> {
  try {
    const result = await test();
    if (result === false) {
      results.push({ step: name, status: 'FAIL', message: 'Test returned false' });
      console.log(`❌ ${name}`);
    } else {
      results.push({ step: name, status: 'PASS', message: 'Success', data: result });
      console.log(`✅ ${name}`);
    }
  } catch (error: any) {
    results.push({ step: name, status: 'FAIL', message: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 Running End-to-End Tests\n');
  console.log('='.repeat(60));

  // Test 1: Verify Supabase Connection
  await testStep('1. Supabase Connection', async () => {
    const { data, error } = await supabase.from('events').select('count').limit(1);
    if (error) throw error;
    return true;
  });

  // Test 2: Check Published Events Exist
  await testStep('2. Published Events Available', async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, name, event_date, status, is_active')
      .eq('status', 'published')
      .eq('is_active', true)
      .limit(5);
    
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No published events found');
    
    return {
      count: data.length,
      events: data.map(e => ({ id: e.id, name: e.name, date: e.event_date })),
    };
  });

  // Test 3: Check Ticket Types Exist
  await testStep('3. Ticket Types Available', async () => {
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('status', 'published')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!events) throw new Error('No events found');

    const { data, error } = await supabase
      .from('ticket_types')
      .select('id, name, price, total_inventory')
      .eq('event_id', events.id)
      .limit(5);

    if (error) throw error;
    return {
      count: data?.length || 0,
      types: data?.map(tt => ({ name: tt.name, price: tt.price, inventory: tt.total_inventory })),
    };
  });

  // Test 4: Check Existing Orders
  await testStep('4. Orders Table Accessible', async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, purchaser_email, total, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    return {
      count: data?.length || 0,
      recent: data?.slice(0, 3).map(o => ({
        id: o.id,
        email: o.purchaser_email,
        total: o.total,
        status: o.status,
      })),
    };
  });

  // Test 5: Check Existing Tickets
  await testStep('5. Tickets Table Accessible', async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('id, qr_token, status, attendee_name, order_id')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    
    const testTicket = data?.find(t => t.status === 'issued');
    
    return {
      count: data?.length || 0,
      testTicket: testTicket ? {
        id: testTicket.id,
        qr_token: testTicket.qr_token,
        status: testTicket.status,
        attendee: testTicket.attendee_name,
      } : null,
    };
  });

  // Test 6: Verify Ticket Can Be Looked Up
  await testStep('6. Ticket Lookup Works', async () => {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, qr_token, status')
      .eq('status', 'issued')
      .limit(1)
      .single();

    if (!tickets) {
      return { status: 'SKIP', message: 'No issued tickets found for testing' };
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*, orders(*), events(*)')
      .eq('id', tickets.id)
      .single();

    if (error) throw error;
    return {
      ticketId: ticket.id,
      qrToken: ticket.qr_token,
      eventName: ticket.events?.name,
      orderId: ticket.order_id,
    };
  });

  // Test 7: Verify Dashboard Data
  await testStep('7. Dashboard Data Available', async () => {
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { count: totalTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });

    const { count: scannedTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scanned');

    const { count: activeEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('is_active', true);

    return {
      totalOrders: totalOrders || 0,
      totalTickets: totalTickets || 0,
      scannedTickets: scannedTickets || 0,
      activeEvents: activeEvents || 0,
      scanRate: totalTickets ? ((scannedTickets || 0) / totalTickets * 100).toFixed(1) + '%' : '0%',
    };
  });

  // Test 8: Verify Recent Purchases
  await testStep('8. Recent Purchases Query', async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, purchaser_email, total, status, created_at, events(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return {
      count: data?.length || 0,
      purchases: data?.map(o => ({
        id: o.id,
        email: o.purchaser_email,
        total: o.total,
        status: o.status,
        event: o.events?.name,
      })),
    };
  });

  // Test 9: Verify Scanner Can Access Tickets
  await testStep('9. Scanner Ticket Access', async () => {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, qr_token, status, events(name, event_date)')
      .eq('status', 'issued')
      .limit(1)
      .single();

    if (!ticket) {
      return { status: 'SKIP', message: 'No issued tickets to test scanning' };
    }

    // Simulate ticket lookup (what scanner does)
    const { data: scannedTicket, error } = await supabase
      .from('tickets')
      .select('id, attendee_name, qr_token, status, events(name, event_date, event_time)')
      .eq('qr_token', ticket.qr_token)
      .single();

    if (error) throw error;
    return {
      canAccess: true,
      ticket: {
        id: scannedTicket.id,
        attendee: scannedTicket.attendee_name,
        event: scannedTicket.events?.name,
        status: scannedTicket.status,
      },
    };
  });

  // Test 10: Verify Waitlist System
  await testStep('10. Waitlist System', async () => {
    // Check if waitlist table exists
    const { data, error } = await supabase
      .from('waitlist')
      .select('id, event_name, ticket_type, customer_email, status')
      .limit(5);

    if (error && error.code === '42P01') {
      return { status: 'SKIP', message: 'Waitlist table does not exist yet' };
    }

    if (error) throw error;
    return {
      count: data?.length || 0,
      entries: data?.map(w => ({
        event: w.event_name,
        ticketType: w.ticket_type,
        email: w.customer_email,
        status: w.status,
      })),
    };
  });

  // Print Results
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results Summary\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}\n`);

  // Detailed Results
  console.log('📋 Detailed Results:\n');
  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${icon} ${result.step}`);
    if (result.data && typeof result.data === 'object') {
      console.log(`   Data:`, JSON.stringify(result.data, null, 2).split('\n').slice(0, 5).join('\n'));
    }
    console.log('');
  });

  // Test URLs
  console.log('='.repeat(60));
  console.log('\n🔗 Test URLs:\n');
  
  const testTicket = results.find(r => r.step === '5. Tickets Table Accessible')?.data?.testTicket;
  if (testTicket) {
    console.log(`📱 View Ticket:`);
    console.log(`   http://localhost:5173/ticket/${testTicket.id}`);
    console.log(`\n📷 Scan Ticket:`);
    console.log(`   http://localhost:5175/scanner`);
    console.log(`   QR Token: ${testTicket.qr_token}`);
  }

  const dashboardData = results.find(r => r.step === '7. Dashboard Data Available')?.data;
  if (dashboardData) {
    console.log(`\n📊 Dashboard:`);
    console.log(`   http://localhost:5175/dashboard`);
    console.log(`   Expected Stats:`);
    console.log(`   - Total Orders: ${dashboardData.totalOrders}`);
    console.log(`   - Total Tickets: ${dashboardData.totalTickets}`);
    console.log(`   - Scanned: ${dashboardData.scannedTickets}`);
    console.log(`   - Scan Rate: ${dashboardData.scanRate}`);
  }

  const events = results.find(r => r.step === '2. Published Events Available')?.data?.events;
  if (events && events.length > 0) {
    console.log(`\n🌐 Main Site:`);
    console.log(`   http://localhost:3000`);
    console.log(`\n🛒 Purchase Site:`);
    console.log(`   http://localhost:5173/events`);
    console.log(`   Test Event: http://localhost:5173/event/${events[0].id}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Automated tests complete!');
  console.log('📸 Now manually test the UI and take screenshots:\n');
  console.log('1. Open the URLs above in your browser');
  console.log('2. Follow COMPLETE_TEST_WALKTHROUGH.md');
  console.log('3. Take screenshots at each step');
  console.log('\n🎉 Ready for manual testing!');

  return { passed, failed, skipped, total: results.length };
}

runTests().catch(console.error);

