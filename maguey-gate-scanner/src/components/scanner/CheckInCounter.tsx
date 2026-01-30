/**
 * CheckInCounter - Real-time check-in counter badge
 *
 * Shows "Checked in: X / Y" at the top of the scanner.
 * Updates via Supabase realtime subscription when online,
 * falls back to local cache when offline.
 */

import { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCheckedInCount } from '@/lib/offline-ticket-cache';

interface CheckInCounterProps {
  eventId: string | null;
}

export function CheckInCounter({ eventId }: CheckInCounterProps) {
  const [count, setCount] = useState({ checkedIn: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!eventId) {
      setCount({ checkedIn: 0, total: 0 });
      return;
    }

    const fetchCount = async () => {
      setIsLoading(true);

      // Try online first if available
      if (navigator.onLine) {
        try {
          // Get scanned count
          const { count: checkedIn, error: checkedInError } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .eq('status', 'scanned');

          if (checkedInError) throw checkedInError;

          // Get total count
          const { count: total, error: totalError } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', eventId);

          if (totalError) throw totalError;

          if (mountedRef.current) {
            setCount({ checkedIn: checkedIn ?? 0, total: total ?? 0 });
          }
        } catch (error) {
          console.error('[CheckInCounter] Online fetch failed:', error);
          // Fall back to cache
          const cached = await getCheckedInCount(eventId);
          if (mountedRef.current) {
            setCount(cached);
          }
        }
      } else {
        // Offline - use cache
        const cached = await getCheckedInCount(eventId);
        if (mountedRef.current) {
          setCount(cached);
        }
      }

      if (mountedRef.current) {
        setIsLoading(false);
      }
    };

    fetchCount();

    // Subscribe to realtime updates when online
    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (navigator.onLine && eventId) {
      channel = supabase
        .channel(`tickets-checkin-${eventId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tickets',
            filter: `event_id=eq.${eventId}`,
          },
          () => {
            // Refetch on any ticket update
            fetchCount();
          }
        )
        .subscribe();
    }

    // Listen for online/offline changes
    const handleOnline = () => fetchCount();
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [eventId]);

  // Don't render if no event selected
  if (!eventId) return null;

  return (
    <div className="bg-black/60 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2">
      <Users className="w-4 h-4 text-white/70" />
      <span className="text-white font-semibold">
        Checked in:{' '}
        <span className={isLoading ? 'opacity-50' : ''}>
          {count.checkedIn.toLocaleString()} / {count.total.toLocaleString()}
        </span>
      </span>
    </div>
  );
}

export default CheckInCounter;
