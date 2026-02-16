import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load scanner site .env
config({ path: resolve(__dirname, '.env') });

const scannerSupabaseUrl = process.env.VITE_SUPABASE_URL;
const scannerSupabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Testing Site Connections...\n');
console.log('='.repeat(70));

// Test Scanner Site Connection
console.log('📊 Scanner Site (Dashboard):\n');
if (!scannerSupabaseUrl || !scannerSupabaseKey) {
  console.log('❌ Missing Supabase credentials in scanner site');
} else {
  console.log(`✅ Supabase URL: ${scannerSupabaseUrl.substring(0, 30)}...`);
  console.log(`✅ Supabase Key: ${scannerSupabaseKey.substring(0, 20)}...`);
  
  const scannerSupabase = createClient(scannerSupabaseUrl, scannerSupabaseKey);
  
  const { data: scannerEvents, error: scannerError } = await scannerSupabase
    .from('events')
    .select('id, name, status, event_date')
    .eq('name', 'PRE THANKSGIVING BASH')
    .single();
  
  if (scannerError) {
    console.log(`❌ Query failed: ${scannerError.message}`);
  } else {
    console.log(`✅ Event found: ${scannerEvents?.name}`);
    console.log(`   Status: ${scannerEvents?.status}`);
    console.log(`   Date: ${scannerEvents?.event_date}`);
  }
}

console.log('\n' + '='.repeat(70));

// Try to read Main Website .env
console.log('📊 Main Website (maguey-nights):\n');
try {
  const mainEnvPath = resolve(__dirname, '../maguey-nights/.env');
  const mainEnvContent = readFileSync(mainEnvPath, 'utf-8');
  const mainEnvLines = mainEnvContent.split('\n');
  
  let mainSupabaseUrl = '';
  let mainSupabaseKey = '';
  
  mainEnvLines.forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
      mainSupabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      mainSupabaseKey = line.split('=')[1].trim();
    }
  });
  
  if (!mainSupabaseUrl || !mainSupabaseKey) {
    console.log('❌ Missing Supabase credentials in main website');
    console.log('   Check: maguey-nights/.env file');
  } else {
    console.log(`✅ Supabase URL: ${mainSupabaseUrl.substring(0, 30)}...`);
    console.log(`✅ Supabase Key: ${mainSupabaseKey.substring(0, 20)}...`);
    
    // Check if same database
    if (mainSupabaseUrl === scannerSupabaseUrl) {
      console.log('✅ Connected to SAME database as Scanner Site');
    } else {
      console.log('❌ Connected to DIFFERENT database than Scanner Site!');
      console.log('   This is why events don\'t sync!');
    }
    
    const mainSupabase = createClient(mainSupabaseUrl, mainSupabaseKey);
    
    const today = new Date().toISOString().split('T')[0];
    const { data: mainEvents, error: mainError } = await mainSupabase
      .from('events')
      .select('id, name, status, event_date')
      .eq('status', 'published')
      .eq('is_active', true)
      .gte('event_date', today)
      .order('event_date', { ascending: true });
    
    if (mainError) {
      console.log(`❌ Query failed: ${mainError.message}`);
      console.log(`   Error code: ${mainError.code}`);
    } else {
      console.log(`✅ Query successful: Found ${mainEvents?.length || 0} events`);
      const thanksgivingEvent = mainEvents?.find((e: any) => e.name === 'PRE THANKSGIVING BASH');
      if (thanksgivingEvent) {
        console.log(`✅ PRE THANKSGIVING BASH found in query results!`);
      } else {
        console.log(`❌ PRE THANKSGIVING BASH NOT in query results`);
        console.log(`   Events found: ${mainEvents?.map((e: any) => e.name).join(', ')}`);
      }
    }
  }
} catch (error: any) {
  console.log('❌ Could not read main website .env file');
  console.log(`   Error: ${error.message}`);
  console.log('   File path: ../maguey-nights/.env');
}

console.log('\n' + '='.repeat(70));

// Try to read Purchase Website .env
console.log('📊 Purchase Website (maguey-pass-lounge):\n');
try {
  const purchaseEnvPath = resolve(__dirname, '../maguey-pass-lounge/.env');
  const purchaseEnvContent = readFileSync(purchaseEnvPath, 'utf-8');
  const purchaseEnvLines = purchaseEnvContent.split('\n');
  
  let purchaseSupabaseUrl = '';
  let purchaseSupabaseKey = '';
  
  purchaseEnvLines.forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
      purchaseSupabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      purchaseSupabaseKey = line.split('=')[1].trim();
    }
  });
  
  if (!purchaseSupabaseUrl || !purchaseSupabaseKey) {
    console.log('❌ Missing Supabase credentials in purchase website');
    console.log('   Check: maguey-pass-lounge/.env file');
  } else {
    console.log(`✅ Supabase URL: ${purchaseSupabaseUrl.substring(0, 30)}...`);
    console.log(`✅ Supabase Key: ${purchaseSupabaseKey.substring(0, 20)}...`);
    
    // Check if same database
    if (purchaseSupabaseUrl === scannerSupabaseUrl) {
      console.log('✅ Connected to SAME database as Scanner Site');
    } else {
      console.log('❌ Connected to DIFFERENT database than Scanner Site!');
      console.log('   This is why events don\'t sync!');
    }
    
    const purchaseSupabase = createClient(purchaseSupabaseUrl, purchaseSupabaseKey);
    
    const today = new Date().toISOString().split('T')[0];
    const { data: purchaseEvents, error: purchaseError } = await purchaseSupabase
      .from('events')
      .select('id, name, status, event_date')
      .eq('status', 'published')
      .eq('is_active', true)
      .gte('event_date', today)
      .order('event_date', { ascending: true });
    
    if (purchaseError) {
      console.log(`❌ Query failed: ${purchaseError.message}`);
      console.log(`   Error code: ${purchaseError.code}`);
    } else {
      console.log(`✅ Query successful: Found ${purchaseEvents?.length || 0} events`);
      const thanksgivingEvent = purchaseEvents?.find((e: any) => e.name === 'PRE THANKSGIVING BASH');
      if (thanksgivingEvent) {
        console.log(`✅ PRE THANKSGIVING BASH found in query results!`);
      } else {
        console.log(`❌ PRE THANKSGIVING BASH NOT in query results`);
        if (purchaseEvents && purchaseEvents.length > 0) {
          console.log(`   Events found: ${purchaseEvents.slice(0, 5).map((e: any) => e.name).join(', ')}...`);
        }
      }
    }
  }
} catch (error: any) {
  console.log('❌ Could not read purchase website .env file');
  console.log(`   Error: ${error.message}`);
  console.log('   File path: ../maguey-pass-lounge/.env');
}

console.log('\n' + '='.repeat(70));
console.log('💡 Next Steps:\n');
console.log('1. Verify all sites use the SAME Supabase URL');
console.log('2. Check .env files exist in each project folder');
console.log('3. Restart development servers after changing .env files');
console.log('4. Hard refresh browser pages (Cmd+Shift+R)');

