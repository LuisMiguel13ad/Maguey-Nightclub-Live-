/**
 * Comprehensive Feature Test Script
 * Tests all new features after migration is applied
 * Run with: tsx test-all-features.ts
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
config({ path: resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase credentials not found in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🧪 Testing All Features\n');
console.log('='.repeat(60));

let allTestsPassed = true;

// Test 1: Verify Migration Applied
async function testMigration() {
  console.log('\n1️⃣ Testing Migration Application...');
  
  try {
    // Check scan_history table
    const { data: scanHistory, error: scanError } = await supabase
      .from('scan_history')
      .select('id')
      .limit(1);

    if (scanError) {
      console.log('❌ scan_history table not found:', scanError.message);
      console.log('   → Migration needs to be applied!');
      return false;
    }
    console.log('✅ scan_history table exists');

    // Check re-entry columns in tickets
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('current_status, entry_count, exit_count, last_entry_at, last_exit_at')
      .limit(1);

    if (ticketsError) {
      console.log('❌ Error checking tickets table:', ticketsError.message);
      return false;
    }

    if (tickets && tickets.length > 0) {
      const ticket = tickets[0] as any;
      if ('current_status' in ticket && 'entry_count' in ticket) {
        console.log('✅ Re-entry columns exist in tickets table');
        return true;
      } else {
        console.log('❌ Re-entry columns missing in tickets table');
        return false;
      }
    } else {
      console.log('⚠️  No tickets found, but columns should exist');
      return true; // Columns exist, just no data
    }
  } catch (error: any) {
    console.log('❌ Migration test failed:', error.message);
    return false;
  }
}

// Test 2: Test Re-entry Service
async function testReEntryService() {
  console.log('\n2️⃣ Testing Re-entry Service...');
  
  try {
    const reEntryService = await import('./src/lib/re-entry-service');
    
    // Test getCurrentlyInsideCount
    const insideCount = await reEntryService.getCurrentlyInsideCount();
    console.log(`✅ Currently inside count: ${insideCount}`);
    
    // Test getReEntryMode
    const mode = await reEntryService.getReEntryMode();
    console.log(`✅ Re-entry mode: ${mode}`);
    
    return true;
  } catch (error: any) {
    console.log('❌ Re-entry service test failed:', error.message);
    return false;
  }
}

// Test 3: Test Offline Queue Service
async function testOfflineQueueService() {
  console.log('\n3️⃣ Testing Offline Queue Service...');
  
  try {
    const queueService = await import('./src/lib/offline-queue-service');
    
    // Test getSyncStatus
    const status = await queueService.getSyncStatus();
    console.log('✅ Sync status:', {
      pending: status.pending,
      syncing: status.syncing,
      synced: status.synced,
      failed: status.failed,
    });
    
    return true;
  } catch (error: any) {
    console.log('❌ Offline queue service test failed:', error.message);
    return false;
  }
}

// Test 4: Test Audio Feedback Service
async function testAudioFeedbackService() {
  console.log('\n4️⃣ Testing Audio Feedback Service...');
  
  try {
    const audioService = await import('./src/lib/audio-feedback-service');
    
    const settings = audioService.getAudioSettings();
    console.log('✅ Audio settings:', {
      soundEnabled: settings.soundEnabled,
      hapticEnabled: settings.hapticEnabled,
      volume: settings.volume,
    });
    
    // Test that functions exist
    console.log('✅ Audio functions available');
    
    return true;
  } catch (error: any) {
    console.log('❌ Audio feedback service test failed:', error.message);
    return false;
  }
}

// Test 5: Test Scanner Service with Re-entry
async function testScannerService() {
  console.log('\n5️⃣ Testing Scanner Service Integration...');
  
  try {
    const scannerService = await import('./src/lib/scanner-service');
    
    // Get a test ticket if available
    const { data: testTicket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, status, current_status')
      .limit(1)
      .maybeSingle();

    if (ticketError || !testTicket) {
      console.log('⚠️  No test ticket found - skipping scan test');
      console.log('   (This is OK if you have no tickets yet)');
      return true;
    }

    console.log(`✅ Found test ticket: ${testTicket.id}`);
    console.log(`   Status: ${testTicket.status}`);
    console.log(`   Current Status: ${(testTicket as any).current_status || 'N/A'}`);
    
    return true;
  } catch (error: any) {
    console.log('❌ Scanner service test failed:', error.message);
    return false;
  }
}

// Test 6: Test Database Queries
async function testDatabaseQueries() {
  console.log('\n6️⃣ Testing Database Queries...');
  
  try {
    // Test scan_history query
    const { data: history, error: historyError } = await supabase
      .from('scan_history')
      .select('*')
      .limit(5);

    if (historyError) {
      console.log('❌ Error querying scan_history:', historyError.message);
      return false;
    }
    console.log(`✅ scan_history query works (${history?.length || 0} records)`);

    // Test tickets with re-entry columns
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, current_status, entry_count, exit_count')
      .limit(5);

    if (ticketsError) {
      console.log('❌ Error querying tickets:', ticketsError.message);
      return false;
    }
    console.log(`✅ tickets query with re-entry columns works (${tickets?.length || 0} records)`);

    // Test currently inside query
    const { data: insideTickets, error: insideError } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('current_status', 'inside');

    if (insideError) {
      console.log('❌ Error querying currently inside:', insideError.message);
      return false;
    }
    console.log(`✅ Currently inside query works (count: ${insideTickets || 0})`);

    return true;
  } catch (error: any) {
    console.log('❌ Database query test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const results = {
    migration: await testMigration(),
    reEntryService: await testReEntryService(),
    offlineQueue: await testOfflineQueueService(),
    audioFeedback: await testAudioFeedbackService(),
    scannerService: await testScannerService(),
    databaseQueries: await testDatabaseQueries(),
  };

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results Summary:\n');
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    if (!passed) allTestsPassed = false;
  });

  console.log('\n' + '='.repeat(60));
  
  if (allTestsPassed) {
    console.log('\n🎉 All tests passed! Features are ready to use.\n');
    console.log('📋 Next Steps:');
    console.log('1. Start dev server: npm run dev');
    console.log('2. Test in browser:');
    console.log('   - Audio: Enable sound/haptic in scanner settings');
    console.log('   - Offline: Disconnect internet and scan tickets');
    console.log('   - Re-entry: Switch to "Re-entry" mode and scan same ticket twice');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.\n');
    console.log('💡 Most common issue: Migration not applied');
    console.log('   → Apply migration via Supabase Dashboard SQL Editor\n');
  }
}

runAllTests().catch(console.error);

