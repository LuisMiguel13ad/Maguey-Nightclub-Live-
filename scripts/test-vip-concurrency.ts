/**
 * VIP Concurrent Check-in Test Script
 *
 * Tests race condition handling in VIP check-in flow by simulating
 * 5 simultaneous scanners processing guest passes concurrently.
 *
 * Run: npx tsx scripts/test-vip-concurrency.ts
 *
 * Uses test data from 09-01:
 * - Reservation ID: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
 * - 8 guest passes with tokens VIP-TEST-GUEST-01 through 08
 *
 * Validates ROADMAP success criteria #5:
 * "Multiple concurrent check-ins for same reservation handled correctly"
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../maguey-pass-lounge/.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Test configuration
const TEST_RESERVATION_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const GUEST_PASS_TOKENS = [
  'VIP-TEST-GUEST-01',
  'VIP-TEST-GUEST-02',
  'VIP-TEST-GUEST-03',
  'VIP-TEST-GUEST-04',
  'VIP-TEST-GUEST-05',
];

interface TestResult {
  token: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface VerificationResult {
  checkedInGuests: number;
  scanLogCount: number;
  duplicateLogs: number;
  allSucceeded: boolean;
}

/**
 * Reset test state before running concurrency test
 */
async function resetTestState(client: SupabaseClient): Promise<boolean> {
  console.log('   Resetting test state...');

  // Use the reset_vip_test_state RPC to bypass state machine
  const { data, error } = await client.rpc('reset_vip_test_state', {
    p_reservation_id: TEST_RESERVATION_ID
  });

  if (error) {
    console.error('   Failed to reset test state:', error.message);
    // Try manual reset as fallback
    console.log('   Attempting manual reset...');

    // Delete scan logs
    await client.from('vip_scan_logs').delete().eq('reservation_id', TEST_RESERVATION_ID);

    // Reset passes
    const { error: passError } = await client
      .from('vip_guest_passes')
      .update({ status: 'issued', scanned_at: null, scanned_by: null })
      .eq('reservation_id', TEST_RESERVATION_ID);

    if (passError) {
      console.error('   Failed to reset guest passes:', passError.message);
      return false;
    }

    // Reset reservation counter only (status might be stuck)
    await client
      .from('vip_reservations')
      .update({ checked_in_guests: 0 })
      .eq('id', TEST_RESERVATION_ID);
  } else {
    console.log('   Reset via RPC:', JSON.stringify(data));
  }

  console.log('   Test state reset complete');
  return true;
}

/**
 * Get guest pass IDs for the test tokens
 */
async function getPassIds(client: SupabaseClient, tokens: string[]): Promise<Map<string, string>> {
  const { data, error } = await client
    .from('vip_guest_passes')
    .select('id, qr_token')
    .in('qr_token', tokens);

  if (error) {
    throw new Error(`Failed to fetch pass IDs: ${error.message}`);
  }

  const map = new Map<string, string>();
  data?.forEach(pass => {
    map.set(pass.qr_token, pass.id);
  });

  return map;
}

/**
 * Execute concurrent VIP check-ins
 */
async function runConcurrentScans(
  clients: SupabaseClient[],
  passIdMap: Map<string, string>,
  tokens: string[]
): Promise<TestResult[]> {
  console.log(`   Executing ${tokens.length} concurrent scans...`);

  const promises = tokens.map((token, idx) => {
    const passId = passIdMap.get(token);
    if (!passId) {
      return Promise.resolve({
        token,
        success: false,
        error: 'Pass ID not found'
      } as TestResult);
    }

    return clients[idx].rpc('process_vip_scan_with_reentry', {
      p_pass_id: passId,
      p_scanned_by: `test-scanner-${idx + 1}`
    }).then(({ data, error }) => {
      if (error) {
        return { token, success: false, error: error.message } as TestResult;
      }
      // RPC returns JSON with success boolean
      const result = data as { success: boolean; [key: string]: any };
      return {
        token,
        success: result?.success ?? false,
        data: result,
        error: result?.success ? undefined : (result?.message || result?.error)
      } as TestResult;
    }).catch(err => ({
      token,
      success: false,
      error: err.message
    } as TestResult));
  });

  return Promise.allSettled(promises).then(results =>
    results.map((r, idx) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        token: tokens[idx],
        success: false,
        error: r.reason?.message || 'Unknown error'
      } as TestResult;
    })
  );
}

/**
 * Verify test results
 */
async function verifyResults(client: SupabaseClient): Promise<VerificationResult> {
  // Check reservation's checked_in_guests count
  const { data: reservation, error: resError } = await client
    .from('vip_reservations')
    .select('checked_in_guests')
    .eq('id', TEST_RESERVATION_ID)
    .single();

  if (resError) {
    throw new Error(`Failed to fetch reservation: ${resError.message}`);
  }

  // Get all passes for the reservation
  const { data: passes, error: passError } = await client
    .from('vip_guest_passes')
    .select('id')
    .eq('reservation_id', TEST_RESERVATION_ID);

  if (passError) {
    throw new Error(`Failed to fetch passes: ${passError.message}`);
  }

  const passIds = passes?.map(p => p.id) || [];

  // Count scan logs
  const { data: logs, error: logError } = await client
    .from('vip_scan_logs')
    .select('id, pass_id')
    .in('pass_id', passIds);

  if (logError) {
    throw new Error(`Failed to fetch scan logs: ${logError.message}`);
  }

  // Check for duplicates
  const passIdCounts = new Map<string, number>();
  logs?.forEach(log => {
    const count = passIdCounts.get(log.pass_id) || 0;
    passIdCounts.set(log.pass_id, count + 1);
  });

  const duplicates = Array.from(passIdCounts.values()).filter(count => count > 1).length;

  return {
    checkedInGuests: reservation?.checked_in_guests || 0,
    scanLogCount: logs?.length || 0,
    duplicateLogs: duplicates,
    allSucceeded: true // Will be updated by caller
  };
}

/**
 * Run first-entry concurrency test
 */
async function runFirstEntryTest(): Promise<boolean> {
  console.log('\n' + '='.repeat(60));
  console.log('FIRST-ENTRY CONCURRENCY TEST');
  console.log('='.repeat(60));

  // Create 5 separate Supabase clients (simulating 5 scanners)
  const clients = GUEST_PASS_TOKENS.map(() =>
    createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false }
    })
  );

  const mainClient = clients[0];

  // Reset state
  if (!await resetTestState(mainClient)) {
    return false;
  }

  // Get pass IDs
  console.log('\n   Looking up pass IDs...');
  const passIdMap = await getPassIds(mainClient, GUEST_PASS_TOKENS);

  if (passIdMap.size !== GUEST_PASS_TOKENS.length) {
    console.error(`   Only found ${passIdMap.size}/${GUEST_PASS_TOKENS.length} passes`);
    return false;
  }
  console.log(`   Found ${passIdMap.size} passes`);

  // Run concurrent scans
  console.log('\n--- Running Concurrent First-Entry Scans ---');
  const results = await runConcurrentScans(clients, passIdMap, GUEST_PASS_TOKENS);

  // Print results
  console.log('\n   Results:');
  results.forEach((r, idx) => {
    const status = r.success ? '  ' : ' ';
    const detail = r.success
      ? (r.data?.entry_type || r.data?.scan_type || 'first_entry')
      : (r.error || 'failed');
    console.log(`   ${idx + 1}. ${r.token}: ${status} (${detail})`);
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n   Concurrent scans: ${successCount}/${results.length} succeeded`);

  // Verify database state
  console.log('\n--- Verification ---');
  const verification = await verifyResults(mainClient);

  console.log(`   checked_in_guests: ${verification.checkedInGuests} (expected: 5)`);
  console.log(`   scan_logs count: ${verification.scanLogCount} (expected: 5)`);
  console.log(`   duplicate logs: ${verification.duplicateLogs} (expected: 0)`);

  const passed =
    successCount === 5 &&
    verification.checkedInGuests === 5 &&
    verification.scanLogCount === 5 &&
    verification.duplicateLogs === 0;

  if (passed) {
    console.log('\n   FIRST-ENTRY TEST PASSED');
  } else {
    console.log('\n   FIRST-ENTRY TEST FAILED');
  }

  return passed;
}

/**
 * Run re-entry concurrency test
 */
async function runReentryTest(): Promise<boolean> {
  console.log('\n' + '='.repeat(60));
  console.log('RE-ENTRY CONCURRENCY TEST');
  console.log('='.repeat(60));

  const clients = GUEST_PASS_TOKENS.map(() =>
    createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false }
    })
  );

  const mainClient = clients[0];

  // Note: Don't reset state - use checked-in passes from first-entry test
  console.log('   Using checked-in passes from first-entry test');

  // Get pass IDs
  const passIdMap = await getPassIds(mainClient, GUEST_PASS_TOKENS);

  // Get current scan log count before re-entry
  const { data: beforeLogs } = await mainClient
    .from('vip_scan_logs')
    .select('id, pass_id')
    .in('pass_id', Array.from(passIdMap.values()));

  const beforeCount = beforeLogs?.length || 0;
  console.log(`   Scan logs before re-entry: ${beforeCount}`);

  // Run concurrent re-entry scans
  console.log('\n--- Running Concurrent Re-Entry Scans ---');
  const results = await runConcurrentScans(clients, passIdMap, GUEST_PASS_TOKENS);

  // Print results
  console.log('\n   Results:');
  results.forEach((r, idx) => {
    const status = r.success ? '  ' : ' ';
    const detail = r.success
      ? (r.data?.entry_type || r.data?.scan_type || 'reentry')
      : (r.error || 'failed');
    console.log(`   ${idx + 1}. ${r.token}: ${status} (${detail})`);
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n   Concurrent re-entries: ${successCount}/${results.length} succeeded`);

  // Verify database state
  console.log('\n--- Verification ---');

  // Get current scan log count after re-entry
  const { data: afterLogs } = await mainClient
    .from('vip_scan_logs')
    .select('id, pass_id, scan_type')
    .in('pass_id', Array.from(passIdMap.values()));

  const afterCount = afterLogs?.length || 0;
  const reentryLogs = afterLogs?.filter(l => l.scan_type === 'reentry').length || 0;

  console.log(`   Scan logs after re-entry: ${afterCount} (expected: 10)`);
  console.log(`   Re-entry type logs: ${reentryLogs} (expected: 5)`);

  // Check for duplicates (same pass_id with same scan_type)
  const logSignatures = new Set<string>();
  let duplicates = 0;
  afterLogs?.forEach(log => {
    const sig = `${log.pass_id}-${log.scan_type}`;
    if (logSignatures.has(sig)) {
      duplicates++;
    } else {
      logSignatures.add(sig);
    }
  });

  console.log(`   Duplicate entries: ${duplicates} (expected: 0)`);

  const passed =
    successCount === 5 &&
    afterCount === 10 &&
    reentryLogs === 5 &&
    duplicates === 0;

  if (passed) {
    console.log('\n   RE-ENTRY TEST PASSED');
  } else {
    console.log('\n   RE-ENTRY TEST FAILED');
  }

  return passed;
}

/**
 * Main test runner
 */
async function main() {
  console.log('='.repeat(60));
  console.log('VIP CONCURRENT CHECK-IN TEST');
  console.log('='.repeat(60));
  console.log(`Reservation: ${TEST_RESERVATION_ID}`);
  console.log(`Testing with ${GUEST_PASS_TOKENS.length} concurrent scanners`);

  let allPassed = true;

  // Run first-entry test
  const firstEntryPassed = await runFirstEntryTest();
  allPassed = allPassed && firstEntryPassed;

  // Run re-entry test (uses state from first-entry)
  const reentryPassed = await runReentryTest();
  allPassed = allPassed && reentryPassed;

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`First-Entry Test: ${firstEntryPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`Re-Entry Test: ${reentryPassed ? 'PASSED' : 'FAILED'}`);
  console.log('='.repeat(60));

  if (allPassed) {
    console.log('\nALL CONCURRENCY TESTS PASSED');
    console.log('No race conditions detected in VIP check-in flow.');
  } else {
    console.log('\nSOME TESTS FAILED');
    console.log('Check database state and RPC implementation.');
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
