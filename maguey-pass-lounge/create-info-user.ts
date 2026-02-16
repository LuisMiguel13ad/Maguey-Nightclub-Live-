
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
    const email = 'info@magueynightclub.com';
    const password = 'FelixCeronPerez';

    console.log(`Attempting to create user: ${email}`);

    // Check if user exists first to avoid error
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
        console.log(`User ${email} already exists. ID: ${existingUser.id}`);

        // Optionally update password if needed, but for now just report existence
        const { data, error } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: password, email_confirm: true }
        );

        if (error) {
            console.error('Error updating existing user:', error);
        } else {
            console.log('Successfully updated existing user password and confirmed email.');
        }

        return;
    }

    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            full_name: 'Maguey Nightclub Info'
        }
    });

    if (error) {
        console.error('Error creating user:', error);
    } else {
        console.log(`Successfully created user: ${data.user.email} (ID: ${data.user.id})`);
    }
}

createAdminUser();
