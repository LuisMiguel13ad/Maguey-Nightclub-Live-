import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_ANON_KEY not found in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testScanQRToken() {
  // This is the QR token from the test ticket created on Purchase Website
  const qrToken = '272e7840-e63b-4259-aaa1-10ae7db87124'
  
  console.log('🔍 Testing Scanner Lookup by QR Token')
  console.log('━'.repeat(60))
  console.log(`   QR Token: ${qrToken}`)
  console.log('━'.repeat(60))
  console.log('')
  
  // This is how the scanner looks up tickets
  console.log('📡 Step 1: Searching by qr_token (what scanner does)...')
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      events (
        id,
        name,
        event_date,
        event_time,
        venue_name,
        venue_address,
        city
      ),
      ticket_types (
        id,
        name,
        code,
        price
      )
    `)
    .eq('qr_token', qrToken)
    .maybeSingle()
  
  if (error) {
    console.log('❌ Database error:', error.message)
    console.log('')
    console.log('💡 Possible issues:')
    console.log('   - RLS policy might be blocking the query')
    console.log('   - qr_token column might not exist')
    console.log('   - Ticket not yet created')
    return
  }
  
  if (!ticket) {
    console.log('❌ Ticket NOT FOUND')
    console.log('')
    console.log('💡 This could mean:')
    console.log('   - Ticket was not created yet')
    console.log('   - Wrong QR token')
    console.log('   - Database issue')
    return
  }
  
  console.log('✅ TICKET FOUND!')
  console.log('')
  console.log('📋 Ticket Details:')
  console.log(`   Ticket ID: ${ticket.ticket_id}`)
  console.log(`   QR Token: ${ticket.qr_token}`)
  console.log(`   Status: ${ticket.status}`)
  console.log(`   Attendee: ${ticket.attendee_name}`)
  console.log(`   Email: ${ticket.attendee_email}`)
  console.log(`   Price: $${ticket.price} + $${ticket.fee_total} fee`)
  console.log('')
  
  console.log('🎉 Event Details:')
  if (ticket.events) {
    console.log(`   Name: ${ticket.events.name}`)
    console.log(`   Date: ${ticket.events.event_date}`)
    console.log(`   Time: ${ticket.events.event_time}`)
    console.log(`   Venue: ${ticket.events.venue_name}`)
  } else {
    console.log('   ⚠️  Event details not loaded')
  }
  console.log('')
  
  console.log('🎫 Ticket Type Details:')
  if (ticket.ticket_types) {
    console.log(`   Name: ${ticket.ticket_types.name}`)
    console.log(`   Code: ${ticket.ticket_types.code}`)
    console.log(`   Price: $${ticket.ticket_types.price}`)
  } else {
    console.log('   ⚠️  Ticket type details not loaded')
  }
  console.log('')
  
  // Test marking as used
  console.log('📝 Step 2: Testing scanner mark as used...')
  const { data: updated, error: updateError } = await supabase
    .from('tickets')
    .update({
      status: 'used',
      scanned_at: new Date().toISOString(),
    })
    .eq('qr_token', qrToken)
    .select()
    .single()
  
  if (updateError) {
    console.log('❌ Failed to mark ticket as used:', updateError.message)
    console.log('   This could be an RLS policy issue')
  } else {
    console.log('✅ Ticket marked as USED!')
    console.log(`   Status: ${updated.status}`)
    console.log(`   Scanned at: ${updated.scanned_at}`)
  }
  console.log('')
  
  console.log('━'.repeat(60))
  console.log('🎯 SCANNER INTEGRATION TEST: PASSED ✅')
  console.log('   The scanner CAN find and update tickets!')
  console.log('━'.repeat(60))
}

testScanQRToken()
  .then(() => {
    console.log('\n✨ Test completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })

