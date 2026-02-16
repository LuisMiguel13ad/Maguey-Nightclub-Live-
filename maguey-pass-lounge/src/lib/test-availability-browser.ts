// test-availability-browser.ts
// Browser console version - copy and paste into browser console
// Or import and call: testAvailabilityAPI()

/**
 * Test availability API from browser console
 * 
 * Usage in browser console:
 * 1. Copy the entire function below
 * 2. Paste into browser console
 * 3. Call: testAvailabilityAPI()
 * 
 * Or import in your code:
 * import { testAvailabilityAPI } from '@/lib/test-availability-browser'
 */

export async function testAvailabilityAPI() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  const API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  const SCANNER_API_URL = import.meta.env.VITE_SCANNER_API_URL

  if (!SUPABASE_URL || !API_KEY) {
    console.error('❌ Missing Supabase credentials!')
    console.error('   Please check your environment variables')
    return
  }

  // Use scanner API URL if configured, otherwise try Supabase Edge Function
  const baseUrl = SCANNER_API_URL || SUPABASE_URL
  const eventName = 'New Years Eve 2025 Celebration'
  const encodedEventName = encodeURIComponent(eventName)

  console.log('🔌 Testing Availability API...')
  console.log(`   Base URL: ${baseUrl}`)
  console.log(`   Event: "${eventName}"`)
  console.log('')

  try {
    // Try scanner API endpoint first (if configured)
    let apiUrl: string
    let headers: Record<string, string>

    if (SCANNER_API_URL) {
      // Scanner website API endpoint
      apiUrl = `${SCANNER_API_URL}/functions/v1/event-availability/${encodedEventName}`
      headers = {
        'Content-Type': 'application/json',
      }
      console.log('📡 Using Scanner Website API...')
    } else {
      // Supabase Edge Function endpoint (if implemented as Edge Function)
      apiUrl = `${SUPABASE_URL}/functions/v1/event-availability/${encodedEventName}`
      headers = {
        'apikey': API_KEY,
        'Content-Type': 'application/json',
      }
      console.log('📡 Using Supabase Edge Function...')
    }

    console.log(`   Endpoint: ${apiUrl}`)
    console.log('')

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error(`   Response: ${errorText}`)
      
      if (response.status === 404) {
        console.log('')
        console.log('💡 Tip: The availability endpoint needs to be implemented on your scanner website.')
        console.log('   See SCANNER_API_REFERENCE.md for implementation examples.')
      }
      
      return
    }

    const data = await response.json()
    
    console.log('✅ Availability API Response:')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    // Validate response structure
    if (data.eventName && Array.isArray(data.ticketTypes)) {
      console.log('✅ Response structure is valid!')
      console.log(`   Event: ${data.eventName}`)
      console.log(`   Ticket Types: ${data.ticketTypes.length}`)
      
      data.ticketTypes.forEach((ticket: any) => {
        console.log(`   - ${ticket.ticketTypeCode}: ${ticket.available} available (${ticket.sold}/${ticket.total} sold)`)
      })
    } else {
      console.warn('⚠️ Response structure might be incorrect')
      console.warn('   Expected: { eventName: string, ticketTypes: Array }')
    }

    // Return data for further inspection
    return data

  } catch (error: any) {
    console.error('❌ Error calling availability API:', error.message)
    console.error('')
    console.error('💡 Possible issues:')
    console.error('   1. Scanner API URL not configured (set VITE_SCANNER_API_URL)')
    console.error('   2. Availability endpoint not implemented on scanner website')
    console.error('   3. Network/CORS issues')
    console.error('')
    console.error('   See SCANNER_API_REFERENCE.md for implementation guide.')
    throw error
  }
}

// Browser console version (standalone function)
// Copy this entire block into browser console:
/*
async function testAvailabilityAPI() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  const API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  const SCANNER_API_URL = import.meta.env.VITE_SCANNER_API_URL

  const baseUrl = SCANNER_API_URL || SUPABASE_URL
  const eventName = 'New Years Eve 2025 Celebration'
  const encodedEventName = encodeURIComponent(eventName)

  console.log('🔌 Testing Availability API...')
  console.log(`   Event: "${eventName}"`)

  try {
    const apiUrl = SCANNER_API_URL 
      ? `${SCANNER_API_URL}/functions/v1/event-availability/${encodedEventName}`
      : `${SUPABASE_URL}/functions/v1/event-availability/${encodedEventName}`
    
    const headers = SCANNER_API_URL
      ? { 'Content-Type': 'application/json' }
      : { 'apikey': API_KEY, 'Content-Type': 'application/json' }

    const response = await fetch(apiUrl, { method: 'GET', headers })
    const data = await response.json()
    
    console.log('✅ Availability Response:', data)
    return data
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

testAvailabilityAPI()
*/

