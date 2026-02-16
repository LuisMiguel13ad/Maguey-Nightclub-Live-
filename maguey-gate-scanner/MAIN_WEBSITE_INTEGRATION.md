# Main Website Integration Guide

## Overview

This guide shows how to integrate your Main Website (marketing site) with the Scanner Site's Supabase database to display events. The Main Website will read event data in real-time and automatically sync when events are updated in the Scanner Site admin panel.

## Architecture

```
┌─────────────────────────────────────┐
│      Scanner Site (Admin)          │
│  • Creates/updates events          │
│  • Manages pricing & capacity      │
└──────────────┬──────────────────────┘
               │
               │ Writes to
               ▼
┌─────────────────────────────────────┐
│      Supabase Database              │
│  • events table                     │
│  • Real-time subscriptions         │
└──────────────┬──────────────────────┘
               │
               │ Reads from
               ▼
┌─────────────────────────────────────┐
│      Main Website (Marketing)       │
│  • Displays events                  │
│  • Links to purchase site           │
└─────────────────────────────────────┘
```

## Setup

### 1. Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### 2. Environment Variables

Create a `.env` file in your Main Website project:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:** Use the same Supabase project credentials as your Scanner Site. The anon key is safe to use client-side - Row Level Security (RLS) policies protect your data.

### 3. Initialize Supabase Client

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## Fetching Events

### Basic Event List

```typescript
import { supabase } from '@/lib/supabase'

async function getActiveEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('event_date', { ascending: true })

  if (error) {
    console.error('Error fetching events:', error)
    return []
  }

  return data || []
}
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Event {
  id: string
  name: string
  description: string | null
  event_date: string
  venue_capacity: number
  ticket_types: Array<{
    name: string
    price: number
    capacity: number
  }>
  is_active: boolean
}

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('is_active', true)
          .order('event_date', { ascending: true })

        if (error) throw error
        setEvents(data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  return { events, loading, error }
}
```

## Real-Time Updates

Subscribe to event changes so your Main Website updates automatically when events are modified in the Scanner Site:

```typescript
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useRealtimeEvents(setEvents: (events: Event[]) => void) {
  useEffect(() => {
    // Initial fetch
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .order('event_date', { ascending: true })
      
      if (data) setEvents(data)
    }

    fetchEvents()

    // Subscribe to changes
    const channel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'events',
        },
        () => {
          // Refetch events when any change occurs
          fetchEvents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [setEvents])
}
```

## Displaying Events

### Event Card Component

```typescript
import { format } from 'date-fns'

interface EventCardProps {
  event: Event
  purchaseSiteUrl: string
}

export function EventCard({ event, purchaseSiteUrl }: EventCardProps) {
  const eventDate = new Date(event.event_date)
  const formattedDate = format(eventDate, 'EEEE, MMMM d, yyyy')
  const formattedTime = format(eventDate, 'h:mm a')

  // Get lowest price
  const lowestPrice = Math.min(
    ...event.ticket_types.map(t => t.price)
  )

  return (
    <div className="event-card">
      <h2>{event.name}</h2>
      <p className="description">{event.description}</p>
      
      <div className="event-details">
        <p>
          <strong>Date:</strong> {formattedDate}
        </p>
        <p>
          <strong>Time:</strong> {formattedTime}
        </p>
        <p>
          <strong>Starting at:</strong> ${lowestPrice.toFixed(2)}
        </p>
      </div>

      <a
        href={`${purchaseSiteUrl}/event/${event.id}?name=${encodeURIComponent(event.name)}`}
        className="btn-primary"
      >
        Buy Tickets
      </a>
    </div>
  )
}
```

### Event List Page

```typescript
import { useEvents } from '@/hooks/useEvents'
import { EventCard } from '@/components/EventCard'

const PURCHASE_SITE_URL = 'https://your-purchase-site.com'

export function EventsPage() {
  const { events, loading, error } = useEvents()

  if (loading) return <div>Loading events...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="events-page">
      <h1>Upcoming Events</h1>
      <div className="events-grid">
        {events.map(event => (
          <EventCard
            key={event.id}
            event={event}
            purchaseSiteUrl={PURCHASE_SITE_URL}
          />
        ))}
      </div>
    </div>
  )
}
```

## Filtering Events

### Filter by Date Range

```typescript
async function getUpcomingEvents(daysAhead: number = 30) {
  const startDate = new Date().toISOString()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + daysAhead)
  const endDateISO = endDate.toISOString()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .gte('event_date', startDate)
    .lte('event_date', endDateISO)
    .order('event_date', { ascending: true })

  if (error) throw error
  return data || []
}
```

### Filter Past Events

```typescript
async function getPastEvents() {
  const today = new Date().toISOString()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .lt('event_date', today)
    .order('event_date', { ascending: false })
    .limit(10)

  if (error) throw error
  return data || []
}
```

## Event Detail Page

```typescript
import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function EventDetailPage() {
  const { id } = useParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error:', error)
        return
      }

      setEvent(data)
      setLoading(false)
    }

    fetchEvent()
  }, [id])

  if (loading) return <div>Loading...</div>
  if (!event) return <div>Event not found</div>

  return (
    <div className="event-detail">
      <h1>{event.name}</h1>
      <p>{event.description}</p>
      
      <div className="ticket-types">
        <h2>Ticket Types</h2>
        {event.ticket_types.map((type, index) => (
          <div key={index} className="ticket-type">
            <h3>{type.name}</h3>
            <p>${type.price.toFixed(2)}</p>
          </div>
        ))}
      </div>

      <a
        href={`${PURCHASE_SITE_URL}/event/${event.id}?name=${encodeURIComponent(event.name)}`}
        className="btn-primary"
      >
        Buy Tickets Now
      </a>
    </div>
  )
}
```

## Image Handling

If you store event images in Supabase Storage:

```typescript
function getEventImageUrl(eventId: string, imageName: string) {
  const { data } = supabase.storage
    .from('event-images')
    .getPublicUrl(`${eventId}/${imageName}`)
  
  return data.publicUrl
}

// Usage
<img 
  src={getEventImageUrl(event.id, 'banner.jpg')} 
  alt={event.name}
/>
```

## CORS Configuration

If you encounter CORS issues, ensure your Supabase project allows requests from your Main Website domain:

1. Go to Supabase Dashboard → Settings → API
2. Add your domain to "Allowed CORS origins"
3. Example: `https://your-main-website.com`

## Error Handling

```typescript
async function getEventsWithErrorHandling() {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)

    if (error) {
      // Handle specific error types
      if (error.code === 'PGRST116') {
        console.log('No events found')
        return []
      }
      throw error
    }

    return data || []
  } catch (error: any) {
    console.error('Failed to fetch events:', error.message)
    // Fallback: return empty array or cached data
    return []
  }
}
```

## Performance Optimization

### Cache Events

```typescript
import { useQuery } from '@tanstack/react-query'

export function useCachedEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .order('event_date', { ascending: true })

      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}
```

## Next.js Example

If using Next.js with Server Components:

```typescript
// app/events/page.tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function EventsPage() {
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('event_date', { ascending: true })

  return (
    <div>
      <h1>Events</h1>
      {events?.map(event => (
        <div key={event.id}>
          <h2>{event.name}</h2>
          <p>{event.description}</p>
        </div>
      ))}
    </div>
  )
}
```

## Vanilla JavaScript Example

```javascript
// No framework needed
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_KEY = 'your-anon-key'

async function fetchEvents() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/events?is_active=eq.true&order=event_date.asc`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  )

  const events = await response.json()
  return events
}

// Display events
fetchEvents().then(events => {
  const container = document.getElementById('events')
  events.forEach(event => {
    const card = document.createElement('div')
    card.innerHTML = `
      <h2>${event.name}</h2>
      <p>${event.description || ''}</p>
      <a href="https://purchase-site.com/event/${event.id}">Buy Tickets</a>
    `
    container.appendChild(card)
  })
})
```

## Summary

- ✅ Main Website reads events from Supabase (read-only)
- ✅ Events automatically sync when updated in Scanner Site
- ✅ Real-time subscriptions keep data fresh
- ✅ No duplicate event management needed
- ✅ Simple integration with just Supabase client

Your Main Website will always show the latest events without manual updates!

