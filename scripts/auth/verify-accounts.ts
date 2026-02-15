import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from maguey-gate-scanner
config({ path: resolve(__dirname, '../../maguey-gate-scanner/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('[ERROR] Missing Supabase credentials in .env file');
  console.log('\n[INFO] Required environment variables:');
  console.log('  VITE_SUPABASE_URL=your-supabase-url');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.log('  VITE_SUPABASE_ANON_KEY=your-anon-key');
  process.exit(1);
}

// Admin client for user listing
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Anon client for sign-in testing
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

interface ExpectedAccount {
  email: string;
  password: string;
  expectedRole: 'owner' | 'employee';
}

const expectedAccounts: ExpectedAccount[] = [
  {
    email: 'info@magueynightclub.com',
    password: 'MagueyNightclub123',
    expectedRole: 'owner'
  },
  {
    email: 'Luismbadillo13@gmail.com',
    password: 'MagueyScanner123',
    expectedRole: 'employee'
  }
];

interface VerificationResult {
  email: string;
  exists: boolean;
  confirmed: boolean;
  role: string | null;
  roleCorrect: boolean;
  canSignIn: boolean;
  signInError?: string;
}

async function verifyAccount(account: ExpectedAccount): Promise<VerificationResult> {
  const { email, password, expectedRole } = account;

  const result: VerificationResult = {
    email,
    exists: false,
    confirmed: false,
    role: null,
    roleCorrect: false,
    canSignIn: false
  };

  try {
    // 1. Get all users via admin API
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error(`[ERROR] Failed to list users: ${listError.message}`);
      return result;
    }

    // 2. Find user (case-insensitive)
    const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return result;
    }

    result.exists = true;

    // 3. Check if email is confirmed
    result.confirmed = !!user.email_confirmed_at;

    // 4. Check role in user_metadata
    const actualRole = user.user_metadata?.role;
    result.role = actualRole || null;
    result.roleCorrect = actualRole === expectedRole;

    // 5. Test sign-in with anon client
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      result.signInError = signInError.message;
    } else if (signInData.user) {
      result.canSignIn = true;
      // Sign out immediately to clean up
      await anonClient.auth.signOut();
    }

  } catch (error: any) {
    console.error(`[ERROR] Unexpected error verifying ${email}: ${error.message}`);
  }

  return result;
}

function formatResult(result: VerificationResult): string {
  const exists = result.exists ? '[PASS]' : '[FAIL]';
  const confirmed = result.confirmed ? '[PASS]' : '[FAIL]';
  const role = result.roleCorrect ? `[PASS] ${result.role}` : `[FAIL] ${result.role || 'none'}`;
  const signIn = result.canSignIn ? '[PASS]' : `[FAIL] ${result.signInError || 'unknown'}`;

  return `${exists} | ${confirmed} | ${role} | ${signIn}`;
}

async function main() {
  console.log('[INFO] Starting account verification...\n');

  const results: VerificationResult[] = [];

  for (const account of expectedAccounts) {
    console.log(`[INFO] Verifying: ${account.email}`);
    const result = await verifyAccount(account);
    results.push(result);
  }

  console.log('\n========================================');
  console.log('ACCOUNT VERIFICATION SUMMARY');
  console.log('========================================\n');

  console.log('Email                        | Exists | Confirmed | Role | Sign In');
  console.log('---------------------------- | ------ | --------- | ---- | -------');

  let allPassed = true;

  for (const result of results) {
    const emailPadded = result.email.padEnd(28, ' ');
    console.log(`${emailPadded} | ${formatResult(result)}`);

    if (!result.exists || !result.confirmed || !result.roleCorrect || !result.canSignIn) {
      allPassed = false;
    }
  }

  console.log('\n========================================\n');

  if (allPassed) {
    console.log('[PASS] All accounts verified successfully');
    console.log('[OK] Both accounts exist with correct roles and can sign in\n');
    process.exit(0);
  } else {
    console.log('[FAIL] Account verification failed');
    console.log('[ERROR] One or more checks did not pass\n');

    // Provide detailed failure information
    for (const result of results) {
      if (!result.exists || !result.confirmed || !result.roleCorrect || !result.canSignIn) {
        console.log(`\n[FAIL] ${result.email}:`);
        if (!result.exists) console.log('  - Account does not exist');
        if (result.exists && !result.confirmed) console.log('  - Email not confirmed');
        if (result.exists && !result.roleCorrect) {
          console.log(`  - Role incorrect (expected: ${expectedAccounts.find(a => a.email.toLowerCase() === result.email.toLowerCase())?.expectedRole}, got: ${result.role || 'none'})`);
        }
        if (result.exists && !result.canSignIn) {
          console.log(`  - Cannot sign in: ${result.signInError || 'unknown error'}`);
        }
      }
    }

    console.log('\n');
    process.exit(1);
  }
}

main();
