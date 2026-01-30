import { supabase } from './supabase';

export interface ScannerStatus {
  deviceId: string;
  deviceName?: string;
  lastHeartbeat: string;
  isOnline: boolean;
  pendingScans: number;
  currentEventId?: string;
  currentEventName?: string;
  scansToday: number;
  batteryLevel?: number; // If available from device API
}

// Heartbeat considered stale after 60 seconds
const HEARTBEAT_STALE_MS = 60 * 1000;

/**
 * Get or create device ID (reuse from offline-queue-service pattern)
 */
export function getDeviceId(): string {
  const stored = localStorage.getItem('scanner_device_id');
  if (stored) return stored;

  const deviceId = `scanner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('scanner_device_id', deviceId);
  return deviceId;
}

/**
 * Get device name from localStorage
 */
export function getDeviceName(): string {
  return localStorage.getItem('scanner_device_name') || 'Unnamed Scanner';
}

/**
 * Set device name in localStorage
 */
export function setDeviceName(name: string): void {
  localStorage.setItem('scanner_device_name', name);
}

/**
 * Send heartbeat to track scanner status
 */
export async function sendHeartbeat(options: {
  eventId?: string;
  eventName?: string;
  pendingScans: number;
  scansToday: number;
}): Promise<boolean> {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();

  try {
    const { error } = await supabase
      .from('scanner_heartbeats')
      .upsert({
        device_id: deviceId,
        device_name: deviceName,
        last_heartbeat: new Date().toISOString(),
        is_online: navigator.onLine,
        pending_scans: options.pendingScans,
        current_event_id: options.eventId || null,
        current_event_name: options.eventName || null,
        scans_today: options.scansToday,
      }, {
        onConflict: 'device_id',
      });

    if (error) {
      console.error('[scanner-status] Heartbeat failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[scanner-status] Heartbeat error:', error);
    return false;
  }
}

/**
 * Get all scanner statuses (for dashboard display)
 */
export async function getScannerStatuses(): Promise<ScannerStatus[]> {
  try {
    const { data, error } = await supabase
      .from('scanner_heartbeats')
      .select('*')
      .order('last_heartbeat', { ascending: false });

    if (error) throw error;

    const now = Date.now();

    return (data || []).map(row => ({
      deviceId: row.device_id,
      deviceName: row.device_name,
      lastHeartbeat: row.last_heartbeat,
      // Consider online if heartbeat is recent AND device reported online
      isOnline: row.is_online && (now - new Date(row.last_heartbeat).getTime() < HEARTBEAT_STALE_MS),
      pendingScans: row.pending_scans || 0,
      currentEventId: row.current_event_id,
      currentEventName: row.current_event_name,
      scansToday: row.scans_today || 0,
    }));
  } catch (error) {
    console.error('[scanner-status] Failed to get statuses:', error);
    return [];
  }
}
