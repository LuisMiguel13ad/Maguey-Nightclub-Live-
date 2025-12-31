// test-connection.ts

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// Load environment variables for Node.js execution
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables. Please check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  const { data, error } = await supabase
    .from('events')
    .select('*', { count: 'exact' })
    .limit(1)

  if (error) {
    console.error('❌ Connection failed:', error)
  } else {
    console.log('✅ Connected to Supabase successfully!')
    console.log('Data:', data)
  }
}

// Test availability API
async function testAvailabilityAPI() {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const API_KEY = process.env.VITE_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !API_KEY) {
    console.error('❌ Missing environment variables for API test')
    return
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/event-availability/New Years Eve 2025 Celebration`,
      {
        headers: {
          'apikey': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    )

    const data = await response.json()
    console.log('\n📊 Availability Response:', data)

    // Expected format:
    // {
    //   "eventName": "New Years Eve 2025 Celebration",
    //   "ticketTypes": [
    //     { "ticketTypeCode": "...", "available": X, "total": Y, "sold": Z }
    //   ]
    // }
  } catch (error) {
    console.error('❌ Availability API test failed:', error)
  }
}

// Run tests
async function runTests() {
  console.log('🔍 Testing Supabase connection...\n')
  await testConnection()
  
  console.log('\n🔍 Testing Availability API...\n')
  await testAvailabilityAPI()
}

runTests()

