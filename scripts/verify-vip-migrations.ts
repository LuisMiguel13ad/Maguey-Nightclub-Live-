#!/usr/bin/env tsx
/**
 * VIP Migration Verification Script
 *
 * Verifies all 8 required VIP RPCs exist on remote Supabase database.
 * Exits with code 1 if any migrations missing, 0 if all present.
 *
 * Usage: npx tsx scripts/verify-vip-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';

const REQUIRED_RPCS = [
  'check_vip_linked_ticket_reentry',
  'process_vip_scan_with_reentry',
  'scan_ticket_atomic',
  'increment_vip_checked_in',
  'create_unified_vip_checkout',
  'verify_vip_pass_signature',
  'link_ticket_to_vip',
  'check_vip_capacity'
] as const;

interface VerificationResult {
  rpc: string;
  exists: boolean;
  error?: string;
}

async function verifyMigrations(): Promise<void> {
  // Read environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing required environment variables');
    console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🔍 Verifying VIP migrations on remote Supabase...\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Test each RPC for existence
  const results: VerificationResult[] = await Promise.all(
    REQUIRED_RPCS.map(async (rpcName) => {
      try {
        // Call with empty params - will error but confirms existence
        await supabase.rpc(rpcName as any, {});
        return { rpc: rpcName, exists: true };
      } catch (error: any) {
        // Parse error to determine if function exists
        const errorMessage = error.message || String(error);

        // "function does not exist" or "does not exist" = missing
        const functionMissing =
          errorMessage.toLowerCase().includes('function') &&
          errorMessage.toLowerCase().includes('does not exist');

        // If function exists, we'll get parameter errors instead
        const exists = !functionMissing;

        return {
          rpc: rpcName,
          exists,
          error: exists ? undefined : errorMessage
        };
      }
    })
  );

  // Separate existing and missing
  const existing = results.filter(r => r.exists);
  const missing = results.filter(r => !r.exists);

  // Output results
  if (existing.length > 0) {
    console.log('✅ Verified RPCs:');
    existing.forEach(r => console.log(`   ✓ ${r.rpc}`));
  }

  if (missing.length > 0) {
    console.log('\n❌ Missing VIP RPCs:');
    missing.forEach(r => {
      console.log(`   ✗ ${r.rpc}`);
      if (r.error) {
        console.log(`     Error: ${r.error}`);
      }
    });

    console.log('\n📝 To fix:');
    console.log('   1. cd maguey-pass-lounge');
    console.log('   2. supabase db push');
    console.log('   3. Re-run this script to verify\n');

    process.exit(1);
  }

  console.log(`\n✨ All ${REQUIRED_RPCS.length} VIP RPCs verified on remote database\n`);
  process.exit(0);
}

// Run verification
verifyMigrations().catch((error) => {
  console.error('\n❌ Verification failed:', error.message);
  process.exit(1);
});
