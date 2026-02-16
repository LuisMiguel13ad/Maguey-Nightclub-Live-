import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://djbzjasdrwvbsoifxqzd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDA5ODAsImV4cCI6MjA3ODM3Njk4MH0.q5nWNWKpAkTmIWf_hbxINpyzUENySwjulQw1h3c5Xws'
)

async function checkRLS() {
  console.log('🔍 Checking RLS Policies...\n')
  
  // Test 1: Query without authentication (anon key only)
  console.log('1️⃣ Testing with ANON key (no user login)...')
  const { data: anonData, error: anonError } = await supabase
    .from('tickets')
    .select('ticket_id')
    .eq('ticket_id', 'MGY-1B-20251112-FCA98E4B-V2RL')
    .maybeSingle()
  
  if (anonError) {
    console.log('   ❌ Error:', anonError.message)
  } else if (anonData) {
    console.log('   ✅ CAN read tickets without login')
  } else {
    console.log('   ⚠️  Query returned NULL (RLS might be blocking)')
  }
  
  // Test 2: Try to get ALL tickets (to see if RLS is active)
  console.log('\n2️⃣ Testing to read ALL tickets...')
  const { data: allTickets, error: allError } = await supabase
    .from('tickets')
    .select('count')
  
  if (allError) {
    console.log('   ❌ Error:', allError.message)
  } else {
    console.log('   Result:', allTickets)
  }
  
  // Test 3: Check if RLS is enabled
  console.log('\n3️⃣ Checking RLS status on tickets table...')
  const { data: tables } = await supabase
    .from('pg_tables')
    .select('*')
    .eq('tablename', 'tickets')
  
  console.log('   Tables:', tables)
  
  console.log('\n━'.repeat(30))
  console.log('🎯 DIAGNOSIS:')
  console.log('If query returned NULL, RLS is blocking anonymous access.')
  console.log('You need to add an RLS policy to allow employees to read tickets.')
  console.log('━'.repeat(30))
}

checkRLS()

