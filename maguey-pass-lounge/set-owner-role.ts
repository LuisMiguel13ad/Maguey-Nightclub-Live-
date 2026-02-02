
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setOwnerRole() {
    const email = 'info@magueynightclub.com';

    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.error(`User ${email} not found!`);
        return;
    }

    console.log(`Found user: ${user.email} (${user.id})`);
    console.log('Current User Metadata:', user.user_metadata);

    // Update user_metadata as requested by the user
    const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        {
            user_metadata: {
                ...user.user_metadata,
                role: 'owner'
            },
            // Also updating app_metadata just in case, as it's a common pattern in Supabase
            app_metadata: {
                ...user.app_metadata,
                role: 'owner'
            }
        }
    );

    if (error) {
        console.error('Error updating user:', error);
    } else {
        console.log('Successfully updated user role to "owner".');
        console.log('New User Metadata:', data.user.user_metadata);
        console.log('New App Metadata:', data.user.app_metadata);
    }
}

setOwnerRole();
