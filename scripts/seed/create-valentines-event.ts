import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { randomUUID } from 'crypto'

// Load environment variables from maguey-pass-lounge
dotenv.config({ path: resolve(__dirname, '../../maguey-pass-lounge/.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createValentinesEvent() {
  // Use a deterministic UUID for Valentine's Day 2026 (so re-running updates instead of creating duplicates)
  const eventId = '00000000-0214-2026-0214-000000000214'

  console.log('Creating Valentine\'s Day event...')

  // Create the event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .upsert({
      id: eventId,
      name: "Valentine's Night",
      event_date: '2026-02-14',
      event_time: '21:00:00',
      genre: 'Latin',
      image_url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&h=1200&fit=crop',
      venue_name: 'Maguey Nightclub',
      venue_address: '123 Main St, Wilmington, DE 19801',
      city: 'Wilmington, DE',
      description: "Celebrate love with the hottest Latin beats! Join us for a special Valentine's Night with live DJs, premium bottle service, and an unforgettable romantic atmosphere. VIP tables available for couples and groups.",
      status: 'published',
      is_active: true,
      vip_enabled: true,
      vip_configured_at: new Date().toISOString(),
    }, {
      onConflict: 'id'
    })
    .select()
    .single()

  if (eventError) {
    console.error('Error creating event:', eventError)
    process.exit(1)
  }

  console.log('Event created:', event.name)

  // Create ticket types
  const ticketTypes = [
    {
      event_id: eventId,
      code: 'ga',
      name: 'General Admission',
      price: 25.00,
      fee: 3.50,
      total_inventory: 200,
      description: 'Standard entry to the Valentine\'s Night celebration',
    },
    {
      event_id: eventId,
      code: 'couples',
      name: 'Couples Package',
      price: 45.00,
      fee: 5.00,
      total_inventory: 50,
      description: 'Entry for two with a complimentary rose and champagne toast',
    },
    {
      event_id: eventId,
      code: 'vip-entry',
      name: 'VIP Entry',
      price: 60.00,
      fee: 7.00,
      total_inventory: 30,
      description: 'Priority entry, exclusive VIP lounge access, and complimentary welcome drink',
    },
  ]

  const { data: tickets, error: ticketError } = await supabase
    .from('ticket_types')
    .upsert(ticketTypes, {
      onConflict: 'event_id,code'
    })
    .select()

  if (ticketError) {
    console.error('Error creating ticket types:', ticketError)
    process.exit(1)
  }

  console.log('Ticket types created:', tickets?.length)

  // Check if VIP tables exist for this event, create default ones if not
  const { data: existingTables } = await supabase
    .from('event_vip_tables')
    .select('id')
    .eq('event_id', eventId)
    .limit(1)

  if (!existingTables || existingTables.length === 0) {
    console.log('Creating VIP tables for the event...')

    // Get base VIP tables to clone
    const { data: baseTables } = await supabase
      .from('vip_tables')
      .select('*')
      .eq('is_active', true)

    if (baseTables && baseTables.length > 0) {
      const eventVipTables = baseTables.map(table => ({
        event_id: eventId,
        table_id: table.id,
        price: table.min_spend * 1.25, // 25% markup for Valentine's Day
        status: 'available',
        is_available: true,
      }))

      const { error: vipError } = await supabase
        .from('event_vip_tables')
        .upsert(eventVipTables, {
          onConflict: 'event_id,table_id'
        })

      if (vipError) {
        console.warn('Note: Could not create VIP tables (table may not exist yet):', vipError.message)
      } else {
        console.log('VIP tables created:', eventVipTables.length)
      }
    } else {
      console.log('No base VIP tables found - VIP table reservations will use default pricing')
    }
  } else {
    console.log('VIP tables already exist for this event')
  }

  console.log('\n=== Valentine\'s Day Event Created Successfully ===')
  console.log(`Event ID: ${eventId}`)
  console.log(`Event Date: February 14, 2026`)
  console.log(`VIP Enabled: Yes`)
  console.log(`Ticket Types: ${tickets?.length}`)
  console.log('\nView at: http://localhost:3016/events/' + eventId)
}

createValentinesEvent().catch(console.error)
