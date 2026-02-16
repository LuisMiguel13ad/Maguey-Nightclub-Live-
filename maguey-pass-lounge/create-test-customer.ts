// create-test-customer.ts
// Create a complete test customer account with order and tickets
// Run with: npm run dev (and paste this in browser console)
// Or use the SQL approach below

import { supabase } from './src/lib/supabase'
import { createOrderWithTickets } from './src/lib/orders-service'

async function createTestCustomerAndOrder() {
  console.log('🎫 Creating Test Customer Account with Order and Tickets...')
  console.log('')

  try {
    // Step 1: Create test customer account
    console.log('👤 Step 1: Creating test customer account...')
    const testEmail = 'testcustomer@maguey.com'
    const testPassword = 'test1234'
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          first_name: 'Test',
          last_name: 'Customer',
        },
        emailRedirectTo: `http://localhost:5173/account`,
      },
    })

    if (authError) {
      // If user already exists, try to sign in instead
      if (authError.message.includes('already registered')) {
        console.log('⚠️  Account already exists, using existing account...')
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        })
        if (signInError) {
          throw new Error(`Failed to sign in: ${signInError.message}`)
        }
        console.log('✅ Signed in with existing account')
      } else {
        throw new Error(`Failed to create account: ${authError.message}`)
      }
    } else {
      console.log('✅ Created test customer account')
      console.log(`   Email: ${testEmail}`)
      console.log(`   Password: ${testPassword}`)
    }
    console.log('')

    // Step 2: Get active event
    console.log('📅 Step 2: Finding active event...')
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('event_date', { ascending: true })
      .limit(1)

    if (eventsError) throw new Error(`Failed to fetch events: ${eventsError.message}`)
    if (!events || events.length === 0) {
      throw new Error('No active events found')
    }

    const event = events[0]
    console.log(`✅ Found event: "${event.name}"`)
    console.log(`   Date: ${event.event_date}`)
    console.log(`   Venue: ${event.venue_name}`)
    console.log('')

    // Step 3: Get ticket types for this event
    console.log('🎟️  Step 3: Finding ticket types...')
    const { data: ticketTypes, error: typesError } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', event.id)
      .order('price', { ascending: true })

    if (typesError) throw new Error(`Failed to fetch ticket types: ${typesError.message}`)
    if (!ticketTypes || ticketTypes.length === 0) {
      throw new Error('No ticket types found for this event')
    }

    console.log(`✅ Found ${ticketTypes.length} ticket type(s)`)
    ticketTypes.forEach(tt => {
      console.log(`   - ${tt.name}: $${tt.price}`)
    })
    console.log('')

    // Step 4: Create order with tickets (using the proper service)
    console.log('🛒 Step 4: Creating order with tickets...')
    
    // Select the first ticket type and buy 2 tickets
    const selectedTicketType = ticketTypes[0]
    const quantity = 2

    const orderResult = await createOrderWithTickets({
      eventId: event.id,
      purchaserEmail: testEmail,
      purchaserName: 'Test Customer',
      purchaserUserId: authData?.user?.id || null,
      ticketHolderName: 'Test Customer',
      lineItems: [
        {
          ticketTypeId: selectedTicketType.id,
          quantity: quantity,
          unitPrice: Number(selectedTicketType.price),
          unitFee: Number(selectedTicketType.fee),
          displayName: selectedTicketType.name,
        },
      ],
      metadata: {
        source: 'test-script',
        created_by: 'create-test-customer.ts',
      },
    })

    console.log('✅ Order and tickets created successfully!')
    console.log('')
    console.log('📋 Order Details:')
    console.log(`   Order ID: ${orderResult.order.id}`)
    console.log(`   Total: $${orderResult.order.total}`)
    console.log(`   Status: ${orderResult.order.status}`)
    console.log(`   Tickets: ${orderResult.ticketEmailPayloads.length}`)
    console.log('')

    // Step 5: Fetch created tickets to display QR codes
    console.log('🎫 Step 5: Fetching ticket details...')
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .eq('order_id', orderResult.order.id)

    if (ticketsError) throw new Error(`Failed to fetch tickets: ${ticketsError.message}`)

    console.log('✅ Tickets Details:')
    tickets?.forEach((ticket, index) => {
      console.log(``)
      console.log(`   Ticket ${index + 1}:`)
      console.log(`   - Ticket ID: ${ticket.ticket_id}`)
      console.log(`   - QR Token: ${ticket.qr_token}`)
      console.log(`   - Status: ${ticket.status}`)
      console.log(`   - Attendee: ${ticket.attendee_name}`)
      console.log(`   - Price: $${ticket.price}`)
    })
    console.log('')

    console.log('✨ Success! Test customer and tickets created.')
    console.log('')
    console.log('🔐 Login Credentials:')
    console.log(`   Email: ${testEmail}`)
    console.log(`   Password: ${testPassword}`)
    console.log('')
    console.log('📱 Next Steps:')
    console.log(`   1. Go to http://localhost:5173/login`)
    console.log(`   2. Login with the credentials above`)
    console.log(`   3. Go to /account to see your tickets`)
    console.log(`   4. Click on a ticket to view the QR code`)
    console.log('')

    return {
      email: testEmail,
      password: testPassword,
      order: orderResult.order,
      tickets: tickets,
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  }
}

// Export for use in browser console or other scripts
export { createTestCustomerAndOrder }

// Automatically run if this is the main module
if (typeof window !== 'undefined') {
  // Browser environment - expose to window
  (window as any).createTestCustomerAndOrder = createTestCustomerAndOrder
  console.log('✅ Test function loaded. Run: createTestCustomerAndOrder()')
}

