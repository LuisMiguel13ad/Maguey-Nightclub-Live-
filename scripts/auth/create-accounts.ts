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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[ERROR] Missing Supabase credentials in .env file');
  console.log('\n[INFO] Required environment variables:');
  console.log('  VITE_SUPABASE_URL=your-supabase-url');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.log('\n[INFO] Get service role key from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface AccountConfig {
  email: string;
  password: string;
  role: 'owner' | 'employee';
  fullName: string;
}

const accounts: AccountConfig[] = [
  {
    email: 'info@magueynightclub.com',
    password: 'MagueyNightclub123',
    role: 'owner',
    fullName: 'Maguey Owner'
  },
  {
    email: 'Luismbadillo13@gmail.com',
    password: 'MagueyScanner123',
    role: 'employee',
    fullName: 'Scanner Staff'
  }
];

async function createOrUpdateAccount(account: AccountConfig): Promise<boolean> {
  const { email, password, role, fullName } = account;

  console.log(`\n[INFO] Processing account: ${email}`);
  console.log(`[INFO] Role: ${role}`);

  try {
    // Attempt to create the user
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email (no verification email needed)
      user_metadata: {
        role,
        full_name: fullName
      }
    });

    if (createError) {
      // Check if user already exists
      if (
        createError.message.includes('already registered') ||
        createError.message.includes('already exists') ||
        createError.message.includes('email address has already been registered')
      ) {
        console.log('[WARN] User already exists. Updating metadata...');

        // Get user by email
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
          console.error(`[ERROR] Failed to list users: ${listError.message}`);
          return false;
        }

        // Case-insensitive email matching
        const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (!existingUser) {
          console.error('[ERROR] User exists but could not be found in user list');
          console.error(`[ERROR] Searched for: ${email} (case-insensitive)`);
          return false;
        }

        console.log(`[INFO] Found existing user: ${existingUser.id}`);

        // Update user metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            user_metadata: {
              ...existingUser.user_metadata,
              role,
              full_name: fullName
            }
          }
        );

        if (updateError) {
          console.error(`[ERROR] Failed to update user: ${updateError.message}`);
          return false;
        }

        console.log(`[OK] Successfully updated ${email} with role: ${role}`);
        return true;
      }

      // Other error
      console.error(`[ERROR] Failed to create user: ${createError.message}`);
      return false;
    }

    if (!userData.user) {
      console.error('[ERROR] User creation failed - no user data returned');
      return false;
    }

    console.log(`[OK] Successfully created ${email} with role: ${role}`);
    return true;

  } catch (error: any) {
    console.error(`[ERROR] Unexpected error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('[INFO] Starting account provisioning...');
  console.log('[INFO] Target accounts: 2 (owner, employee)');

  let successCount = 0;
  let failCount = 0;

  for (const account of accounts) {
    const success = await createOrUpdateAccount(account);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log('[INFO] Account provisioning complete');
  console.log(`[INFO] Success: ${successCount}, Failed: ${failCount}`);
  console.log('========================================\n');

  if (failCount > 0) {
    console.log('[ERROR] Some accounts failed to provision');
    process.exit(1);
  }

  console.log('[OK] All accounts provisioned successfully');
  process.exit(0);
}

main();
