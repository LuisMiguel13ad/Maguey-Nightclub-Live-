import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://djbzjasdrwvbsoifxqzd.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDA5ODAsImV4cCI6MjA3ODM3Njk4MH0.q5nWNWKpAkTmIWf_hbxINpyzUENySwjulQw1h3c5Xws'

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyAndUpdateTicket() {
  console.log('🔍 Checking ticket schema and data...\n')

  // Get the latest ticket
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('❌ Error fetching ticket:', error.message)
    return
  }

  if (!tickets || tickets.length === 0) {
    console.log('⚠️  No tickets found in database')
    return
  }

  const ticket = tickets[0]
  console.log('📋 Latest Ticket Data:')
  console.log('   ID:', ticket.id)
  console.log('   ticket_id:', ticket.ticket_id || '❌ NULL')
  console.log('   qr_code_value:', ticket.qr_code_value || 'N/A')
  console.log('   event_name:', ticket.event_name || '❌ NULL')
  console.log('   ticket_type:', ticket.ticket_type || '❌ NULL')
  console.log('   guest_name:', ticket.guest_name || '❌ NULL')
  console.log('   guest_email:', ticket.guest_email || '❌ NULL')
  console.log('   attendee_name:', ticket.attendee_name || 'N/A')
  console.log('   attendee_email:', ticket.attendee_email || 'N/A')
  console.log('   qr_code_data:', ticket.qr_code_data || '❌ NULL')
  console.log('   is_used:', ticket.is_used !== undefined ? ticket.is_used : '❌ NULL')
  console.log('   status:', ticket.status || 'N/A')
  console.log()

  // Check if new columns exist but are empty
  const needsUpdate = 
    !ticket.ticket_id || 
    !ticket.event_name || 
    !ticket.ticket_type || 
    !ticket.guest_name ||
    !ticket.guest_email ||
    !ticket.qr_code_data

  if (needsUpdate && ticket.qr_code_value) {
    console.log('🔄 Populating new columns from existing data...\n')

    // Get event and ticket type names
    const { data: event } = await supabase
      .from('events')
      .select('name')
      .eq('id', ticket.event_id)
      .single()

    const { data: ticketType } = await supabase
      .from('ticket_types')
      .select('name')
      .eq('id', ticket.ticket_type_id)
      .single()

    const updates: any = {
      ticket_id: ticket.qr_code_value,
      qr_code_data: ticket.qr_code_value,
      guest_name: ticket.attendee_name,
      guest_email: ticket.attendee_email,
      is_used: false,
      purchase_date: ticket.issued_at || ticket.created_at
    }

    if (event) {
      updates.event_name = event.name
      console.log('   ✅ Event name:', event.name)
    }

    if (ticketType) {
      updates.ticket_type = ticketType.name
      console.log('   ✅ Ticket type:', ticketType.name)
    }

    const { error: updateError } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticket.id)

    if (updateError) {
      console.error('\n❌ Error updating ticket:', updateError.message)
    } else {
      console.log('\n✅ Ticket updated successfully!')
      console.log('   📝 ticket_id:', updates.ticket_id)
      console.log('   📝 event_name:', updates.event_name)
      console.log('   📝 ticket_type:', updates.ticket_type)
    }
  } else if (!needsUpdate) {
    console.log('✅ All required columns are populated!')
    console.log('   📝 ticket_id:', ticket.ticket_id)
    console.log('   📝 event_name:', ticket.event_name)
    console.log('   📝 ticket_type:', ticket.ticket_type)
  } else {
    console.log('⚠️  Cannot auto-populate: missing source data (qr_code_value)')
  }
}

verifyAndUpdateTicket()

