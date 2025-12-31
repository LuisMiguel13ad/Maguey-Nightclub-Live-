import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://djbzjasdrwvbsoifxqzd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDA5ODAsImV4cCI6MjA3ODM3Njk4MH0.q5nWNWKpAkTmIWf_hbxINpyzUENySwjulQw1h3c5Xws'
)

async function checkRecentTickets() {
  console.log('🎫 Checking most recent tickets...\n')
  
  // Get last 3 tickets ordered by created_at
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)
  
  if (error) {
    console.log('❌ Error:', error.message)
    return
  }
  
  if (!tickets || tickets.length === 0) {
    console.log('⚠️  No tickets found')
    return
  }
  
  console.log(`Found ${tickets.length} recent ticket(s):\n`)
  
  tickets.forEach((ticket, index) => {
    console.log(`━━━ Ticket ${index + 1} ━━━`)
    console.log(`ID (database): ${ticket.id}`)
    console.log(`Ticket ID: ${ticket.ticket_id || '❌ NULL (REQUIRED)'}`)
    console.log(`QR Code Value: ${ticket.qr_code_value || 'NULL'}`)
    console.log(`QR Code Data: ${ticket.qr_code_data || '❌ NULL (REQUIRED)'}`)
    console.log(`Event Name: ${ticket.event_name || '❌ NULL (REQUIRED)'}`)
    console.log(`Ticket Type: ${ticket.ticket_type || '❌ NULL (REQUIRED)'}`)
    console.log(`Guest Name: ${ticket.guest_name || '❌ NULL (REQUIRED)'}`)
    console.log(`Guest Email: ${ticket.guest_email || '❌ NULL'}`)
    console.log(`Status: ${ticket.status || '❌ NULL (REQUIRED)'}`)
    console.log(`Is Used: ${ticket.is_used}`)
    console.log(`Created: ${ticket.created_at}`)
    
    // Check if scanner-required fields are present
    const missingFields = []
    if (!ticket.ticket_id) missingFields.push('ticket_id')
    if (!ticket.event_name) missingFields.push('event_name')
    if (!ticket.ticket_type) missingFields.push('ticket_type')
    if (!ticket.guest_name) missingFields.push('guest_name')
    if (!ticket.qr_code_data) missingFields.push('qr_code_data')
    if (!ticket.status) missingFields.push('status')
    
    if (missingFields.length > 0) {
      console.log(`\n❌ MISSING FIELDS: ${missingFields.join(', ')}`)
      console.log('This ticket CANNOT be scanned until these fields are populated')
    } else {
      console.log('\n✅ All required fields present - this ticket CAN be scanned')
      console.log(`Scan this ticket with: ${ticket.ticket_id}`)
    }
    console.log()
  })
  
  console.log('━'.repeat(50))
  console.log('\n💡 If new ticket is missing fields:')
  console.log('   Your purchase site needs to be updated to populate these fields')
  console.log('   Run the UPDATE query again, OR update purchase site code')
}

checkRecentTickets()

