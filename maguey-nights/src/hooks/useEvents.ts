import { useState, useEffect } from 'react'
import { fetchActiveEvents, EventDisplay } from '@/services/eventService'
import { supabase } from '@/lib/supabase'

export const useEvents = () => {
  const [events, setEvents] = useState<EventDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchActiveEvents()
        setEvents(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load events'
        setError(errorMessage)
        console.error('Error loading events:', err)
      } finally {
        setLoading(false)
      }
    }

    // Initial load
    loadEvents()

    // Set up real-time subscription for events table changes
    // Note: Removing filter to catch all changes, then filter in loadEvents
    const channel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'events',
        },
        () => {
          // Reload events when changes occur
          loadEvents()
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { events, loading, error }
}

