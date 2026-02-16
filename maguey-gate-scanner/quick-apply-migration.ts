/**
 * Quick Migration Application Script
 * Provides the SQL and attempts to apply via available methods
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase credentials not found');
  process.exit(1);
}

const migrationPath = resolve(__dirname, 'supabase/migrations/20250113000001_add_reentry_tracking.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

console.log('\n🚀 Quick Migration Application\n');
console.log('='.repeat(70));

// Extract project ref
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unknown';

console.log(`\n📋 Project: ${projectRef}`);
console.log(`📋 URL: ${SUPABASE_URL}\n`);

// Try to apply via a database function if one exists
async function tryApplyMigration() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  // Check if migration was already applied
  console.log('🔍 Checking current migration status...\n');
  
  const { error: scanError } = await supabase
    .from('scan_history')
    .select('id')
    .limit(1);
  
  if (!scanError) {
    console.log('✅ Migration already applied! scan_history table exists.\n');
    return true;
  }
  
  console.log('ℹ️  Migration not yet applied.\n');
  return false;
}

async function main() {
  const alreadyApplied = await tryApplyMigration();
  
  if (alreadyApplied) {
    console.log('✅ Migration is already applied! Running verification tests...\n');
    // Run tests
    const { exec } = await import('child_process');
    return new Promise((resolve) => {
      exec('npx tsx test-all-features.ts', (error, stdout, stderr) => {
        console.log(stdout);
        if (stderr) console.error(stderr);
        resolve(undefined);
      });
    });
  }
  
  console.log('='.repeat(70));
  console.log('\n📝 To apply the migration, use one of these methods:\n');
  
  console.log('Method 1: Supabase Dashboard (Easiest)');
  console.log('─'.repeat(70));
  console.log(`1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('2. Copy the SQL below');
  console.log('3. Paste into the SQL Editor');
  console.log('4. Click "Run" button\n');
  
  console.log('Method 2: Copy SQL to Clipboard');
  console.log('─'.repeat(70));
  console.log('The SQL is ready in your clipboard (if on macOS) or copy from below:\n');
  
  // Try to copy to clipboard on macOS
  try {
    const { execSync } = await import('child_process');
    execSync(`echo "${migrationSQL.replace(/"/g, '\\"')}" | pbcopy`);
    console.log('✅ SQL copied to clipboard!\n');
  } catch (e) {
    console.log('📋 SQL to copy:\n');
  }
  
  console.log('─'.repeat(70));
  console.log(migrationSQL);
  console.log('─'.repeat(70));
  
  console.log('\n💡 After applying, run: npx tsx test-all-features.ts\n');
}

main().catch(console.error);

