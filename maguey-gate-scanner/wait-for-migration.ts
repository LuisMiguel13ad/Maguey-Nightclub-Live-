/**
 * Wait for Migration to be Applied
 * Polls the database to check if migration was applied
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMigration() {
  try {
    // Check scan_history table
    const { error: scanError } = await supabase
      .from('scan_history')
      .select('id')
      .limit(1);
    
    if (scanError) {
      return { applied: false, error: scanError.message };
    }
    
    // Check re-entry columns
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('current_status, entry_count, exit_count')
      .limit(1);
    
    if (ticketsError) {
      return { applied: false, error: ticketsError.message };
    }
    
    return { applied: true };
  } catch (error: any) {
    return { applied: false, error: error.message };
  }
}

async function waitForMigration() {
  console.log('⏳ Waiting for migration to be applied...\n');
  console.log('💡 Make sure you\'ve pasted and run the SQL in Supabase Dashboard\n');
  console.log('   URL: https://supabase.com/dashboard/project/djbzjasdrwvbsoifxqzd/sql/new\n');
  
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max
  
  while (attempts < maxAttempts) {
    const result = await checkMigration();
    
    if (result.applied) {
      console.log('\n✅ Migration applied successfully!\n');
      console.log('Running comprehensive tests...\n');
      console.log('='.repeat(60));
      
      // Run full test suite
      const { exec } = await import('child_process');
      return new Promise((resolve) => {
        exec('npx tsx test-all-features.ts', (error, stdout, stderr) => {
          console.log(stdout);
          if (stderr && !stderr.includes('localStorage')) {
            console.error(stderr);
          }
          resolve(undefined);
        });
      });
    }
    
    attempts++;
    process.stdout.write(`\r⏳ Checking... (${attempts}/${maxAttempts}) - ${result.error || 'Migration not applied yet'}`);
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  }
  
  console.log('\n\n⏱️  Timeout waiting for migration.');
  console.log('Please make sure you\'ve applied the migration in Supabase Dashboard.\n');
}

waitForMigration().catch(console.error);

