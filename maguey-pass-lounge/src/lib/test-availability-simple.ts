// Test availability API - Simple version
// Copy this entire function into browser console, or import and call it

export async function testAvailabilityAPI() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  const API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !API_KEY) {
    console.error('❌ Missing Supabase credentials!')
    return
  }

  const eventName = 'New Years Eve 2025 Celebration'
  const encodedEventName = encodeURIComponent(eventName)

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/event-availability/${encodedEventName}`,
      {
        headers: {
          'apikey': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error(`❌ Request failed: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error('Response:', errorText)
      return
    }

    const data = await response.json()
    console.log('Availability Response:', data)

    // Should see:
    // {
    //   "eventName": "New Years Eve 2025 Celebration",
    //   "ticketTypes": [
    //     { "ticketTypeCode": "...", "available": X, "total": Y, "sold": Z }
    //   ]
    // }

    return data
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

// Browser console version - copy this entire block:
/*
async function testAvailabilityAPI() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  const API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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
  console.log('Availability Response:', data)

  // Should see:
  // {
  //   "eventName": "New Years Eve 2025 Celebration",
  //   "ticketTypes": [
  //     { "ticketTypeCode": "...", "available": X, "total": Y, "sold": Z }
  //   ]
  // }
}

testAvailabilityAPI()
*/

