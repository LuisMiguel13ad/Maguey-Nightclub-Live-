/**
 * CheckInProgress Component
 *
 * Displays check-in progress visualization per CONTEXT.md:
 * - "X / Y checked in" format
 * - Progress bar showing percentage
 * - Real-time updates when tickets are scanned
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Users, CheckCircle2 } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface CheckInProgressProps {
  eventId?: string;
  eventName?: string;
  showDetails?: boolean;
}

interface EventCheckInData {
  eventId: string;
  eventName: string;
  totalTickets: number;
  checkedIn: number;
  percentage: number;
}

export function CheckInProgress({
  eventId,
  eventName,
  showDetails = true,
}: CheckInProgressProps) {
  const [checkInData, setCheckInData] = useState<EventCheckInData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch check-in data
  const fetchCheckInData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      // If specific event ID provided, fetch only that event
      if (eventId) {
        const { data: tickets, error } = await supabase
          .from('tickets')
          .select('id, scanned_at, status')
          .eq('event_id', eventId);

        if (error) throw error;

        const totalTickets = tickets?.length || 0;
        const checkedIn = tickets?.filter(
          (t) => t.scanned_at || t.status === 'scanned' || t.status === 'used'
        ).length || 0;
        const percentage = totalTickets > 0 ? (checkedIn / totalTickets) * 100 : 0;

        setCheckInData([
          {
            eventId,
            eventName: eventName || 'Current Event',
            totalTickets,
            checkedIn,
            percentage,
          },
        ]);
      } else {
        // Fetch for all upcoming events
        const today = new Date().toISOString().split('T')[0];
        const { data: events, error: eventsError } = await supabase
          .from('events')
          .select('id, name')
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .limit(5);

        if (eventsError) throw eventsError;

        if (!events || events.length === 0) {
          setCheckInData([]);
          setIsLoading(false);
          return;
        }

        // Fetch tickets for each event
        const results = await Promise.all(
          events.map(async (event) => {
            const { data: tickets, error } = await supabase
              .from('tickets')
              .select('id, scanned_at, status')
              .eq('event_id', event.id);

            if (error) {
              console.error(`Error fetching tickets for event ${event.name}:`, error);
              return {
                eventId: event.id,
                eventName: event.name,
                totalTickets: 0,
                checkedIn: 0,
                percentage: 0,
              };
            }

            const totalTickets = tickets?.length || 0;
            const checkedIn = tickets?.filter(
              (t) => t.scanned_at || t.status === 'scanned' || t.status === 'used'
            ).length || 0;
            const percentage = totalTickets > 0 ? (checkedIn / totalTickets) * 100 : 0;

            return {
              eventId: event.id,
              eventName: event.name,
              totalTickets,
              checkedIn,
              percentage,
            };
          })
        );

        // Filter to events with tickets sold
        const eventsWithTickets = results.filter((e) => e.totalTickets > 0);
        setCheckInData(eventsWithTickets);
      }
    } catch (error) {
      console.error('[CheckInProgress] Error fetching check-in data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, eventName]);

  // Setup real-time subscription for ticket updates
  useEffect(() => {
    fetchCheckInData();

    if (!isSupabaseConfigured()) return;

    // Subscribe to ticket changes for real-time updates
    const channelName = `checkin-progress-${eventId || 'all'}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          ...(eventId && { filter: `event_id=eq.${eventId}` }),
        },
        () => {
          // Refetch on any ticket update (check-in)
          fetchCheckInData();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [eventId, fetchCheckInData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Check-In Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-2 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (checkInData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Check-In Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No check-ins yet
          </p>
          <Progress value={0} className="mt-2 h-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Check-In Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {checkInData.map((data) => (
          <div key={data.eventId} className="space-y-2">
            {showDetails && checkInData.length > 1 && (
              <p className="text-sm font-medium text-foreground truncate">
                {data.eventName}
              </p>
            )}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-lg font-semibold">
                  {data.checkedIn} / {data.totalTickets}
                </span>
                <span className="text-sm text-muted-foreground">checked in</span>
              </div>
              <span className="text-sm font-medium text-green-600">
                {data.percentage.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={data.percentage}
              className="h-2 transition-all duration-500"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
