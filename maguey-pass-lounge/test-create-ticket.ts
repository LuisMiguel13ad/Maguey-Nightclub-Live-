// test-create-ticket.ts
// Create a test ticket for integration testing
// Run with: npm run test:create-ticket

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { webcrypto } from 'crypto'

// Load environment variables
config()

// Polyfill crypto for Node.js environment
import { webcrypto } from 'crypto'
if (typeof globalThis.crypto === 'undefined') {
  // @ts-ignore
  globalThis.crypto = webcrypto as Crypto
}

// Polyfill import.meta.env for Node.js
// @ts-ignore
if (typeof import.meta === 'undefined' || !import.meta.env) {
  // @ts-ignore
  const metaEnv: Record<string, string> = {}
  Object.keys(process.env).forEach(key => {
    metaEnv[key] = process.env[key] || ''
  })
  // @ts-ignore
  globalThis.__import_meta_env__ = metaEnv
  
  // Create a proxy for import.meta.env
  // @ts-ignore
  Object.defineProperty(globalThis, 'import', {
    value: {
      meta: {
        get env() {
          // @ts-ignore
          return globalThis.__import_meta_env__ || {}
        }
      }
    },
    writable: false,
    configurable: false
  })
} else {
  // If import.meta.env exists, populate it
  Object.keys(process.env).forEach(key => {
    // @ts-ignore
    import.meta.env[key] = process.env[key] || ''
  })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials!')
  console.error('   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
  process.exit(1)
}

// Check for QR signing secret
if (!process.env.VITE_QR_SIGNING_SECRET) {
  console.warn('⚠️  VITE_QR_SIGNING_SECRET not set. QR code generation may fail.')
  console.warn('   Set it in your .env file to generate QR codes.')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createTestTicket() {
  console.log('🎫 Creating test ticket...')
  console.log('')

  try {
    // Step 1: Get or create a test event
    console.log('📅 Step 1: Finding event...')
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('name', 'New Years Eve 2025 Celebration')
      .limit(1)

    if (eventsError) {
      throw new Error(`Failed to fetch events: ${eventsError.message}`)
    }

    if (!events || events.length === 0) {
      throw new Error('Event "New Years Eve 2025 Celebration" not found. Please create it first.')
    }

    const event = events[0]
    console.log(`✅ Found event: "${event.name}" (ID: ${event.id})`)
    console.log('')

    // Step 2: Get a ticket type for this event
    console.log('🎟️  Step 2: Finding ticket type...')
    const { data: ticketTypes, error: typesError } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', event.id)
      .limit(1)

    if (typesError) {
      throw new Error(`Failed to fetch ticket types: ${typesError.message}`)
    }

    if (!ticketTypes || ticketTypes.length === 0) {
      throw new Error(`No ticket types found for event "${event.name}". Please create ticket types first.`)
    }

    const ticketType = ticketTypes[0]
    console.log(`✅ Found ticket type: "${ticketType.name}" (ID: ${ticketType.id}, Code: ${ticketType.code})`)
    console.log('')

    // Step 3: Create a test order
    console.log('🛒 Step 3: Creating test order...')
    const testOrder = {
      event_id: event.id,
      purchaser_email: 'test@example.com',
      purchaser_name: 'Test User',
      subtotal: ticketType.price,
      fees_total: ticketType.fee,
      total: ticketType.price + ticketType.fee,
      status: 'paid',
      payment_provider: 'test',
      payment_reference: 'TEST-ORDER-' + Date.now(),
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(testOrder)
      .select()
      .single()

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`)
    }

    console.log(`✅ Created test order: ${order.id}`)
    console.log('')

    // Step 4: Generate QR token (this is what scanner searches for)
    console.log('🔐 Step 4: Generating QR token...')
    
    // Generate QR token - this is what the scanner searches for
    const qrToken = crypto.randomUUID() // e.g., "625a23e7-23b1-4f66-bbf3-6029b9e6a7aa"
    
    const qrSigningSecret = process.env.VITE_QR_SIGNING_SECRET || 'test-secret-key'
    
    // Create HMAC signature for security
    const encoder = new TextEncoder()
    const keyData = encoder.encode(qrSigningSecret)
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(qrToken))
    const signature = Buffer.from(signatureBuffer).toString('base64')
    
    // Create simple QR code data URL (the QR code should encode the qr_token)
    const qrCodeDataUrl = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`

    console.log(`✅ Generated QR token: ${qrToken}`)
    console.log(`   (Scanner searches by this qr_token)`)
    console.log('')

    // Step 5: Generate human-readable ticket ID (for display purposes)
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const shortOrderId = order.id.slice(0, 8).toUpperCase()
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const ticketId = `TEST-INTEGRATION-${dateStr}-${shortOrderId}-${randomSuffix}`

    console.log('🎫 Step 5: Creating ticket...')
    // Create ticket with scanner-compatible schema
    // Scanner searches by qr_token, not ticket_id
    const ticket = {
      qr_token: qrToken,              // ← Scanner searches by THIS
      event_id: event.id,             // ← UUID foreign key
      ticket_type_id: ticketType.id,  // ← UUID foreign key
      attendee_name: 'Test User',     // ← Scanner expects this field name
      order_id: order.id,
      status: 'issued',
      issued_at: new Date().toISOString(),
      // Additional fields for compatibility
      ticket_id: ticketId,            // Human-readable ID (for display)
      attendee_email: 'test@example.com',
      price: ticketType.price,
      fee_total: ticketType.fee,
      qr_signature: signature,
      qr_code_url: qrCodeDataUrl,
      qr_code_value: qrToken,         // QR code encodes the qr_token
    }

    const { data: createdTicket, error: ticketError } = await supabase
      .from('tickets')
      .insert(ticket)
      .select()
      .single()

    if (ticketError) {
      throw new Error(`Failed to create ticket: ${ticketError.message}`)
    }

    console.log('✅ Ticket created successfully!')
    console.log('')
    console.log('📋 Ticket Details:')
    console.log(`   Ticket ID: ${createdTicket.ticket_id}`)
    console.log(`   Order ID: ${createdTicket.order_id}`)
    console.log(`   Event: ${event.name}`)
    console.log(`   Ticket Type: ${ticketType.name}`)
    console.log(`   Status: ${createdTicket.status}`)
    console.log(`   Attendee: ${createdTicket.attendee_name} (${createdTicket.attendee_email})`)
    console.log(`   Price: $${createdTicket.price} + $${createdTicket.fee_total} = $${createdTicket.price + createdTicket.fee_total}`)
    console.log('')

    // Verify ticket can be queried
    console.log('🔍 Verifying ticket can be queried...')
    const { data: verifiedTicket, error: verifyError } = await supabase
      .from('tickets')
      .select('*, events(*), orders(*)')
      .eq('ticket_id', ticketId)
      .single()

    if (verifyError) {
      console.warn('⚠️ Could not verify ticket:', verifyError.message)
    } else {
      console.log('✅ Ticket verified and can be queried!')
    }

    return createdTicket

  } catch (error: any) {
    console.error('❌ Error creating test ticket:', error.message)
    console.error('')
    console.error('💡 Make sure:')
    console.error('   1. Event "New Years Eve 2025 Celebration" exists')
    console.error('   2. Ticket types exist for this event')
    console.error('   3. You have write permissions to orders and tickets tables')
    process.exit(1)
  }
}

createTestTicket()
  .then((ticket) => {
    console.log('\n✨ Test ticket creation completed!')
    console.log(`\n🎫 Test Ticket ID: ${ticket.ticket_id}`)
    console.log('   You can use this ticket ID to test the scanner integration.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })

