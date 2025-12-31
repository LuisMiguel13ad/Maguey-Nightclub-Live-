/**
 * Apply Migration via Supabase REST API
 * This attempts to apply the migration using Supabase's REST API
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL not found');
  process.exit(1);
}

// Read migration SQL
const migrationPath = resolve(__dirname, 'supabase/migrations/20250113000001_add_reentry_tracking.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

console.log('🚀 Applying Migration via Supabase API\n');
console.log('='.repeat(60));

async function applyMigration() {
  try {
    // Supabase doesn't expose raw SQL execution via REST API for security reasons
    // We need to use the Management API or SQL Editor
    
    console.log('📋 Migration SQL prepared');
    console.log('\n⚠️  Supabase JS client cannot execute raw SQL directly.');
    console.log('   This is a security feature - SQL must be executed via:');
    console.log('   1. Supabase Dashboard SQL Editor (Recommended)');
    console.log('   2. Supabase CLI');
    console.log('   3. Management API (requires service role key)\n');
    
    // Try to use Management API if service key is available
    if (SUPABASE_SERVICE_KEY) {
      console.log('🔑 Service role key found - attempting via Management API...\n');
      
      // Extract project ref from URL
      const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      
      if (projectRef) {
        const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
        
        // Split SQL into statements and execute one by one
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));
        
        console.log(`Found ${statements.length} SQL statements to execute\n`);
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (!statement) continue;
          
          try {
            const response = await fetch(managementUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: statement + ';',
              }),
            });
            
            if (response.ok) {
              console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
            } else {
              const error = await response.text();
              console.log(`⚠️  Statement ${i + 1} may have failed: ${error.substring(0, 100)}`);
            }
          } catch (error: any) {
            console.log(`⚠️  Statement ${i + 1} error: ${error.message}`);
          }
        }
        
        console.log('\n✅ Migration execution attempted');
        console.log('   Please verify in Supabase Dashboard\n');
      }
    } else {
      console.log('📝 To apply migration manually:\n');
      console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
      console.log('2. Select your project');
      console.log('3. Go to SQL Editor → New Query');
      console.log('4. Copy and paste the following SQL:\n');
      console.log('-'.repeat(60));
      console.log(migrationSQL);
      console.log('-'.repeat(60));
    }
    
    // Verify migration
    console.log('\n🔍 Verifying migration...\n');
    await verifyMigration();
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Please apply migration manually via Supabase Dashboard\n');
  }
}

async function verifyMigration() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  
  // Check scan_history table
  const { error: scanError } = await supabase
    .from('scan_history')
    .select('id')
    .limit(1);
  
  if (!scanError) {
    console.log('✅ scan_history table exists');
  } else {
    console.log('❌ scan_history table not found - migration not applied');
  }
  
  // Check re-entry columns
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('current_status')
    .limit(1);
  
  if (!ticketsError && tickets) {
    console.log('✅ Re-entry columns exist in tickets table');
  } else {
    console.log('❌ Re-entry columns not found - migration not applied');
  }
}

applyMigration();

