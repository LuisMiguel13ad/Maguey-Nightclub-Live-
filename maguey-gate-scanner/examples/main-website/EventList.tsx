/**
 * Example: Event List Component for Main Website
 * 
 * This component displays a list of active events fetched from Supabase.
 * Use this as a starting point for your Main Website's events page.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { EventCard } from './EventCard'

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

const PURCHASE_SITE_URL = import.meta.env.VITE_PURCHASE_SITE_URL || 'https://tickets.yourclub.com'

export function EventList() {
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
          .eq('status', 'published')
          .order('event_date', { ascending: true })

        if (error) throw error
        setEvents(data || [])
      } catch (err: any) {
        setError(err.message)
        console.error('Error fetching events:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
        },
        () => {
          // Refetch when events change
          fetchEvents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <div className="events-loading">
        <p>Loading events...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="events-error">
        <p>Error loading events: {error}</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="events-empty">
        <p>No upcoming events at this time.</p>
      </div>
    )
  }

  return (
    <div className="events-list">
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

