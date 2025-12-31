/**
 * Real-time Sync Service
 * 
 * Enhanced real-time synchronization between scanners with live capacity updates
 * and fraud alerts
 */

import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { logAuditEvent } from './audit-service';

export interface CapacityUpdate {
  event_name: string;
  current_count: number;
  capacity: number;
  available: number;
  is_sold_out: boolean;
  timestamp: string;
}

export interface FraudAlert {
  ticket_id: string;
  event_name: string;
  alert_type: 'duplicate_scan' | 'suspicious_pattern' | 'invalid_ticket' | 'capacity_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface ScanUpdate {
  ticket_id: string;
  event_name: string;
  scanned_by: string;
  scanned_at: string;
  status: 'valid' | 'invalid' | 'used';
}

type CapacityUpdateCallback = (update: CapacityUpdate) => void;
type FraudAlertCallback = (alert: FraudAlert) => void;
type ScanUpdateCallback = (update: ScanUpdate) => void;

class RealtimeSyncService {
  private capacityChannels: Map<string, any> = new Map();
  private fraudChannels: Map<string, any> = new Map();
  private scanChannels: Map<string, any> = new Map();
  private capacityCallbacks: Set<CapacityUpdateCallback> = new Set();
  private fraudCallbacks: Set<FraudAlertCallback> = new Set();
  private scanCallbacks: Set<ScanUpdateCallback> = new Set();

  /**
   * Subscribe to real-time capacity updates for an event
   */
  subscribeToCapacityUpdates(
    eventName: string,
    callback: CapacityUpdateCallback
  ): () => void {
    if (!isSupabaseConfigured()) {
      console.warn('[RealtimeSync] Supabase not configured, cannot subscribe to capacity updates');
      return () => {};
    }

    this.capacityCallbacks.add(callback);

    // Subscribe to ticket changes for this event
    const channelName = `capacity:${eventName}`;
    if (this.capacityChannels.has(channelName)) {
      return () => {}; // Already subscribed
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `event_name=eq.${eventName}`,
        },
        async () => {
          // Fetch updated capacity
          const capacity = await this.getEventCapacity(eventName);
          if (capacity) {
            this.capacityCallbacks.forEach(cb => cb(capacity));
          }
        }
      )
      .subscribe();

    this.capacityChannels.set(channelName, channel);

    // Initial capacity fetch
    this.getEventCapacity(eventName).then(capacity => {
      if (capacity) {
        callback(capacity);
      }
    });

    return () => {
      this.capacityCallbacks.delete(callback);
      if (this.capacityCallbacks.size === 0 && this.capacityChannels.has(channelName)) {
        supabase.removeChannel(this.capacityChannels.get(channelName));
        this.capacityChannels.delete(channelName);
      }
    };
  }

  /**
   * Subscribe to fraud alerts
   */
  subscribeToFraudAlerts(callback: FraudAlertCallback): () => void {
    if (!isSupabaseConfigured()) {
      console.warn('[RealtimeSync] Supabase not configured, cannot subscribe to fraud alerts');
      return () => {};
    }

    this.fraudCallbacks.add(callback);

    const channelName = 'fraud-alerts';
    if (this.fraudChannels.has(channelName)) {
      return () => {}; // Already subscribed
    }

    // Subscribe to scan_logs for fraud detection
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scan_logs',
          filter: 'scan_result=eq.invalid',
        },
        async (payload) => {
          const scanLog = payload.new as any;
          
          // Check for fraud patterns
          const fraudAlert = await this.detectFraudPattern(scanLog);
          if (fraudAlert) {
            this.fraudCallbacks.forEach(cb => cb(fraudAlert));
            
            // Log fraud alert
            await logAuditEvent(
              'fraud_alert',
              'scan_log',
              `Fraud alert: ${fraudAlert.description}`,
              {
                resourceId: scanLog.id,
                severity: fraudAlert.severity,
                metadata: fraudAlert.metadata,
              }
            );
          }
        }
      )
      .subscribe();

    this.fraudChannels.set(channelName, channel);

    return () => {
      this.fraudCallbacks.delete(callback);
      if (this.fraudCallbacks.size === 0 && this.fraudChannels.has(channelName)) {
        supabase.removeChannel(this.fraudChannels.get(channelName));
        this.fraudChannels.delete(channelName);
      }
    };
  }

  /**
   * Subscribe to scan updates across all scanners
   */
  subscribeToScanUpdates(
    eventName: string,
    callback: ScanUpdateCallback
  ): () => void {
    if (!isSupabaseConfigured()) {
      console.warn('[RealtimeSync] Supabase not configured, cannot subscribe to scan updates');
      return () => {};
    }

    this.scanCallbacks.add(callback);

    const channelName = `scans:${eventName}`;
    if (this.scanChannels.has(channelName)) {
      return () => {}; // Already subscribed
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scan_logs',
        },
        async (payload) => {
          const scanLog = payload.new as any;
          
          // Get ticket info
          if (scanLog.ticket_id) {
            const { data: ticket } = await supabase
              .from('tickets')
              .select('event_name, ticket_id')
              .eq('id', scanLog.ticket_id)
              .single();

            if (ticket && ticket.event_name === eventName) {
              const update: ScanUpdate = {
                ticket_id: ticket.ticket_id || scanLog.ticket_id,
                event_name: ticket.event_name,
                scanned_by: scanLog.scanned_by || 'unknown',
                scanned_at: scanLog.scanned_at,
                status: scanLog.scan_result === 'valid' ? 'valid' : 
                       scanLog.scan_result === 'used' ? 'used' : 'invalid',
              };
              
              this.scanCallbacks.forEach(cb => cb(update));
            }
          }
        }
      )
      .subscribe();

    this.scanChannels.set(channelName, channel);

    return () => {
      this.scanCallbacks.delete(callback);
      if (this.scanCallbacks.size === 0 && this.scanChannels.has(channelName)) {
        supabase.removeChannel(this.scanChannels.get(channelName));
        this.scanChannels.delete(channelName);
      }
    };
  }

  /**
   * Get current event capacity
   */
  private async getEventCapacity(eventName: string): Promise<CapacityUpdate | null> {
    try {
      // Get event details
      const { data: event } = await supabase
        .from('events')
        .select('venue_capacity')
        .eq('name', eventName)
        .single();

      if (!event) return null;

      // Count tickets sold
      const { count: ticketsSold } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', eventName)
        .eq('status', 'issued');

      const currentCount = ticketsSold || 0;
      const available = Math.max(0, event.venue_capacity - currentCount);

      return {
        event_name: eventName,
        current_count: currentCount,
        capacity: event.venue_capacity,
        available,
        is_sold_out: available === 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[RealtimeSync] Error getting capacity:', error);
      return null;
    }
  }

  /**
   * Detect fraud patterns from scan log
   */
  private async detectFraudPattern(scanLog: any): Promise<FraudAlert | null> {
    // Check for duplicate scans
    if (scanLog.scan_result === 'used') {
      return {
        ticket_id: scanLog.ticket_id || 'unknown',
        event_name: scanLog.metadata?.event_name || 'unknown',
        alert_type: 'duplicate_scan',
        severity: 'high',
        description: `Duplicate scan attempt detected for ticket ${scanLog.ticket_id}`,
        metadata: {
          scanned_by: scanLog.scanned_by,
          previous_scan: scanLog.metadata?.previous_scan_at,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Check for suspicious patterns (multiple invalid scans in short time)
    if (scanLog.scan_result === 'invalid') {
      const { count } = await supabase
        .from('scan_logs')
        .select('id', { count: 'exact', head: true })
        .eq('scanned_by', scanLog.scanned_by)
        .eq('scan_result', 'invalid')
        .gte('scanned_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

      if (count && count > 10) {
        return {
          ticket_id: scanLog.ticket_id || 'unknown',
          event_name: scanLog.metadata?.event_name || 'unknown',
          alert_type: 'suspicious_pattern',
          severity: 'medium',
          description: `Suspicious pattern: ${count} invalid scans in last 5 minutes`,
          metadata: {
            scanned_by: scanLog.scanned_by,
            invalid_count: count,
          },
          timestamp: new Date().toISOString(),
        };
      }
    }

    return null;
  }

  /**
   * Broadcast fraud alert to all connected scanners
   */
  async broadcastFraudAlert(alert: FraudAlert): Promise<void> {
    if (!isSupabaseConfigured()) return;

    try {
      // Store alert in database for persistence
      await supabase
        .from('notifications')
        .insert({
          type: 'fraud_alert',
          title: `Fraud Alert: ${alert.alert_type}`,
          message: alert.description,
          severity: alert.severity,
          metadata: {
            ...alert.metadata,
            ticket_id: alert.ticket_id,
            event_name: alert.event_name,
            alert_type: alert.alert_type,
          },
          status: 'sent',
        });

      // Notify all callbacks
      this.fraudCallbacks.forEach(cb => cb(alert));
    } catch (error) {
      console.error('[RealtimeSync] Error broadcasting fraud alert:', error);
    }
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    this.capacityChannels.forEach(channel => supabase.removeChannel(channel));
    this.fraudChannels.forEach(channel => supabase.removeChannel(channel));
    this.scanChannels.forEach(channel => supabase.removeChannel(channel));
    
    this.capacityChannels.clear();
    this.fraudChannels.clear();
    this.scanChannels.clear();
    this.capacityCallbacks.clear();
    this.fraudCallbacks.clear();
    this.scanCallbacks.clear();
  }
}

// Singleton instance
export const realtimeSyncService = new RealtimeSyncService();


