# Scanner API Reference Implementation

This document provides a reference implementation for the availability API endpoint that needs to be added to your **scanner website**.

## Required Endpoint

Your scanner website needs to expose:

```
GET /functions/v1/event-availability/{eventName}
```

## Implementation Examples

### Option 1: Supabase Edge Function (Recommended)

If your scanner site uses Supabase Edge Functions:

**File: `supabase/functions/event-availability/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get event name from URL path
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const eventName = decodeURIComponent(pathParts[pathParts.length - 1])

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Find the event by name
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('name', eventName)
      .single()

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ eventName, ticketTypes: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Get all ticket types for this event
    const { data: ticketTypes, error: typesError } = await supabase
      .from('ticket_types')
      .select('id, code, total_inventory')
      .eq('event_id', event.id)

    if (typesError || !ticketTypes || ticketTypes.length === 0) {
      return new Response(
        JSON.stringify({ eventName: event.name, ticketTypes: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Count sold tickets for each ticket type
    const availability = await Promise.all(
      ticketTypes.map(async (type) => {
        // Count tickets that are issued (not cancelled/refunded)
        const { count, error } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_type_id', type.id)
          .in('status', ['issued', 'checked_in', 'scanned'])

        const sold = count || 0
        const total = type.total_inventory || 0
        const available = Math.max(0, total - sold)

        return {
          ticketTypeCode: type.code,
          available,
          total,
          sold,
        }
      })
    )

    return new Response(
      JSON.stringify({
        eventName: event.name,
        ticketTypes: availability,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
```

### Option 2: Next.js API Route

If your scanner site uses Next.js:

**File: `pages/api/functions/v1/event-availability/[eventName].ts`**

```typescript
import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const eventName = decodeURIComponent(req.query.eventName as string)

    // 1. Find the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('name', eventName)
      .single()

    if (eventError || !event) {
      return res.status(200).json({ eventName, ticketTypes: [] })
    }

    // 2. Get ticket types
    const { data: ticketTypes, error: typesError } = await supabase
      .from('ticket_types')
      .select('id, code, total_inventory')
      .eq('event_id', event.id)

    if (typesError || !ticketTypes || ticketTypes.length === 0) {
      return res.status(200).json({ eventName: event.name, ticketTypes: [] })
    }

    // 3. Count sold tickets
    const availability = await Promise.all(
      ticketTypes.map(async (type) => {
        const { count } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_type_id', type.id)
          .in('status', ['issued', 'checked_in', 'scanned'])

        const sold = count || 0
        const total = type.total_inventory || 0
        const available = Math.max(0, total - sold)

        return {
          ticketTypeCode: type.code,
          available,
          total,
          sold,
        }
      })
    )

    return res.status(200).json({
      eventName: event.name,
      ticketTypes: availability,
    })
  } catch (error: any) {
    console.error('Error fetching availability:', error)
    return res.status(500).json({ error: error.message })
  }
}
```

### Option 3: Express.js Route

If your scanner site uses Express.js:

**File: `routes/availability.js`**

```javascript
const express = require('express')
const { createClient } = require('@supabase/supabase-js')
const router = express.Router()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

router.get('/functions/v1/event-availability/:eventName', async (req, res) => {
  // Enable CORS
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')

  try {
    const eventName = decodeURIComponent(req.params.eventName)

    // 1. Find the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('name', eventName)
      .single()

    if (eventError || !event) {
      return res.json({ eventName, ticketTypes: [] })
    }

    // 2. Get ticket types
    const { data: ticketTypes, error: typesError } = await supabase
      .from('ticket_types')
      .select('id, code, total_inventory')
      .eq('event_id', event.id)

    if (typesError || !ticketTypes || ticketTypes.length === 0) {
      return res.json({ eventName: event.name, ticketTypes: [] })
    }

    // 3. Count sold tickets
    const availability = await Promise.all(
      ticketTypes.map(async (type) => {
        const { count } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_type_id', type.id)
          .in('status', ['issued', 'checked_in', 'scanned'])

        const sold = count || 0
        const total = type.total_inventory || 0
        const available = Math.max(0, total - sold)

        return {
          ticketTypeCode: type.code,
          available,
          total,
          sold,
        }
      })
    )

    return res.json({
      eventName: event.name,
      ticketTypes: availability,
    })
  } catch (error) {
    console.error('Error fetching availability:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
```

## Supabase Client Setup (Scanner Site)

Your scanner site will need a Supabase client. Create a file similar to this:

**File: `src/lib/supabase.ts` (on scanner site)**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// For API routes, you might want to use service role key instead
// const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For server-side API routes, create a service role client:
// export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
```

## Important Notes

1. **Use Service Role Key**: For API endpoints, use `SUPABASE_SERVICE_ROLE_KEY` instead of the anon key to bypass RLS policies
2. **CORS**: Make sure to enable CORS headers so the purchase website can call your API
3. **Event Name Matching**: The event name must match exactly (case-sensitive) between the database and the URL parameter
4. **Ticket Status**: Count tickets with status `issued`, `checked_in`, or `scanned` as "sold"
5. **Ticket Type Code**: The `ticketTypeCode` in the response must match the `code` field in your `ticket_types` table

## Testing

Test your endpoint:

```bash
curl "https://your-scanner-site.com/functions/v1/event-availability/Reggaeton%20Nights"
```

Expected response:
```json
{
  "eventName": "Reggaeton Nights",
  "ticketTypes": [
    {
      "ticketTypeCode": "VIP-001",
      "available": 15,
      "total": 50,
      "sold": 35
    }
  ]
}
```

## Environment Variables (Scanner Site)

Add these to your scanner site's `.env`:

```bash
# Same Supabase project as purchase site
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# For API routes (server-side)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

