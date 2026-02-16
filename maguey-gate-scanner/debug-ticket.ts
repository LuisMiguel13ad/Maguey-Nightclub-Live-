import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://djbzjasdrwvbsoifxqzd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDA5ODAsImV4cCI6MjA3ODM3Njk4MH0.q5nWNWKpAkTmIWf_hbxINpyzUENySwjulQw1h3c5Xws'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugTicket() {
  const ticketId = 'MGY-1B-20251112-FCA98E4B-V2RL'
  const ticketIdUpper = ticketId.toUpperCase()
  
  console.log('🔍 Debugging ticket lookup...')
  console.log('━'.repeat(60))
  console.log('Searching for:', ticketId)
  console.log('Uppercase:', ticketIdUpper)
  console.log('━'.repeat(60))
  
  // Test 1: Direct query (what scanner does)
  console.log('\n1️⃣ Testing direct ticket_id lookup (case-sensitive)...')
  const { data: ticket1, error: error1 } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_id', ticketId)
    .maybeSingle()
  
  if (error1) {
    console.log('   ❌ Error:', error1.message)
  } else if (ticket1) {
    console.log('   ✅ FOUND!')
  } else {
    console.log('   ❌ NOT FOUND')
  }
  
  // Test 2: Uppercase
  console.log('\n2️⃣ Testing with UPPERCASE...')
  const { data: ticket2, error: error2 } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_id', ticketIdUpper)
    .maybeSingle()
  
  if (error2) {
    console.log('   ❌ Error:', error2.message)
  } else if (ticket2) {
    console.log('   ✅ FOUND!')
  } else {
    console.log('   ❌ NOT FOUND')
  }
  
  // Test 3: Case-insensitive search
  console.log('\n3️⃣ Testing case-insensitive search...')
  const { data: ticket3, error: error3 } = await supabase
    .from('tickets')
    .select('*')
    .ilike('ticket_id', ticketId)
    .maybeSingle()
  
  if (error3) {
    console.log('   ❌ Error:', error3.message)
  } else if (ticket3) {
    console.log('   ✅ FOUND!')
  } else {
    console.log('   ❌ NOT FOUND')
  }
  
  // Test 4: Show all tickets to see what exists
  console.log('\n4️⃣ Listing ALL tickets in database...')
  const { data: allTickets, error: error4 } = await supabase
    .from('tickets')
    .select('ticket_id, event_name, ticket_type, guest_name, status, is_used')
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (error4) {
    console.log('   ❌ Error:', error4.message)
  } else if (allTickets && allTickets.length > 0) {
    console.log(`   Found ${allTickets.length} tickets:`)
    allTickets.forEach((t, i) => {
      console.log(`   ${i + 1}. ticket_id: "${t.ticket_id || 'NULL'}"`)
      console.log(`      event_name: ${t.event_name || 'NULL'}`)
      console.log(`      ticket_type: ${t.ticket_type || 'NULL'}`)
      console.log(`      guest_name: ${t.guest_name || 'NULL'}`)
      console.log(`      status: ${t.status || 'NULL'}`)
      console.log(`      is_used: ${t.is_used}`)
      console.log()
    })
  } else {
    console.log('   ⚠️  No tickets found in database!')
  }
  
  console.log('━'.repeat(60))
  console.log('\n🔍 DIAGNOSIS:')
  
  if (!ticket1 && !ticket2 && !ticket3) {
    console.log('❌ Ticket NOT FOUND in database')
    console.log('   Possible reasons:')
    console.log('   1. The UPDATE query was not run')
    console.log('   2. ticket_id column is still NULL')
    console.log('   3. Ticket was deleted')
    console.log('\n💡 Solution: Run the UPDATE query in Supabase SQL Editor')
  } else {
    const ticket = ticket1 || ticket2 || ticket3
    console.log('✅ Ticket EXISTS in database')
    console.log('\nTicket Details:')
    console.log('   ticket_id:', ticket.ticket_id)
    console.log('   event_name:', ticket.event_name || '❌ NULL')
    console.log('   ticket_type:', ticket.ticket_type || '❌ NULL')
    console.log('   guest_name:', ticket.guest_name || '❌ NULL')
    console.log('   guest_email:', ticket.guest_email || '❌ NULL')
    console.log('   qr_code_data:', ticket.qr_code_data || '❌ NULL')
    console.log('   is_used:', ticket.is_used)
    console.log('   status:', ticket.status || '❌ NULL')
    
    const missingFields = []
    if (!ticket.ticket_id) missingFields.push('ticket_id')
    if (!ticket.event_name) missingFields.push('event_name')
    if (!ticket.ticket_type) missingFields.push('ticket_type')
    if (!ticket.guest_email) missingFields.push('guest_email')
    
    if (missingFields.length > 0) {
      console.log('\n❌ Missing required fields:', missingFields.join(', '))
      console.log('💡 Solution: Run the UPDATE query to populate these fields')
    } else {
      console.log('\n✅ All required fields are present!')
      console.log('💡 If scanner still says invalid, check:')
      console.log('   - Scanner is connected to same database')
      console.log('   - Browser console for error messages')
      console.log('   - Dev server was restarted after .env changes')
    }
  }
  
  console.log('━'.repeat(60))
}

debugTicket()

