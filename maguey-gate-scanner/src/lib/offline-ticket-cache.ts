/**
 * Offline Ticket Cache Service
 *
 * Provides local ticket validation when network is unavailable.
 * Uses Dexie.js (IndexedDB) for persistent offline storage.
 * Handles race conditions with first-scan-wins conflict resolution.
 */

import Dexie, { Table } from 'dexie';
import { supabase } from './supabase';

// ============================================================================
// Types
// ============================================================================

export interface CachedTicket {
  ticketId: string; // Primary key
  eventId: string;
  qrToken: string; // For lookup during scan
  qrSignature?: string;
  status: 'valid' | 'scanned';
  guestName?: string;
  ticketType: string;
  scannedAt?: string;
  scannedBy?: string; // User ID who scanned
  scannedByName?: string; // Display name for UI
  syncedAt: string; // When this cache entry was updated
}

export interface CacheMetadata {
  eventId: string; // Primary key
  eventName: string;
  lastSyncAt: string;
  ticketCount: number;
  totalCapacity: number;
  scannedCount: number;
}

export interface OfflineScanRecord {
  id?: number; // Auto-generated
  ticketId: string;
  qrToken: string;
  scannedAt: string; // Timestamp when scanned offline
  scannedBy?: string;
  deviceId: string;
  syncStatus: 'pending' | 'synced' | 'conflict' | 'failed';
  conflictResolution?: {
    winner: 'local' | 'remote';
    winnerTime: string;
    winnerDevice: string;
  };
}

// ============================================================================
// Database
// ============================================================================

class TicketCacheDatabase extends Dexie {
  cachedTickets!: Table<CachedTicket, string>;
  cacheMetadata!: Table<CacheMetadata, string>;
  offlineScans!: Table<OfflineScanRecord, number>;

  constructor() {
    super('TicketCacheDatabase');
    this.version(1).stores({
      cachedTickets: 'ticketId, eventId, qrToken, status',
      cacheMetadata: 'eventId',
      offlineScans: '++id, ticketId, syncStatus, scannedAt',
    });
  }
}

const db = new TicketCacheDatabase();

// ============================================================================
// Device ID
// ============================================================================

/**
 * Get or create a unique device ID for conflict resolution tracking
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('scanner_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('scanner_device_id', deviceId);
  }
  return deviceId;
}

// ============================================================================
// Listener Pattern
// ============================================================================

type CacheListener = (eventId: string, metadata: CacheMetadata) => void;
const listeners: CacheListener[] = [];

function notifyListeners(eventId: string, metadata: CacheMetadata) {
  listeners.forEach((l) => l(eventId, metadata));
}

/**
 * Subscribe to cache updates for real-time UI updates
 * @returns Unsubscribe function
 */
export function subscribeToCacheUpdates(listener: CacheListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
}

// ============================================================================
// Core Cache Functions
// ============================================================================

/**
 * Sync (download) tickets for an event into local cache
 * Call this when an event is selected or periodically to refresh
 */
export async function syncTicketCache(eventId: string): Promise<{
  success: boolean;
  ticketCount: number;
  error?: string;
}> {
  try {
    // Fetch event info
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

    // Fetch all tickets for this event
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select(
        `
        id,
        ticket_id,
        qr_code_data,
        qr_token,
        status,
        is_used,
        guest_name,
        attendee_name,
        ticket_type,
        scanned_at,
        scanned_by
      `
      )
      .eq('event_id', eventId);

    if (ticketsError) throw ticketsError;

    // Get scanned count
    const scannedCount = (tickets || []).filter(
      (t) => t.is_used || t.status === 'scanned'
    ).length;

    // Clear existing cache for this event
    await db.cachedTickets.where('eventId').equals(eventId).delete();

    // Insert new cache entries
    const now = new Date().toISOString();
    const cacheEntries: CachedTicket[] = (tickets || []).map((t) => ({
      ticketId: t.id,
      eventId,
      qrToken: t.qr_token || t.qr_code_data || t.ticket_id,
      status: t.is_used || t.status === 'scanned' ? 'scanned' : 'valid',
      guestName: t.guest_name || t.attendee_name || undefined,
      ticketType: t.ticket_type || 'General',
      scannedAt: t.scanned_at || undefined,
      scannedBy: t.scanned_by || undefined,
      syncedAt: now,
    }));

    await db.cachedTickets.bulkPut(cacheEntries);

    // Update metadata
    await db.cacheMetadata.put({
      eventId,
      eventName: eventData.name,
      lastSyncAt: now,
      ticketCount: cacheEntries.length,
      totalCapacity: cacheEntries.length,
      scannedCount,
    });

    // Notify listeners
    const metadata = await db.cacheMetadata.get(eventId);
    if (metadata) notifyListeners(eventId, metadata);

    console.log(
      '[offline-ticket-cache] Synced',
      cacheEntries.length,
      'tickets for event',
      eventId
    );
    return { success: true, ticketCount: cacheEntries.length };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[offline-ticket-cache] Sync failed:', error);
    return { success: false, ticketCount: 0, error: errorMessage };
  }
}

/**
 * Validate a ticket offline against the local cache
 * @param qrToken The QR code token to look up
 * @param eventId Optional event ID to filter (ensures ticket is for correct event)
 */
export async function validateOffline(
  qrToken: string,
  eventId?: string
): Promise<{
  status: 'valid' | 'scanned' | 'not_in_cache' | 'wrong_event';
  ticket?: CachedTicket;
}> {
  // Try to find by qrToken
  const ticket = await db.cachedTickets.where('qrToken').equals(qrToken).first();

  if (!ticket) {
    return { status: 'not_in_cache' };
  }

  // Check event match if eventId filter is provided
  if (eventId && ticket.eventId !== eventId) {
    return { status: 'wrong_event', ticket };
  }

  return { status: ticket.status, ticket };
}

/**
 * Mark a ticket as scanned in local cache and record for later sync
 * Records the scan timestamp for first-scan-wins conflict resolution
 */
export async function markAsScannedOffline(
  ticketId: string,
  scannedBy?: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const ticket = await db.cachedTickets.get(ticketId);

    if (!ticket) return false;

    // Update local cache
    await db.cachedTickets.update(ticketId, {
      status: 'scanned',
      scannedAt: now,
      scannedBy,
      syncedAt: now,
    });

    // Record offline scan for later sync with conflict resolution
    await db.offlineScans.add({
      ticketId,
      qrToken: ticket.qrToken,
      scannedAt: now,
      scannedBy,
      deviceId: getDeviceId(),
      syncStatus: 'pending',
    });

    // Update scanned count in metadata
    const metadata = await db.cacheMetadata.get(ticket.eventId);
    if (metadata) {
      await db.cacheMetadata.update(ticket.eventId, {
        scannedCount: metadata.scannedCount + 1,
      });
      notifyListeners(ticket.eventId, {
        ...metadata,
        scannedCount: metadata.scannedCount + 1,
      });
    }

    return true;
  } catch (error) {
    console.error('[offline-ticket-cache] Failed to mark as scanned:', error);
    return false;
  }
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Sync pending offline scans to the server with first-scan-wins resolution
 * Call this when coming back online to sync all pending scans
 */
export async function resolveOfflineConflicts(): Promise<{
  synced: number;
  conflicts: number;
  failed: number;
  results: Array<{
    ticketId: string;
    result: 'synced' | 'conflict_won' | 'conflict_lost' | 'failed';
    message?: string;
  }>;
}> {
  const pendingScans = await db.offlineScans
    .where('syncStatus')
    .equals('pending')
    .toArray();

  const results: Array<{
    ticketId: string;
    result: 'synced' | 'conflict_won' | 'conflict_lost' | 'failed';
    message?: string;
  }> = [];

  let synced = 0;
  let conflicts = 0;
  let failed = 0;

  for (const scan of pendingScans) {
    try {
      // Call the database function for first-scan-wins resolution
      const { data, error } = await supabase.rpc('sync_offline_scan', {
        p_ticket_id: scan.ticketId,
        p_scanned_by: scan.scannedBy || null,
        p_scanned_at: scan.scannedAt,
        p_device_id: scan.deviceId,
      });

      if (error) throw error;

      const result = data?.[0];

      if (result?.success) {
        if (result.conflict_resolved) {
          // We won the conflict - our scan was earlier
          await db.offlineScans.update(scan.id!, {
            syncStatus: 'synced',
            conflictResolution: {
              winner: 'local',
              winnerTime: scan.scannedAt,
              winnerDevice: scan.deviceId,
            },
          });
          results.push({ ticketId: scan.ticketId, result: 'conflict_won' });
          conflicts++;
        } else {
          // Normal sync - no conflict
          await db.offlineScans.update(scan.id!, { syncStatus: 'synced' });
          results.push({ ticketId: scan.ticketId, result: 'synced' });
          synced++;
        }
      } else if (result?.conflict_resolved) {
        // We lost the conflict - another scan was earlier
        await db.offlineScans.update(scan.id!, {
          syncStatus: 'conflict',
          conflictResolution: {
            winner: 'remote',
            winnerTime: result.winner_time,
            winnerDevice: result.winner_device || 'unknown',
          },
        });
        results.push({
          ticketId: scan.ticketId,
          result: 'conflict_lost',
          message: `Another device scanned first at ${new Date(result.winner_time).toLocaleTimeString()}`,
        });
        conflicts++;
      } else {
        // Failed for other reason
        await db.offlineScans.update(scan.id!, { syncStatus: 'failed' });
        results.push({
          ticketId: scan.ticketId,
          result: 'failed',
          message: 'Sync failed',
        });
        failed++;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(
        '[offline-ticket-cache] Conflict resolution failed for',
        scan.ticketId,
        error
      );
      await db.offlineScans.update(scan.id!, { syncStatus: 'failed' });
      results.push({
        ticketId: scan.ticketId,
        result: 'failed',
        message: errorMessage,
      });
      failed++;
    }
  }

  console.log('[offline-ticket-cache] Resolved:', { synced, conflicts, failed });
  return { synced, conflicts, failed, results };
}

/**
 * Get all pending offline scans (for UI display)
 */
export async function getPendingOfflineScans(): Promise<OfflineScanRecord[]> {
  return await db.offlineScans.where('syncStatus').equals('pending').toArray();
}

/**
 * Get all scans that had conflicts (for review)
 */
export async function getConflictedScans(): Promise<OfflineScanRecord[]> {
  return await db.offlineScans.where('syncStatus').equals('conflict').toArray();
}

// ============================================================================
// Cache Status Functions
// ============================================================================

/**
 * Get cache metadata for an event
 */
export async function getCacheStatus(
  eventId: string
): Promise<CacheMetadata | null> {
  return (await db.cacheMetadata.get(eventId)) || null;
}

/**
 * Get all cached events metadata
 */
export async function getAllCachedEvents(): Promise<CacheMetadata[]> {
  return await db.cacheMetadata.toArray();
}

/**
 * Get check-in count for an event
 */
export async function getCheckedInCount(eventId: string): Promise<{
  checkedIn: number;
  total: number;
}> {
  const metadata = await db.cacheMetadata.get(eventId);
  if (!metadata) {
    return { checkedIn: 0, total: 0 };
  }
  return {
    checkedIn: metadata.scannedCount,
    total: metadata.ticketCount,
  };
}

// ============================================================================
// Cache Cleanup Functions
// ============================================================================

/**
 * Clear cache for a specific event
 */
export async function clearEventCache(eventId: string): Promise<void> {
  await db.cachedTickets.where('eventId').equals(eventId).delete();
  await db.cacheMetadata.delete(eventId);
  console.log('[offline-ticket-cache] Cleared cache for event', eventId);
}

/**
 * Clear caches older than 24 hours (per context decision)
 * Also clears synced offline scans older than 24 hours
 */
export async function clearOldCaches(): Promise<number> {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  const cutoff = oneDayAgo.toISOString();

  const oldEvents = await db.cacheMetadata
    .filter((m) => m.lastSyncAt < cutoff)
    .toArray();

  for (const event of oldEvents) {
    await clearEventCache(event.eventId);
  }

  // Also clear old synced offline scans (keep conflicts for review)
  await db.offlineScans
    .where('syncStatus')
    .equals('synced')
    .filter((s) => s.scannedAt < cutoff)
    .delete();

  console.log(
    '[offline-ticket-cache] Cleared',
    oldEvents.length,
    'old event caches'
  );
  return oldEvents.length;
}

// ============================================================================
// Auto-Sync / Freshness
// ============================================================================

const CACHE_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Ensure cache is fresh, refreshing if stale or missing
 * Call this when selecting an event
 */
export async function ensureCacheIsFresh(eventId: string): Promise<{
  status: 'fresh' | 'refreshed' | 'failed';
  ticketCount: number;
}> {
  const metadata = await db.cacheMetadata.get(eventId);

  if (metadata) {
    const lastSync = new Date(metadata.lastSyncAt).getTime();
    const now = Date.now();

    if (now - lastSync < CACHE_REFRESH_INTERVAL_MS) {
      return { status: 'fresh', ticketCount: metadata.ticketCount };
    }
  }

  // Need to refresh - check if online
  if (!navigator.onLine) {
    if (metadata) {
      // Offline but have cache - use stale cache
      return { status: 'fresh', ticketCount: metadata.ticketCount };
    }
    // Offline and no cache
    return { status: 'failed', ticketCount: 0 };
  }

  // Online - refresh cache
  const result = await syncTicketCache(eventId);
  return {
    status: result.success ? 'refreshed' : 'failed',
    ticketCount: result.ticketCount,
  };
}

/**
 * Get a ticket from cache by its ID
 */
export async function getTicketFromCache(
  ticketId: string
): Promise<CachedTicket | undefined> {
  return await db.cachedTickets.get(ticketId);
}

/**
 * Find ticket by QR token in cache
 */
export async function findTicketByQrToken(
  qrToken: string
): Promise<CachedTicket | undefined> {
  return await db.cachedTickets.where('qrToken').equals(qrToken).first();
}
