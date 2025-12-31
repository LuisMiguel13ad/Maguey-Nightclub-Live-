// test-connection.ts
// Test Supabase database connection
// Run with: npm run test:connection

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env file
config()

// Get credentials from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials!')
  console.error('   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
  process.exit(1)
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('🔌 Testing Supabase connection...')
  console.log(`   URL: ${supabaseUrl?.substring(0, 30)}...`)
  console.log('')
  
  // Test 1: Simple query to events table
  console.log('📅 Testing events table...')
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Connection failed:', error.message)
    console.error('   Details:', error)
    process.exit(1)
  } else {
    console.log('✅ Connected to Supabase successfully!')
    console.log(`📊 Found ${data?.length || 0} event(s)`)
    
    if (data && data.length > 0) {
      console.log(`   Sample event: "${data[0].name}"`)
    }
  }

  console.log('')

  // Test 2: Check ticket_types table
  console.log('🎫 Testing ticket_types table...')
  const { count: ticketCount, error: ticketError } = await supabase
    .from('ticket_types')
    .select('*', { count: 'exact', head: true })

  if (ticketError) {
    console.warn('⚠️ Could not access ticket_types:', ticketError.message)
  } else {
    console.log(`✅ Ticket types table accessible (${ticketCount || 0} types)`)
  }

  console.log('')

  // Test 3: Check orders table
  console.log('🛒 Testing orders table...')
  const { count: orderCount, error: ordersError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })

  if (ordersError) {
    console.warn('⚠️ Could not access orders:', ordersError.message)
  } else {
    console.log(`✅ Orders table accessible (${orderCount || 0} orders)`)
  }

  console.log('')

  // Test 4: Check tickets table
  console.log('🎟️  Testing tickets table...')
  const { count: ticketRecordCount, error: ticketsError } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })

  if (ticketsError) {
    console.warn('⚠️ Could not access tickets:', ticketsError.message)
  } else {
    console.log(`✅ Tickets table accessible (${ticketRecordCount || 0} tickets)`)
  }
}

testConnection()
  .then(() => {
    console.log('\n✨ Test completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })

