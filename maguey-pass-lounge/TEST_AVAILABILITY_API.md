# Testing Availability API

This guide shows you how to test the availability API endpoint.

## Option 1: Command Line Test (Recommended)

Run the test script from your terminal:

```bash
npm run test:availability
```

This will:
- Test the availability API endpoint
- Show the response structure
- Validate the data format
- Provide helpful error messages if the endpoint isn't implemented

## Option 2: Browser Console Test

### Method A: Import and Call

In your React component or browser console:

```typescript
import { testAvailabilityAPI } from '@/lib/test-availability-browser'

// Call the function
await testAvailabilityAPI()
```

### Method B: Copy-Paste into Browser Console

1. Open your browser's developer console (F12)
2. Copy and paste this code:

```javascript
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
```

3. Press Enter to run

## Expected Response

If the API is working correctly, you should see:

```json
{
  "eventName": "New Years Eve 2025 Celebration",
  "ticketTypes": [
    {
      "ticketTypeCode": "VIP-001",
      "available": 15,
      "total": 50,
      "sold": 35
    },
    {
      "ticketTypeCode": "GEN-001",
      "available": 0,
      "total": 100,
      "sold": 100
    }
  ]
}
```

## Troubleshooting

### Error: 404 Not Found

The availability endpoint hasn't been implemented on your scanner website yet.

**Solution:** See `SCANNER_API_REFERENCE.md` for implementation examples.

### Error: CORS Error

The scanner API isn't allowing requests from your purchase website.

**Solution:** Make sure CORS headers are enabled on your scanner API endpoint.

### Error: Network Error

The scanner API URL might be incorrect or the server is down.

**Solution:** 
1. Check `VITE_SCANNER_API_URL` in your `.env` file
2. Verify the scanner website is running
3. Test the endpoint directly with curl:

```bash
curl "https://your-scanner-site.com/functions/v1/event-availability/New%20Years%20Eve%202025%20Celebration"
```

## Files Created

- `test-availability-api.ts` - Command line test script
- `src/lib/test-availability-browser.ts` - Browser console version

## Next Steps

1. **If endpoint doesn't exist:** Implement it on your scanner website (see `SCANNER_API_REFERENCE.md`)
2. **If endpoint exists:** Verify the response format matches expectations
3. **If testing passes:** The purchase website will automatically use availability data

