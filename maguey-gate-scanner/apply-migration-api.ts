/**
 * Apply Migration via Supabase Management API
 * Attempts to apply migration using Supabase API
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase credentials not found');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not extract project ref from URL');
  process.exit(1);
}

console.log('🚀 Applying Migration via Supabase API\n');
console.log(`Project: ${projectRef}`);
console.log('='.repeat(60));

// Read migration SQL
const migrationPath = resolve(__dirname, 'supabase/migrations/20250113000001_add_reentry_tracking.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

async function applyMigration() {
  try {
    // Use Supabase REST API to execute SQL
    // Note: This requires the SQL to be executed via RPC or direct API call
    // Supabase doesn't expose raw SQL execution via REST API for security
    
    // Alternative: Use pg REST API if available
    const sqlUrl = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
    
    // Split SQL into executable statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('comment'));
    
    console.log(`\n📝 Found ${statements.length} SQL statements\n`);
    
    // Try executing via PostgREST (won't work for DDL, but let's try)
    // Actually, Supabase doesn't allow DDL via REST API - need Dashboard or CLI
    
    console.log('⚠️  Supabase REST API does not support DDL (CREATE TABLE, ALTER TABLE) operations.');
    console.log('   These must be executed via:\n');
    console.log('   1. Supabase Dashboard SQL Editor');
    console.log('   2. Supabase CLI (supabase db push)');
    console.log('   3. Direct database connection (psql)\n');
    
    // However, we can try using the Management API if we have access
    // Or we can create a helper that uses the browser
    
    console.log('💡 Best approach: Use Supabase Dashboard\n');
    console.log('   I\'ll open the migration helper page for you...\n');
    
    // Return the SQL for manual application
    return migrationSQL;
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Since we can't execute DDL via REST API, let's verify what we can do
async function verifyAndGuide() {
  const sql = await applyMigration();
  
  console.log('='.repeat(60));
  console.log('\n📋 Migration SQL Ready:\n');
  console.log('-'.repeat(60));
  console.log(sql.substring(0, 500) + '...');
  console.log('-'.repeat(60));
  console.log(`\n📄 Full SQL available in: ${migrationPath}\n`);
  
  console.log('🔧 To apply this migration:\n');
  console.log('Option 1: Supabase Dashboard (Recommended)');
  console.log('   1. Open: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
  console.log('   2. Copy the SQL from the file above');
  console.log('   3. Paste and click Run\n');
  
  console.log('Option 2: Use the helper page');
  console.log('   Open: apply-migration.html in your browser\n');
  
  console.log('Option 3: Supabase CLI');
  console.log('   npm install -g supabase');
  console.log('   supabase login');
  console.log('   supabase link --project-ref ' + projectRef);
  console.log('   supabase db push\n');
}

verifyAndGuide().catch(console.error);

