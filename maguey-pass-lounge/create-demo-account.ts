// Script to create demo account for ticket purchase site
// Run with: npx tsx create-demo-account.ts

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Use service role key for admin operations if available
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

const DEMO_EMAIL = 'demo@maguey.com';
const DEMO_PASSWORD = 'demo1234';

async function createDemoAccount() {
  console.log('\n🔐 Creating Demo Account...\n');
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}\n`);

  try {
    // Try to sign up
    const { data, error } = await supabase.auth.signUp({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      options: {
        data: {
          first_name: 'Demo',
          last_name: 'User',
        },
        emailRedirectTo: `${process.env.VITE_APP_URL || 'http://localhost:5173'}/account`,
      },
    });

    if (error) {
      // If user already exists, try to sign in
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        console.log('⚠️  Account already exists. Attempting to sign in...\n');
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        });

        if (signInError) {
          console.error('❌ Sign in failed:', signInError.message);
          console.log('\n📋 Options:');
          console.log('1. Reset password in Supabase Dashboard → Authentication → Users');
          console.log('2. Create account via signup page: http://localhost:5173/signup');
          console.log('3. Use a different email address');
          process.exit(1);
        } else {
          console.log('✅ Account exists and password is correct!');
          console.log('   You can now log in with:');
          console.log(`   Email: ${DEMO_EMAIL}`);
          console.log(`   Password: ${DEMO_PASSWORD}\n`);
          return;
        }
      } else {
        throw error;
      }
    }

    if (data.user) {
      console.log('✅ Account created successfully!');
      console.log(`   User ID: ${data.user.id}`);
      
      // Try to confirm email using admin API if service key is available
      if (!data.session && supabaseAdmin) {
        console.log('\n🔐 Confirming email using admin API...');
        try {
          const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            data.user.id,
            { email_confirm: true }
          );
          
          if (updateError) {
            console.log('⚠️  Could not auto-confirm email:', updateError.message);
            console.log('   Please confirm manually in Supabase Dashboard → Authentication → Users\n');
          } else {
            console.log('✅ Email confirmed! Account is ready to use.\n');
          }
        } catch (err: any) {
          console.log('⚠️  Could not auto-confirm email:', err.message);
          console.log('   Please confirm manually in Supabase Dashboard → Authentication → Users\n');
        }
      } else if (!data.session) {
        console.log('\n⚠️  Note: Email confirmation may be required.');
        console.log('   Check your email or disable email confirmation in Supabase Dashboard.');
        console.log('   Or manually confirm the user in Supabase Dashboard → Authentication → Users\n');
      } else {
        console.log('✅ Account confirmed and ready to use!\n');
      }
      
      console.log('📋 Login Credentials:');
      console.log(`   Email: ${DEMO_EMAIL}`);
      console.log(`   Password: ${DEMO_PASSWORD}\n`);
    }
  } catch (error: any) {
    console.error('❌ Error creating account:', error.message);
    console.log('\n📋 Alternative Options:');
    console.log('1. Create account via signup page: http://localhost:5173/signup');
    console.log('2. Create account in Supabase Dashboard → Authentication → Users');
    console.log('3. Use a different email address\n');
    process.exit(1);
  }
}

createDemoAccount()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });

