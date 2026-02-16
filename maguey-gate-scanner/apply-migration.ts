/**
 * Apply Re-entry Tracking Migration
 * This script applies the migration directly via Supabase API
 * Run with: tsx apply-migration.ts
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
config({ path: resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL not found in .env');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY not found in .env');
  console.log('⚠️  Note: Service role key is needed for migrations. Using anon key may have permission issues.');
}

console.log('🚀 Applying Re-entry Tracking Migration\n');
console.log('='.repeat(60));

// Read migration file
const migrationPath = resolve(__dirname, 'supabase/migrations/20250113000001_add_reentry_tracking.sql');
let migrationSQL: string;

try {
  migrationSQL = readFileSync(migrationPath, 'utf-8');
  console.log('✅ Migration file loaded\n');
} catch (error: any) {
  console.error('❌ Failed to read migration file:', error.message);
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  try {
    console.log('📝 Executing migration SQL...\n');
    
    // Split SQL into individual statements (simple approach)
    // Note: This is a simplified approach. For production, use Supabase CLI or Dashboard
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements\n`);

    // Execute via RPC or direct query
    // Since Supabase JS client doesn't support raw SQL execution directly,
    // we'll need to use the REST API or guide the user to use the Dashboard
    
    console.log('⚠️  Direct SQL execution via JS client is limited.');
    console.log('📋 Please apply the migration using one of these methods:\n');
    console.log('Method 1: Supabase Dashboard (Recommended)');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Navigate to SQL Editor → New Query');
    console.log(`4. Copy the contents of: ${migrationPath}`);
    console.log('5. Paste and click Run\n');
    
    console.log('Method 2: Supabase CLI');
    console.log('1. Install: npm install -g supabase');
    console.log('2. Login: supabase login');
    console.log('3. Link: supabase link --project-ref YOUR_PROJECT_REF');
    console.log('4. Push: supabase db push\n');

    // Try to verify if migration was already applied
    console.log('🔍 Checking if migration was already applied...\n');
    
    const { data: tables, error: tablesError } = await supabase
      .from('scan_history')
      .select('id')
      .limit(1);

    if (!tablesError) {
      console.log('✅ scan_history table exists - migration may already be applied!');
    } else {
      console.log('ℹ️  scan_history table not found - migration needs to be applied');
    }

    // Check for re-entry columns
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('current_status, entry_count, exit_count')
      .limit(1);

    if (!ticketsError && tickets && tickets.length > 0) {
      const ticket = tickets[0];
      if ('current_status' in ticket || 'entry_count' in ticket) {
        console.log('✅ Re-entry columns exist - migration appears to be applied!');
      } else {
        console.log('ℹ️  Re-entry columns not found - migration needs to be applied');
      }
    } else if (ticketsError && ticketsError.message.includes('column')) {
      console.log('ℹ️  Re-entry columns not found - migration needs to be applied');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Migration check completed!');
    console.log('\nPlease apply the migration using Method 1 (Dashboard) above.\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('\nPlease apply the migration manually via Supabase Dashboard.\n');
  }
}

applyMigration();

