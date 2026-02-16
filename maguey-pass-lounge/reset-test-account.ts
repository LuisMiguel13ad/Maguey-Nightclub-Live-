
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials (need SERVICE_ROLE_KEY in .env)');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const targetEmail = 'testcustomer@maguey.com';
const targetPassword = 'test1234';

async function resetPassword() {
  console.log(`🔄 Resetting password for ${targetEmail}...`);

  try {
    // 1. Find user
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users.find(u => u.email === targetEmail);

    if (!user) {
      console.log('⚠️ User not found. Creating new user...');
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: targetEmail,
        password: targetPassword,
        email_confirm: true,
        user_metadata: { first_name: 'Test', last_name: 'Customer' }
      });
      if (createError) throw createError;
      console.log('✅ User created successfully!');
    } else {
      console.log(`📝 User found (ID: ${user.id}). Updating password...`);
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: targetPassword, email_confirm: true }
      );
      if (updateError) throw updateError;
      console.log('✅ Password updated successfully!');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetPassword();

