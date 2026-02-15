/**
 * useDashboardRealtime Hook
 *
 * Real-time subscription hook with visibility-aware reconnection for dashboard.
 * Automatically reconnects when tab regains focus to catch up on missed updates.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type TableName = 'tickets' | 'orders' | 'vip_reservations' | 'scan_logs' | 'email_queue' | 'scanner_heartbeats' | 'events';

interface UseDashboardRealtimeOptions {
  eventId?: string;
  tables?: TableName[];
  onUpdate?: () => void;                              // Keep existing: fires on any change
  onTableUpdate?: Partial<Record<TableName, () => void>>;  // NEW: per-table callbacks
}

interface UseDashboardRealtimeReturn {
  isLive: boolean;
  lastUpdate: Date;
  reconnect: () => void;
}

const DEFAULT_TABLES: TableName[] = ['tickets', 'orders', 'vip_reservations'];

export function useDashboardRealtime(
  options: UseDashboardRealtimeOptions = {}
): UseDashboardRealtimeReturn {
  const { tables = DEFAULT_TABLES, onUpdate, onTableUpdate } = options;

  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const onTableUpdateRef = useRef(onTableUpdate);

  // Keep onUpdate ref fresh without triggering re-subscriptions
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Keep onTableUpdate ref fresh without triggering re-subscriptions
  useEffect(() => {
    onTableUpdateRef.current = onTableUpdate;
  }, [onTableUpdate]);

  // Setup subscription
  const setupSubscription = useCallback(() => {
    if (!isSupabaseConfigured()) {
      console.warn('[useDashboardRealtime] Supabase not configured');
      return;
    }

    // Clean up existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `dashboard-realtime-${Date.now()}`;
    let channel = supabase.channel(channelName);

    // Subscribe to each table for postgres_changes
    tables.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        () => {
          setLastUpdate(new Date());
          // Dispatch to table-specific callback if available
          const tableCallback = onTableUpdateRef.current?.[table];
          if (tableCallback) {
            tableCallback();
          } else {
            // Fallback to generic onUpdate
            onUpdateRef.current?.();
          }
        }
      );
    });

    // Track subscription status
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsLive(true);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsLive(false);
      }
    });

    channelRef.current = channel;
  }, [tables]);

  // Handle visibility change (tab backgrounding/foregrounding)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible - reconnect and refresh data
        setupSubscription();
        setLastUpdate(new Date());
        // Refresh all sections on tab focus
        if (onTableUpdateRef.current) {
          Object.values(onTableUpdateRef.current).forEach(cb => cb?.());
        }
        onUpdateRef.current?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setupSubscription]);

  // Initial subscription setup
  useEffect(() => {
    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [setupSubscription]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    setupSubscription();
    setLastUpdate(new Date());
    onUpdateRef.current?.();
  }, [setupSubscription]);

  return {
    isLive,
    lastUpdate,
    reconnect,
  };
}
