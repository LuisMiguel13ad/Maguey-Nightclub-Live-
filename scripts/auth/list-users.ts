import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../../maguey-gate-scanner/.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function main() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Total users:', users.length);
    users.forEach(u => {
      console.log('\n---');
      console.log('Email:', u.email);
      console.log('ID:', u.id);
      console.log('Metadata:', JSON.stringify(u.user_metadata, null, 2));
    });
  }
}

main();
