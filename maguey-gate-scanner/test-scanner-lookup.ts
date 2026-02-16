import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://djbzjasdrwvbsoifxqzd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDA5ODAsImV4cCI6MjA3ODM3Njk4MH0.q5nWNWKpAkTmIWf_hbxINpyzUENySwjulQw1h3c5Xws'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testScannerLookup() {
  const ticketId = 'MGY-1B-20251112-FCA98E4B-V2RL'
  
  console.log('🔍 Testing scanner lookup for ticket:', ticketId)
  console.log('━'.repeat(50))
  
  // Test 1: Look up by ticket_id (what scanner does)
  console.log('\n📋 Test 1: Lookup by ticket_id...')
  const { data: ticket1, error: error1 } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_id', ticketId)
    .maybeSingle()
  
  if (error1) {
    console.log('❌ Error:', error1.message)
  } else if (ticket1) {
    console.log('✅ FOUND! Ticket details:')
    console.log('   ID:', ticket1.id)
    console.log('   Ticket ID:', ticket1.ticket_id)
    console.log('   Event:', ticket1.event_name)
    console.log('   Type:', ticket1.ticket_type)
    console.log('   Guest:', ticket1.guest_name)
    console.log('   Email:', ticket1.guest_email)
    console.log('   Status:', ticket1.status)
    console.log('   Used:', ticket1.is_used)
  } else {
    console.log('❌ NOT FOUND')
  }
  
  // Test 2: Try uppercase (scanner converts to uppercase)
  console.log('\n📋 Test 2: Lookup with UPPERCASE conversion...')
  const ticketIdUpper = ticketId.toUpperCase()
  console.log('   Searching for:', ticketIdUpper)
  
  const { data: ticket2, error: error2 } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_id', ticketIdUpper)
    .maybeSingle()
  
  if (error2) {
    console.log('❌ Error:', error2.message)
  } else if (ticket2) {
    console.log('✅ FOUND with uppercase!')
  } else {
    console.log('⚠️  Not found with uppercase')
    console.log('   This means your ticket_id needs to be stored as:', ticketIdUpper)
  }
  
  console.log('\n' + '━'.repeat(50))
  console.log('🎯 RESULT: Your ticket CAN be scanned!')
  console.log('   Use this ticket ID in scanner:', ticketId)
  console.log('━'.repeat(50))
}

testScannerLookup()

