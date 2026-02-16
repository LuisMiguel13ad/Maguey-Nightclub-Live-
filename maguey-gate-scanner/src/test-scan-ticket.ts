// Load environment variables from .env file FIRST
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
config({ path: resolve(__dirname, '../.env') });

/**
 * Test function to scan a ticket and verify duplicate scan prevention
 */
async function testScanTicket() {
  // Dynamic import after env vars are loaded
  const { lookupTicketByQR, scanTicket } = await import('./lib/scanner-service');
  
  const qrToken = '625a23e7-23b1-4f66-bbf3-6029b9e6a7aa';

  console.log('🧪 Testing ticket scanning...');
  console.log(`QR Token: ${qrToken}`);
  console.log('---\n');

  try {
    // Step 1: Lookup ticket and show current status
    console.log('Step 1: Looking up ticket...');
    const ticketBefore = await lookupTicketByQR(qrToken);

    if (!ticketBefore) {
      console.error('❌ Ticket not found!');
      return;
    }

    console.log('✅ Ticket found!');
    console.log(`  Ticket ID: ${ticketBefore.id}`);
    console.log(`  Current Status: ${ticketBefore.status}`);
    console.log(`  Scanned At: ${ticketBefore.scanned_at || 'Not scanned yet'}`);
    console.log(`  Attendee: ${ticketBefore.attendee_name || 'N/A'}`);
    if (ticketBefore.events) {
      console.log(`  Event: ${ticketBefore.events.name}`);
    }
    console.log('---\n');

    // Step 2: Scan the ticket
    console.log('Step 2: Scanning ticket...');
    const scanResult = await scanTicket(ticketBefore.id, 'test-scanner-user');

    if (!scanResult.success) {
      console.error(`❌ Scan failed: ${scanResult.error}`);
      return;
    }

    console.log('✅ Ticket scanned successfully!');
    if (scanResult.ticket) {
      console.log(`  New Status: ${scanResult.ticket.status}`);
      console.log(`  Scanned At: ${scanResult.ticket.scanned_at}`);
    }
    console.log('---\n');

    // Step 3: Lookup ticket again to confirm status changed
    console.log('Step 3: Verifying status change...');
    const ticketAfter = await lookupTicketByQR(qrToken);

    if (!ticketAfter) {
      console.error('❌ Ticket not found after scan!');
      return;
    }

    console.log('✅ Ticket status verified!');
    console.log(`  Status: ${ticketAfter.status}`);
    console.log(`  Scanned At: ${ticketAfter.scanned_at}`);
    
    if (ticketAfter.status === 'scanned') {
      console.log('✅ Status correctly changed to "scanned"');
    } else {
      console.error(`❌ Expected status "scanned", got "${ticketAfter.status}"`);
    }
    console.log('---\n');

    // Step 4: Try to scan again to test duplicate prevention
    console.log('Step 4: Testing duplicate scan prevention...');
    const duplicateScanResult = await scanTicket(ticketAfter.id, 'test-scanner-user');

    if (duplicateScanResult.success) {
      console.error('❌ Duplicate scan should have failed!');
      return;
    }

    console.log('✅ Duplicate scan correctly prevented!');
    console.log(`  Error message: ${duplicateScanResult.error}`);
    
    if (duplicateScanResult.error?.includes('Already scanned')) {
      console.log('✅ Error message correctly indicates ticket was already scanned');
    }
    console.log('---\n');

    console.log('✅ All tests passed!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    if (err instanceof Error) {
      console.error('Error message:', err.message);
      console.error('Stack:', err.stack);
    }
  }
}

// Run the test when executed directly
testScanTicket()
  .then(() => {
    console.log('---');
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });

export { testScanTicket };

