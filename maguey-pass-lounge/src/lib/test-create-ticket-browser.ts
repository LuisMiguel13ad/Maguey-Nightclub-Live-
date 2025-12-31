// test-create-ticket-browser.ts
// Browser console version - Create a test ticket
// Copy this into browser console or import and call

import { supabase } from './supabase'
import { createTicketData } from './ticket-generator'

/**
 * Create a test ticket for integration testing
 * 
 * Usage in browser console:
 * 1. Copy the function below
 * 2. Paste into browser console
 * 3. Call: await createTestTicket()
 * 
 * Or import in your code:
 * import { createTestTicket } from '@/lib/test-create-ticket-browser'
 * await createTestTicket()
 */
export async function createTestTicket() {
  console.log('🎫 Creating test ticket...')
  console.log('')

  try {
    // Step 1: Get event
    console.log('📅 Step 1: Finding event...')
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('name', 'New Years Eve 2025 Celebration')
      .limit(1)

    if (eventsError) throw new Error(`Failed to fetch events: ${eventsError.message}`)
    if (!events || events.length === 0) {
      throw new Error('Event "New Years Eve 2025 Celebration" not found')
    }

    const event = events[0]
    console.log(`✅ Found event: "${event.name}"`)
    console.log('')

    // Step 2: Get ticket type
    console.log('🎟️  Step 2: Finding ticket type...')
    const { data: ticketTypes, error: typesError } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', event.id)
      .limit(1)

    if (typesError) throw new Error(`Failed to fetch ticket types: ${typesError.message}`)
    if (!ticketTypes || ticketTypes.length === 0) {
      throw new Error('No ticket types found for this event')
    }

    const ticketType = ticketTypes[0]
    console.log(`✅ Found ticket type: "${ticketType.name}"`)
    console.log('')

    // Step 3: Create test order
    console.log('🛒 Step 3: Creating test order...')
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        event_id: event.id,
        purchaser_email: 'test@example.com',
        purchaser_name: 'Test User',
        subtotal: ticketType.price,
        fees_total: ticketType.fee,
        total: ticketType.price + ticketType.fee,
        status: 'paid',
        payment_provider: 'test',
        payment_reference: 'TEST-ORDER-' + Date.now(),
      })
      .select()
      .single()

    if (orderError) throw new Error(`Failed to create order: ${orderError.message}`)
    console.log(`✅ Created test order: ${order.id}`)
    console.log('')

    // Step 4: Generate QR code
    console.log('🔐 Step 4: Generating QR code...')
    const ticketData = await createTicketData({
      eventId: event.id,
      eventImage: event.image_url || '',
      eventName: event.name,
      eventDate: event.event_date,
      eventTime: event.event_time,
      venue: event.venue_name || '',
      venueAddress: event.venue_address || event.city || '',
      ticketType: ticketType.name,
      ticketHolderName: 'Test User',
      orderId: order.id,
      price: ticketType.price + ticketType.fee,
    })
    console.log(`✅ Generated QR code`)
    console.log('')

    // Step 5: Create ticket
    console.log('🎫 Step 5: Creating ticket...')
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const shortOrderId = order.id.slice(0, 8).toUpperCase()
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const ticketId = `TEST-INTEGRATION-${dateStr}-${shortOrderId}-${randomSuffix}`

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        ticket_id: ticketId,
        order_id: order.id,
        event_id: event.id,
        ticket_type_id: ticketType.id,
        attendee_name: 'Test User',
        attendee_email: 'test@example.com',
        status: 'issued',
        price: ticketType.price,
        fee_total: ticketType.fee,
        qr_token: ticketData.qrToken,
        qr_signature: ticketData.qrSignature,
        qr_code_url: ticketData.qrCodeDataUrl,
        qr_code_value: ticketId,
        issued_at: new Date().toISOString(),
        expires_at: new Date(event.event_date).toISOString(),
      })
      .select()
      .single()

    if (ticketError) throw new Error(`Failed to create ticket: ${ticketError.message}`)

    console.log('✅ Ticket created successfully!')
    console.log('')
    console.log('📋 Ticket Details:')
    console.log(`   Ticket ID: ${ticket.ticket_id}`)
    console.log(`   Order ID: ${ticket.order_id}`)
    console.log(`   Event: ${event.name}`)
    console.log(`   Status: ${ticket.status}`)
    console.log('')

    return ticket

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  }
}

// Browser console version - copy this entire block:
/*
async function createTestTicket() {
  const { data: events } = await supabase.from('events').select('*').eq('name', 'New Years Eve 2025 Celebration').limit(1).single()
  const { data: ticketType } = await supabase.from('ticket_types').select('*').eq('event_id', events.id).limit(1).single()
  const { data: order } = await supabase.from('orders').insert({
    event_id: events.id,
    purchaser_email: 'test@example.com',
    purchaser_name: 'Test User',
    subtotal: ticketType.price,
    fees_total: ticketType.fee,
    total: ticketType.price + ticketType.fee,
    status: 'paid',
    payment_provider: 'test',
    payment_reference: 'TEST-ORDER-' + Date.now(),
  }).select().single()
  
  const ticketId = 'TEST-INTEGRATION-001'
  const { data: ticket } = await supabase.from('tickets').insert({
    ticket_id: ticketId,
    order_id: order.id,
    event_id: events.id,
    ticket_type_id: ticketType.id,
    attendee_name: 'Test User',
    attendee_email: 'test@example.com',
    status: 'issued',
    price: ticketType.price,
    fee_total: ticketType.fee,
    qr_code_value: ticketId,
    issued_at: new Date().toISOString(),
    expires_at: new Date(events.event_date).toISOString(),
  }).select().single()
  
  console.log('Ticket created:', ticket)
  return ticket
}

createTestTicket()
*/

