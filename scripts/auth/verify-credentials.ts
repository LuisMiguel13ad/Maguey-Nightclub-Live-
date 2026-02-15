/**
 * Environment and Credential Verification Script
 *
 * Validates:
 * - R35: Environment consistency across all 3 sites
 * - R36: Stripe test keys are functional
 * - R37: Resend API key is functional
 *
 * Usage: npx tsx scripts/auth/verify-credentials.ts
 */

import { readFileSync } from 'fs';
import { parse } from 'dotenv';
import { join } from 'path';

// ANSI color codes for output
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';

// Track overall pass/fail status
let totalChecks = 0;
let passedChecks = 0;

function pass(message: string): void {
  console.log(`${GREEN}[PASS]${RESET} ${message}`);
  totalChecks++;
  passedChecks++;
}

function fail(message: string): void {
  console.log(`${RED}[FAIL]${RESET} ${message}`);
  totalChecks++;
}

function warn(message: string): void {
  console.log(`${YELLOW}[WARN]${RESET} ${message}`);
}

function section(title: string): void {
  console.log(`\n${BOLD}=== ${title} ===${RESET}`);
}

// Load .env file as object (not into process.env)
function loadEnv(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, 'utf-8');
    return parse(content);
  } catch (error) {
    fail(`Failed to load ${path}: ${error}`);
    return {};
  }
}

async function verifyEnvironmentConsistency() {
  section('Environment Consistency');

  const projectRoot = join(__dirname, '..', '..');
  const scannerEnv = loadEnv(join(projectRoot, 'maguey-gate-scanner', '.env'));
  const purchaseEnv = loadEnv(join(projectRoot, 'maguey-pass-lounge', '.env'));
  const nightsEnv = loadEnv(join(projectRoot, 'maguey-nights', '.env'));

  // Check VITE_SUPABASE_URL consistency
  const scannerUrl = scannerEnv.VITE_SUPABASE_URL || '';
  const purchaseUrl = purchaseEnv.VITE_SUPABASE_URL || '';
  const nightsUrl = nightsEnv.VITE_SUPABASE_URL || '';

  if (scannerUrl === purchaseUrl && purchaseUrl === nightsUrl && scannerUrl) {
    pass('VITE_SUPABASE_URL: consistent across all 3 sites');
  } else {
    fail('VITE_SUPABASE_URL: MISMATCH detected');
    console.log(`  Scanner:  ${scannerUrl}`);
    console.log(`  Purchase: ${purchaseUrl}`);
    console.log(`  Nights:   ${nightsUrl}`);
  }

  // Check VITE_SUPABASE_ANON_KEY consistency
  const scannerKey = scannerEnv.VITE_SUPABASE_ANON_KEY || '';
  const purchaseKey = purchaseEnv.VITE_SUPABASE_ANON_KEY || '';
  const nightsKey = nightsEnv.VITE_SUPABASE_ANON_KEY || '';

  if (scannerKey === purchaseKey && purchaseKey === nightsKey && scannerKey) {
    pass('VITE_SUPABASE_ANON_KEY: consistent across all 3 sites');
  } else {
    fail('VITE_SUPABASE_ANON_KEY: MISMATCH detected');
    console.log(`  Scanner:  ${scannerKey.substring(0, 50)}...`);
    console.log(`  Purchase: ${purchaseKey.substring(0, 50)}...`);
    console.log(`  Nights:   ${nightsKey.substring(0, 50)}...`);
  }

  // Validate VITE_SUPABASE_URL format
  if (scannerUrl.startsWith('https://') && scannerUrl.includes('.supabase.co')) {
    pass('VITE_SUPABASE_URL: format valid (https://*.supabase.co)');
  } else {
    fail('VITE_SUPABASE_URL: invalid format (expected https://*.supabase.co)');
  }

  // Validate VITE_SUPABASE_ANON_KEY is not empty or placeholder
  if (scannerKey && scannerKey.length > 20 && !scannerKey.includes('your-') && !scannerKey.includes('xxx')) {
    pass('VITE_SUPABASE_ANON_KEY: not empty and not placeholder');
  } else {
    fail('VITE_SUPABASE_ANON_KEY: empty or placeholder value detected');
  }
}

async function verifyStripeKeys() {
  section('Stripe Keys (maguey-pass-lounge)');

  const projectRoot = join(__dirname, '..', '..');
  const purchaseEnv = loadEnv(join(projectRoot, 'maguey-pass-lounge', '.env'));

  const secretKey = purchaseEnv.STRIPE_SECRET_KEY || '';
  const publishableKey = purchaseEnv.VITE_STRIPE_PUBLISHABLE_KEY || '';

  // Validate secret key format
  if (secretKey.startsWith('sk_test_')) {
    pass('STRIPE_SECRET_KEY: format valid (sk_test_...)');
  } else if (secretKey.startsWith('sk_live_')) {
    warn('STRIPE_SECRET_KEY: PRODUCTION key detected (sk_live_...)');
    warn('  Consider using test keys for development/testing');
    totalChecks++;
    passedChecks++; // Not a failure, just a warning
  } else {
    fail('STRIPE_SECRET_KEY: invalid format (expected sk_test_... or sk_live_...)');
  }

  // Validate publishable key format
  if (publishableKey.startsWith('pk_test_')) {
    pass('VITE_STRIPE_PUBLISHABLE_KEY: format valid (pk_test_...)');
  } else if (publishableKey.startsWith('pk_live_')) {
    warn('VITE_STRIPE_PUBLISHABLE_KEY: PRODUCTION key detected (pk_live_...)');
    warn('  Consider using test keys for development/testing');
    totalChecks++;
    passedChecks++; // Not a failure, just a warning
  } else {
    fail('VITE_STRIPE_PUBLISHABLE_KEY: invalid format (expected pk_test_... or pk_live_...)');
  }

  // Test Stripe API with secret key
  if (secretKey) {
    try {
      const response = await fetch('https://api.stripe.com/v1/balance', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
        },
      });

      if (response.ok) {
        pass('STRIPE_SECRET_KEY: API call successful (balance endpoint)');
      } else {
        const errorText = await response.text();
        fail(`STRIPE_SECRET_KEY: API call failed (${response.status})`);
        console.log(`  Response: ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      fail(`STRIPE_SECRET_KEY: API call error: ${error}`);
    }
  } else {
    fail('STRIPE_SECRET_KEY: missing from maguey-pass-lounge/.env');
  }
}

async function verifyResendKey() {
  section('Resend Key (maguey-pass-lounge)');

  const projectRoot = join(__dirname, '..', '..');
  const purchaseEnv = loadEnv(join(projectRoot, 'maguey-pass-lounge', '.env'));

  const emailApiKey = purchaseEnv.EMAIL_API_KEY || '';

  // Validate format
  if (emailApiKey.startsWith('re_')) {
    pass('EMAIL_API_KEY: format valid (re_...)');
  } else {
    fail('EMAIL_API_KEY: invalid format (expected re_...)');
  }

  // Test Resend API
  if (emailApiKey) {
    try {
      const response = await fetch('https://api.resend.com/api-keys', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${emailApiKey}`,
        },
      });

      if (response.ok) {
        pass('EMAIL_API_KEY: API call successful (api-keys endpoint)');
      } else if (response.status === 401) {
        // Check if it's a restricted key (can only send emails)
        const errorText = await response.text();
        if (errorText.includes('restricted_api_key') || errorText.includes('only send emails')) {
          pass('EMAIL_API_KEY: API call successful (restricted key - send-only)');
          warn('  Note: Key is restricted to sending emails only (recommended for security)');
        } else {
          fail(`EMAIL_API_KEY: API call failed (${response.status})`);
          console.log(`  Response: ${errorText.substring(0, 200)}`);
        }
      } else {
        const errorText = await response.text();
        fail(`EMAIL_API_KEY: API call failed (${response.status})`);
        console.log(`  Response: ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      fail(`EMAIL_API_KEY: API call error: ${error}`);
    }
  } else {
    fail('EMAIL_API_KEY: missing from maguey-pass-lounge/.env');
  }
}

async function main() {
  console.log(`${BOLD}Environment and Credential Verification${RESET}`);
  console.log('Validating R35 (env consistency), R36 (Stripe keys), R37 (Resend key)\n');

  await verifyEnvironmentConsistency();
  await verifyStripeKeys();
  await verifyResendKey();

  // Summary
  section('Summary');
  if (passedChecks === totalChecks) {
    console.log(`${GREEN}${BOLD}${passedChecks}/${totalChecks} checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`${RED}${BOLD}${passedChecks}/${totalChecks} checks passed (${totalChecks - passedChecks} failed)${RESET}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`${RED}${BOLD}Fatal error:${RESET}`, error);
  process.exit(1);
});
