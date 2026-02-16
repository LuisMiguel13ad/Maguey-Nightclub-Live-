
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

async function inspectAndUpdateUser() {
    const email = 'info@magueynightclub.com';

    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        console.error('User not found!');
        return;
    }

    console.log('Current User Data:');
    console.log('ID:', user.id);
    console.log('Role:', user.role);
    console.log('App Metadata:', user.app_metadata);
    console.log('User Metadata:', user.user_metadata);

    // Update app_metadata to include role: 'admin'
    // Also try to update the top-level role if possible (though often restricted)
    const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        {
            app_metadata: { ...user.app_metadata, role: 'admin' },
            user_metadata: { ...user.user_metadata, full_name: 'Maguey Nightclub Info' }
            // role: 'admin' // explicitly removed as it can cause issues if not supported by the client lib directly/server config
        }
    );

    if (error) {
        console.error('Error updating user:', error);
    } else {
        console.log('Successfully updated user metadata.');
        console.log('New App Metadata:', data.user.app_metadata);
    }
}

inspectAndUpdateUser();
