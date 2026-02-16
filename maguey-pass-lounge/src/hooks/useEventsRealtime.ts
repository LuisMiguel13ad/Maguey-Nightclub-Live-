/**
 * useEventsRealtime Hook
 *
 * Provides real-time event updates for the purchase site.
 * Subscribes to postgres_changes on the events table to ensure
 * events created in the dashboard appear within seconds.
 *
 * Supabase real-time typically delivers within 100ms, exceeding
 * the 30-second sync requirement.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface UseEventsRealtimeOptions {
  onEventChange?: (event: Event, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  filter?: {
    upcomingOnly?: boolean;
    minDate?: Date;
  };
}

export interface UseEventsRealtimeReturn {
  events: Event[];
  isLoading: boolean;
  isLive: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useEventsRealtime(
  options: UseEventsRealtimeOptions = {}
): UseEventsRealtimeReturn {
  const { filter, onEventChange } = options;

  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventChangeRef = useRef(onEventChange);

  // Keep callback ref fresh without triggering re-subscriptions
  useEffect(() => {
    onEventChangeRef.current = onEventChange;
  }, [onEventChange]);

  // Fetch events from database
  const fetchEvents = useCallback(async () => {
    try {
      let query = supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      // Apply upcoming filter if specified
      if (filter?.upcomingOnly !== false) {
        const today = filter?.minDate || new Date();
        const dateStr = today.toISOString().split('T')[0];
        query = query.gte('event_date', dateStr);
      }

      // Exclude cancelled events (if cancellation_status column exists)
      // Using a generic filter that won't fail if column doesn't exist
      query = query.neq('cancellation_status', 'cancelled');

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Filter to only published/active events (not draft or archived)
      const activeEvents = (data || []).filter(
        (event) => !event.status || event.status === 'published'
      );

      setEvents(activeEvents);
      setError(null);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to fetch events');
      setError(errorObj);
      console.error('[useEventsRealtime] Fetch error:', err);
    }
  }, [filter?.upcomingOnly, filter?.minDate]);

  // Refetch function exposed to consumers
  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchEvents();
    setIsLoading(false);
  }, [fetchEvents]);

  // Check if event matches current filter
  const matchesFilter = useCallback(
    (event: Event): boolean => {
      // Check if upcoming
      if (filter?.upcomingOnly !== false) {
        const today = filter?.minDate || new Date();
        const eventDate = new Date(event.event_date);
        if (eventDate < today) {
          return false;
        }
      }

      // Check if not cancelled
      if ((event as any).cancellation_status === 'cancelled') {
        return false;
      }

      // Check if not draft/archived
      if (event.status && event.status !== 'published') {
        return false;
      }

      return true;
    },
    [filter?.upcomingOnly, filter?.minDate]
  );

  // Handle real-time event changes
  const handleRealtimeChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Event>) => {
      const eventType = payload.eventType;

      if (eventType === 'INSERT') {
        const newEvent = payload.new as Event;
        if (matchesFilter(newEvent)) {
          setEvents((prev) => {
            // Add and sort by date
            const updated = [...prev, newEvent];
            return updated.sort((a, b) =>
              new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
            );
          });
          onEventChangeRef.current?.(newEvent, 'INSERT');
        }
      } else if (eventType === 'UPDATE') {
        const updatedEvent = payload.new as Event;
        if (matchesFilter(updatedEvent)) {
          setEvents((prev) => {
            const exists = prev.some((e) => e.id === updatedEvent.id);
            if (exists) {
              // Update existing
              return prev
                .map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
                .sort((a, b) =>
                  new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
                );
            } else {
              // Add new (event now matches filter)
              return [...prev, updatedEvent].sort((a, b) =>
                new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
              );
            }
          });
          onEventChangeRef.current?.(updatedEvent, 'UPDATE');
        } else {
          // Event no longer matches filter (e.g., cancelled)
          setEvents((prev) => prev.filter((e) => e.id !== updatedEvent.id));
          onEventChangeRef.current?.(updatedEvent, 'UPDATE');
        }
      } else if (eventType === 'DELETE') {
        const deletedEvent = payload.old as Event;
        setEvents((prev) => prev.filter((e) => e.id !== deletedEvent.id));
        onEventChangeRef.current?.(deletedEvent, 'DELETE');
      }
    },
    [matchesFilter]
  );

  // Setup real-time subscription
  useEffect(() => {
    // Initial fetch
    setIsLoading(true);
    fetchEvents().then(() => setIsLoading(false));

    // Setup real-time subscription
    const channelName = `events-realtime-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
        },
        (payload) => {
          handleRealtimeChange(payload as RealtimePostgresChangesPayload<Event>);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLive(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsLive(false);
        }
      });

    channelRef.current = channel;

    // Handle visibility change - refresh when tab regains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchEvents, handleRealtimeChange, refetch]);

  return {
    events,
    isLoading,
    isLive,
    error,
    refetch,
  };
}
