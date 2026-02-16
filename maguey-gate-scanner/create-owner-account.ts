// create-owner-account.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // You'll need to get this from Supabase Dashboard

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('\n📝 Add these to your .env file:');
  console.log('VITE_SUPABASE_URL=your-supabase-url');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.log('\n💡 Get service role key from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createOwnerAccount() {
  const email = 'owner@maguey.club';
  const password = 'Owner123!'; // Change this to your preferred password
  const fullName = 'Owner Account';

  console.log('🚀 Creating owner account...');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);

  try {
    // Create the user
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: 'owner',
        full_name: fullName
      }
    });

    if (createError) {
      // If user already exists, try to update their role
      if (createError.message.includes('already registered') || 
          createError.message.includes('already exists') ||
          createError.message.includes('email address has already been registered')) {
        console.log('⚠️  User already exists. Updating role to owner...');
        
        // Get user by email
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
          console.error('Error listing users:', listError.message);
          throw listError;
        }
        
        const existingUser = users?.find(u => u.email === email);
        
        if (existingUser) {
          console.log(`📝 Found existing user: ${existingUser.id}`);
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            {
              user_metadata: {
                ...existingUser.user_metadata,
                role: 'owner'
              }
            }
          );

          if (updateError) {
            console.error('Error updating user:', updateError.message);
            throw updateError;
          }

          console.log('✅ Successfully updated existing user to owner role!');
          console.log(`\n📋 Login Credentials:`);
          console.log(`   Email: ${email}`);
          console.log(`   Password: ${password}`);
          console.log(`\n🌐 Go to: http://localhost:5173/auth (or your app URL)`);
          return;
        } else {
          console.error('❌ User exists but could not be found in user list');
        }
      }
      throw createError;
    }

    if (!userData.user) {
      throw new Error('User creation failed - no user data returned');
    }

    console.log('✅ Owner account created successfully!');
    console.log(`\n📋 Login Credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`\n🌐 Go to: http://localhost:5173/auth (or your app URL)`);
    
  } catch (error: any) {
    console.error('❌ Error creating owner account:', error.message);
    console.log('\n💡 Alternative: Use Supabase Dashboard method (see instructions)');
  }
}

createOwnerAccount();

