// Load environment variables from .env file FIRST
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
config({ path: resolve(__dirname, '../.env') });

// Create a simple in-memory storage for Node.js (since localStorage doesn't exist)
class MemoryStorage {
  private storage: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }

  get length(): number {
    return this.storage.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.storage.keys());
    return keys[index] || null;
  }
}

/**
 * Test function to inspect tickets in the database and test manual lookup
 */
async function testManualLookup() {
  // Create Supabase client directly for Node.js environment
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: new MemoryStorage() as any,
      persistSession: false,
      autoRefreshToken: false,
    }
  });
  const targetQrToken = '373a7615-4e54-40bd-9fc5-c4a9188d4e5b';

  console.log('🔍 Testing manual ticket lookup...');
  console.log('---\n');

  try {
    // Step 1: Get all tickets and show first 3
    console.log('Step 1: Fetching all tickets from database...');
    const { data: allTickets, error: allError } = await supabase
      .from('tickets')
      .select('id, ticket_id, qr_token, attendee_name, status')
      .limit(100); // Get up to 100 tickets

    if (allError) {
      console.error('❌ Error fetching tickets:', allError);
      return;
    }

    if (!allTickets || allTickets.length === 0) {
      console.log('⚠️  No tickets found in database');
      return;
    }

    console.log(`✅ Found ${allTickets.length} ticket(s) in database`);
    console.log('---\n');

    // Show first 3 tickets
    console.log('First 3 tickets:');
    console.log('---');
    const ticketsToShow = allTickets.slice(0, 3);
    ticketsToShow.forEach((ticket, index) => {
      console.log(`\nTicket ${index + 1}:`);
      console.log(`  id: ${ticket.id}`);
      console.log(`  ticket_id: ${ticket.ticket_id || 'NULL'}`);
      console.log(`  qr_token: ${ticket.qr_token || 'NULL'}`);
      console.log(`  attendee_name: ${ticket.attendee_name || 'NULL'}`);
      console.log(`  status: ${ticket.status || 'NULL'}`);
    });
    console.log('\n---\n');

    // Step 2: Try to find the specific ticket by qr_token
    console.log(`Step 2: Looking up ticket with qr_token = '${targetQrToken}'...`);
    const { data: foundTicket, error: lookupError } = await supabase
      .from('tickets')
      .select('id, ticket_id, qr_token, attendee_name, status')
      .eq('qr_token', targetQrToken)
      .maybeSingle();

    if (lookupError) {
      console.error('❌ Error looking up ticket:', lookupError);
      return;
    }

    if (!foundTicket) {
      console.log('⚠️  Ticket not found with that qr_token');
      console.log('\nChecking if any tickets have similar qr_token values...');
      
      // Check for partial matches
      const partialMatches = allTickets.filter(t => 
        t.qr_token && t.qr_token.includes(targetQrToken.substring(0, 8))
      );
      
      if (partialMatches.length > 0) {
        console.log(`Found ${partialMatches.length} ticket(s) with similar qr_token:`);
        partialMatches.forEach((ticket, index) => {
          console.log(`  ${index + 1}. qr_token: ${ticket.qr_token}`);
        });
      }
      return;
    }

    console.log('✅ Ticket found!');
    console.log('---');
    console.log('Ticket Details:');
    console.log(`  id: ${foundTicket.id}`);
    console.log(`  ticket_id: ${foundTicket.ticket_id || 'NULL'}`);
    console.log(`  qr_token: ${foundTicket.qr_token || 'NULL'}`);
    console.log(`  attendee_name: ${foundTicket.attendee_name || 'NULL'}`);
    console.log(`  status: ${foundTicket.status || 'NULL'}`);
    console.log('---\n');

    // Step 3: Test the OR query that manual verification would use
    console.log(`Step 3: Testing OR query (ticket_id OR qr_token OR id)...`);
    const { data: orResult, error: orError } = await supabase
      .from('tickets')
      .select('id, ticket_id, qr_token, attendee_name, status')
      .or(`ticket_id.eq.${targetQrToken},qr_token.eq.${targetQrToken},id.eq.${targetQrToken}`)
      .limit(1);

    if (orError) {
      console.error('❌ Error with OR query:', orError);
      return;
    }

    if (!orResult || orResult.length === 0) {
      console.log('⚠️  OR query did not find the ticket');
      return;
    }

    console.log('✅ OR query found ticket!');
    console.log(`  Found by: ${orResult[0].qr_token === targetQrToken ? 'qr_token' : 
                          orResult[0].ticket_id === targetQrToken ? 'ticket_id' : 
                          orResult[0].id === targetQrToken ? 'id' : 'unknown'}`);
    console.log('---\n');

    console.log('✅ All tests completed successfully!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    if (err instanceof Error) {
      console.error('Error message:', err.message);
      console.error('Stack:', err.stack);
    }
  }
}

// Run the test when executed directly
testManualLookup()
  .then(() => {
    console.log('---');
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });

export { testManualLookup };

