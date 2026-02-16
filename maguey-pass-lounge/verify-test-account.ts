// Verify test customer account exists and can log in
// Run with: npx tsx verify-test-account.ts

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TEST_EMAIL = 'testcustomer@maguey.com';
const TEST_PASSWORD = 'test1234';

async function verifyTestAccount() {
  console.log('\n🔍 Verifying Test Account...\n');
  console.log(`Email: ${TEST_EMAIL}`);
  console.log(`Password: ${TEST_PASSWORD}\n`);

  try {
    // Try to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (error) {
      console.error('❌ Sign in failed:', error.message);
      
      if (error.message.includes('Invalid login credentials')) {
        console.log('\n⚠️  Account may not exist or password is incorrect.');
        console.log('   Creating account...\n');
        
        // Try to create account
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          options: {
            data: {
              first_name: 'Test',
              last_name: 'Customer',
            },
            emailRedirectTo: `${process.env.VITE_APP_URL || 'http://localhost:5173'}/account`,
          },
        });

        if (signUpError) {
          console.error('❌ Failed to create account:', signUpError.message);
          console.log('\n📋 Please create account manually:');
          console.log('   1. Go to: http://localhost:5173/signup');
          console.log(`   2. Email: ${TEST_EMAIL}`);
          console.log(`   3. Password: ${TEST_PASSWORD}`);
          process.exit(1);
        }

        console.log('✅ Account created!');
        if (!signUpData.session) {
          console.log('⚠️  Email confirmation may be required.');
          console.log('   Confirm in Supabase Dashboard → Authentication → Users\n');
        }
      } else if (error.message.includes('Email not confirmed')) {
        console.log('\n⚠️  Email not confirmed.');
        console.log('   Please confirm in Supabase Dashboard → Authentication → Users');
        console.log(`   Find user: ${TEST_EMAIL}`);
        console.log('   Click ⋯ → Confirm Email\n');
      }
      
      process.exit(1);
    }

    if (data.user && data.session) {
      console.log('✅ Account verified and ready!');
      console.log(`   User ID: ${data.user.id}`);
      console.log(`   Email: ${data.user.email}`);
      console.log(`   Confirmed: ${data.user.email_confirmed_at ? 'Yes' : 'No'}\n`);
      
      // Check for tickets
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, ticket_id, event_name, ticket_type')
        .eq('attendee_email', TEST_EMAIL)
        .limit(5);

      if (!ticketsError && tickets && tickets.length > 0) {
        console.log(`🎫 Found ${tickets.length} ticket(s):`);
        tickets.forEach((ticket, i) => {
          console.log(`   ${i + 1}. ${ticket.event_name} - ${ticket.ticket_type}`);
        });
        console.log('');
      } else {
        console.log('⚠️  No tickets found for this account.');
        console.log('   Purchase tickets to test QR code viewing.\n');
      }

      // Sign out
      await supabase.auth.signOut();
      console.log('✅ Test account is ready for quick login!\n');
    }
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

verifyTestAccount()
  .then(() => {
    console.log('✅ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

