import Dexie, { Table } from 'dexie';
import { scanTicket, findTicket } from './simple-scanner';
import { supabase } from './supabase';

export interface QueuedScan {
  id?: number; // Auto-increment primary key
  ticketId: string;
  qrToken?: string;
  ticketIdString?: string; // For non-QR scans
  scannedBy?: string;
  scannedAt: string; // ISO timestamp
  deviceId: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  errorMessage?: string;
  lastRetryAt?: string; // ISO timestamp
  scanMetadata?: {
    eventId?: string;
    ticketType?: string;
    attendeeName?: string;
  };
}

class OfflineQueueDatabase extends Dexie {
  queuedScans!: Table<QueuedScan, number>;

  constructor() {
    super('OfflineQueueDatabase');
    this.version(1).stores({
      queuedScans: '++id, ticketId, syncStatus, scannedAt, retryCount',
    });
  }
}

const db = new OfflineQueueDatabase();

// Generate a unique device ID (persist in localStorage)
const getDeviceId = (): string => {
  const stored = localStorage.getItem('scanner_device_id');
  if (stored) return stored;
  
  const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('scanner_device_id', deviceId);
  return deviceId;
};

const deviceId = getDeviceId();

/**
 * Queue a scan for later sync when offline
 */
export const queueScan = async (
  ticketId: string,
  scannedBy?: string,
  options?: {
    qrToken?: string;
    ticketIdString?: string;
    scanMetadata?: QueuedScan['scanMetadata'];
  }
): Promise<number> => {
  const queuedScan: Omit<QueuedScan, 'id'> = {
    ticketId,
    qrToken: options?.qrToken,
    ticketIdString: options?.ticketIdString,
    scannedBy,
    scannedAt: new Date().toISOString(),
    deviceId,
    syncStatus: 'pending',
    retryCount: 0,
    scanMetadata: options?.scanMetadata,
  };

  const id = await db.queuedScans.add(queuedScan as QueuedScan);
  console.log('[offline-queue] Queued scan', { id, ticketId });
  return id;
};

/**
 * Get all pending scans
 */
export const getPendingScans = async (): Promise<QueuedScan[]> => {
  return await db.queuedScans
    .where('syncStatus')
    .anyOf(['pending', 'failed'])
    .toArray();
};

/**
 * Get sync status summary
 */
export const getSyncStatus = async (): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
}> => {
  const all = await db.queuedScans.toArray();
  return {
    pending: all.filter(s => s.syncStatus === 'pending').length,
    syncing: all.filter(s => s.syncStatus === 'syncing').length,
    synced: all.filter(s => s.syncStatus === 'synced').length,
    failed: all.filter(s => s.syncStatus === 'failed').length,
    total: all.length,
  };
};

/**
 * Calculate exponential backoff delay
 */
const getRetryDelay = (retryCount: number): number => {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 60s
  const delay = Math.min(1000 * Math.pow(2, retryCount), 60000);
  return delay;
};

/**
 * Check if we should retry based on exponential backoff
 */
const shouldRetry = (scan: QueuedScan): boolean => {
  if (scan.syncStatus !== 'failed') return false;
  if (scan.retryCount >= 10) return false; // Max 10 retries
  
  if (!scan.lastRetryAt) return true;
  
  const delay = getRetryDelay(scan.retryCount);
  const timeSinceLastRetry = Date.now() - new Date(scan.lastRetryAt).getTime();
  return timeSinceLastRetry >= delay;
};

/**
 * Sync a single queued scan
 */
const syncSingleScan = async (scan: QueuedScan): Promise<boolean> => {
  try {
    // Update status to syncing
    await db.queuedScans.update(scan.id!, { syncStatus: 'syncing' });

    // Use findTicket from simple-scanner to find the ticket
    const lookupInput = scan.qrToken || scan.ticketIdString || scan.ticketId;
    const ticket = await findTicket(lookupInput);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Update the queued scan with the actual ticket ID if it changed
    if (ticket.id !== scan.ticketId) {
      await db.queuedScans.update(scan.id!, { ticketId: ticket.id });
    }

    // Check if already scanned (conflict resolution)
    if (ticket.is_used) {
      // Ticket was already scanned - this is a conflict
      // We'll mark as synced since the ticket is already scanned
      // (the "already scanned" state is the desired end state)
      console.log('[offline-queue] Conflict: ticket already scanned', { ticketId: scan.ticketId });

      await db.queuedScans.update(scan.id!, {
        syncStatus: 'synced',
        errorMessage: 'Ticket was already scanned (conflict resolved)',
      });
      return true;
    }

    // Perform the scan using the resolved ticket ID
    const scanResult = await scanTicket(ticket.id, scan.scannedBy);

    if (!scanResult.success) {
      // If it's an "already scanned" error, treat as success (conflict resolved)
      if (scanResult.alreadyScanned) {
        await db.queuedScans.update(scan.id!, {
          syncStatus: 'synced',
          errorMessage: 'Ticket was already scanned (conflict resolved)',
        });
        return true;
      }
      throw new Error(scanResult.message || 'Scan failed');
    }

    // Success - mark as synced
    await db.queuedScans.update(scan.id!, {
      syncStatus: 'synced',
      errorMessage: undefined,
    });

    console.log('[offline-queue] Successfully synced scan', { id: scan.id, ticketId: scan.ticketId });
    return true;
  } catch (error: any) {
    console.error('[offline-queue] Sync failed', { id: scan.id, error: error.message });
    
    const newRetryCount = scan.retryCount + 1;
    const shouldRetryAgain = newRetryCount < 10;

    await db.queuedScans.update(scan.id!, {
      syncStatus: shouldRetryAgain ? 'failed' : 'failed',
      retryCount: newRetryCount,
      errorMessage: error.message || 'Unknown error',
      lastRetryAt: new Date().toISOString(),
    });

    return false;
  }
};

/**
 * Sync all pending scans
 */
export const syncPendingScans = async (options?: {
  syncType?: 'auto' | 'manual' | 'retry';
}): Promise<{
  success: number;
  failed: number;
  total: number;
}> => {
  const syncType = options?.syncType || 'auto';
  const startTime = Date.now();

  // Get all scans that should be synced
  const pendingScans = await db.queuedScans
    .where('syncStatus')
    .anyOf(['pending', 'failed'])
    .toArray();

  // Filter to only scans that should be retried (respect exponential backoff)
  const scansToSync = pendingScans.filter(scan => {
    if (scan.syncStatus === 'pending') return true;
    if (scan.syncStatus === 'failed') return shouldRetry(scan);
    return false;
  });

  if (scansToSync.length === 0) {
    return { success: 0, failed: 0, total: 0 };
  }

  console.log('[offline-queue] Syncing scans', { count: scansToSync.length, syncType });

  let success = 0;
  let failed = 0;

  // Sync in batches of 5 to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < scansToSync.length; i += batchSize) {
    const batch = scansToSync.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(scan => syncSingleScan(scan))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        success++;
      } else {
        failed++;
      }
    });

    // Small delay between batches
    if (i + batchSize < scansToSync.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const durationMs = Date.now() - startTime;

  // Log sync history (import dynamically to avoid circular dependency)
  try {
    const { logSyncHistory } = await import('./sync-status-service');
    const syncStatus: 'success' | 'partial' | 'failed' = 
      failed === 0 ? 'success' : success === 0 ? 'failed' : 'partial';
    
    await logSyncHistory(
      syncType,
      syncStatus,
      scansToSync.length,
      success,
      failed,
      durationMs,
      failed > 0 ? `${failed} scans failed` : undefined
    );
  } catch (error) {
    // Silently fail if sync-status-service is not available
    console.debug('[offline-queue] Could not log sync history:', error);
  }

  return { success, failed, total: scansToSync.length };
};

/**
 * Clear old synced scans (older than 7 days)
 */
export const clearOldSyncedScans = async (): Promise<number> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const deleted = await db.queuedScans
    .where('syncStatus')
    .equals('synced')
    .and(scan => new Date(scan.scannedAt) < sevenDaysAgo)
    .delete();

  console.log('[offline-queue] Cleared old synced scans', { count: deleted });
  return deleted;
};

/**
 * Delete a specific queued scan (for manual cleanup)
 */
export const deleteQueuedScan = async (id: number): Promise<void> => {
  await db.queuedScans.delete(id);
};

/**
 * Get all scans (for debugging/admin)
 */
export const getAllScans = async (): Promise<QueuedScan[]> => {
  return await db.queuedScans.toArray();
};

/**
 * Listen for online/offline events and auto-sync
 */
let autoSyncInterval: number | null = null;
let isAutoSyncing = false;

export const startAutoSync = (intervalMs: number = 5000): void => {
  if (autoSyncInterval !== null) {
    return; // Already started
  }

  const syncWhenOnline = async () => {
    if (!navigator.onLine) return;
    if (isAutoSyncing) return;

    isAutoSyncing = true;
    try {
      await syncPendingScans({ syncType: 'auto' });
      
      // Check for sync failures and notify
      try {
        const { getCurrentSyncStatus, notifySyncFailure } = await import('./sync-status-service');
        const status = await getCurrentSyncStatus();
        if (status.failed > 0 && status.lastSyncError) {
          await notifySyncFailure(status.failed, status.lastSyncError);
        }
      } catch (error) {
        // Silently fail notification
        console.debug('[offline-queue] Could not send sync failure notification:', error);
      }
    } catch (error) {
      console.error('[offline-queue] Auto-sync error', error);
    } finally {
      isAutoSyncing = false;
    }
  };

  // Sync immediately if online
  syncWhenOnline();

  // Listen for online event
  window.addEventListener('online', syncWhenOnline);

  // Periodic sync check
  autoSyncInterval = window.setInterval(syncWhenOnline, intervalMs);
};

export const stopAutoSync = (): void => {
  if (autoSyncInterval !== null) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
  window.removeEventListener('online', () => {});
};

