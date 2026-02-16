/**
 * VIP Offline Queue Service
 * Handles offline queuing and syncing for VIP guest pass scanning
 * Mirrors the structure of offline-queue-service.ts for regular tickets
 */

import Dexie, { Table } from 'dexie';
import { checkInGuestPass, getGuestPassByQrToken, verifyPassSignature } from './vip-tables-admin-service';

export interface QueuedVipScan {
  id?: number; // Auto-increment primary key
  qrToken: string;
  qrSignature: string | null;
  meta: {
    reservationId?: string;
    guestNumber?: number;
  } | null;
  scannedBy?: string;
  scannedAt: string; // ISO timestamp
  deviceId: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  errorMessage?: string;
  lastRetryAt?: string; // ISO timestamp
  passId?: string; // Resolved after first sync attempt
}

class VipOfflineQueueDatabase extends Dexie {
  queuedVipScans!: Table<QueuedVipScan, number>;

  constructor() {
    super('VipOfflineQueueDatabase');
    this.version(1).stores({
      queuedVipScans: '++id, qrToken, syncStatus, scannedAt, retryCount',
    });
  }
}

const db = new VipOfflineQueueDatabase();

// Generate a unique device ID (persist in localStorage)
const getDeviceId = (): string => {
  const stored = localStorage.getItem('vip_scanner_device_id');
  if (stored) return stored;

  const deviceId = `vip_device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('vip_scanner_device_id', deviceId);
  return deviceId;
};

const deviceId = getDeviceId();

/**
 * Queue a VIP scan for later sync when offline
 */
export const queueVipScan = async (
  qrToken: string,
  qrSignature: string | null,
  meta: QueuedVipScan['meta'],
  scannedBy?: string
): Promise<number> => {
  const queuedScan: Omit<QueuedVipScan, 'id'> = {
    qrToken,
    qrSignature,
    meta,
    scannedBy,
    scannedAt: new Date().toISOString(),
    deviceId,
    syncStatus: 'pending',
    retryCount: 0,
  };

  const id = await db.queuedVipScans.add(queuedScan as QueuedVipScan);
  console.log('[vip-offline-queue] Queued VIP scan', { id, qrToken });
  return id;
};

/**
 * Get all pending VIP scans
 */
export const getPendingVipScans = async (): Promise<QueuedVipScan[]> => {
  return await db.queuedVipScans
    .where('syncStatus')
    .anyOf(['pending', 'failed'])
    .toArray();
};

/**
 * Get VIP sync status summary
 */
export const getVipSyncStatus = async (): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
}> => {
  const all = await db.queuedVipScans.toArray();
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
const shouldRetry = (scan: QueuedVipScan): boolean => {
  if (scan.syncStatus !== 'failed') return false;
  if (scan.retryCount >= 10) return false; // Max 10 retries

  if (!scan.lastRetryAt) return true;

  const delay = getRetryDelay(scan.retryCount);
  const timeSinceLastRetry = Date.now() - new Date(scan.lastRetryAt).getTime();
  return timeSinceLastRetry >= delay;
};

/**
 * Sync a single queued VIP scan
 */
const syncSingleVipScan = async (scan: QueuedVipScan): Promise<boolean> => {
  try {
    // Update status to syncing
    await db.queuedVipScans.update(scan.id!, { syncStatus: 'syncing' });

    // If we have a signature, verify it first
    if (scan.qrSignature) {
      const verificationResult = await verifyPassSignature(
        scan.qrToken,
        scan.qrSignature,
        scan.meta?.reservationId,
        scan.meta?.guestNumber
      );

      // If already checked in, mark as synced (conflict resolved)
      if (!verificationResult.valid && verificationResult.error === 'ALREADY_CHECKED_IN') {
        console.log('[vip-offline-queue] Conflict: pass already checked in', { qrToken: scan.qrToken });
        await db.queuedVipScans.update(scan.id!, {
          syncStatus: 'synced',
          errorMessage: 'Pass was already checked in (conflict resolved)',
        });
        return true;
      }

      // For invalid signatures, still try to process - signature might be from different generation method
      if (!verificationResult.valid && verificationResult.error === 'INVALID_SIGNATURE') {
        console.warn('[vip-offline-queue] Signature verification failed, proceeding with lookup');
      }
    }

    // Get guest pass by QR token
    const result = await getGuestPassByQrToken(scan.qrToken);

    if (!result) {
      throw new Error('VIP guest pass not found');
    }

    const { pass, reservation } = result;

    // Store the pass ID for future reference
    await db.queuedVipScans.update(scan.id!, { passId: pass.id });

    // Check if already checked in (conflict resolution)
    if (pass.status === 'checked_in') {
      console.log('[vip-offline-queue] Conflict: pass already checked in', { qrToken: scan.qrToken });
      await db.queuedVipScans.update(scan.id!, {
        syncStatus: 'synced',
        errorMessage: 'Pass was already checked in (conflict resolved)',
      });
      return true;
    }

    // Check if reservation is valid
    const validStatuses = ['confirmed', 'checked_in', 'completed'];
    if (!validStatuses.includes(reservation.status)) {
      throw new Error(`Reservation status is ${reservation.status}, not valid for check-in`);
    }

    // Check in the guest pass
    await checkInGuestPass(pass.id, scan.scannedBy || 'offline-sync');

    // Success - mark as synced
    await db.queuedVipScans.update(scan.id!, {
      syncStatus: 'synced',
      errorMessage: undefined,
    });

    console.log('[vip-offline-queue] Successfully synced VIP scan', { id: scan.id, qrToken: scan.qrToken });
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[vip-offline-queue] Sync failed', { id: scan.id, error: errorMessage });

    const newRetryCount = scan.retryCount + 1;

    await db.queuedVipScans.update(scan.id!, {
      syncStatus: 'failed',
      retryCount: newRetryCount,
      errorMessage,
      lastRetryAt: new Date().toISOString(),
    });

    return false;
  }
};

/**
 * Sync all pending VIP scans
 */
export const syncPendingVipScans = async (options?: {
  syncType?: 'auto' | 'manual' | 'retry';
}): Promise<{
  success: number;
  failed: number;
  total: number;
}> => {
  const syncType = options?.syncType || 'auto';

  // Get all scans that should be synced
  const pendingScans = await db.queuedVipScans
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

  console.log('[vip-offline-queue] Syncing VIP scans', { count: scansToSync.length, syncType });

  let success = 0;
  let failed = 0;

  // Sync in batches of 3 (smaller batches for VIP to avoid overwhelming)
  const batchSize = 3;
  for (let i = 0; i < scansToSync.length; i += batchSize) {
    const batch = scansToSync.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(scan => syncSingleVipScan(scan))
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        success++;
      } else {
        failed++;
      }
    });

    // Small delay between batches
    if (i + batchSize < scansToSync.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return { success, failed, total: scansToSync.length };
};

/**
 * Clear old synced VIP scans (older than 7 days)
 */
export const clearOldSyncedVipScans = async (): Promise<number> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const deleted = await db.queuedVipScans
    .where('syncStatus')
    .equals('synced')
    .and(scan => new Date(scan.scannedAt) < sevenDaysAgo)
    .delete();

  console.log('[vip-offline-queue] Cleared old synced VIP scans', { count: deleted });
  return deleted;
};

/**
 * Delete a specific queued VIP scan (for manual cleanup)
 */
export const deleteQueuedVipScan = async (id: number): Promise<void> => {
  await db.queuedVipScans.delete(id);
};

/**
 * Get all VIP scans (for debugging/admin)
 */
export const getAllVipScans = async (): Promise<QueuedVipScan[]> => {
  return await db.queuedVipScans.toArray();
};

/**
 * Listen for online/offline events and auto-sync VIP scans
 */
let vipAutoSyncInterval: number | null = null;
let isVipAutoSyncing = false;

export const startVipAutoSync = (intervalMs: number = 5000): void => {
  if (vipAutoSyncInterval !== null) {
    return; // Already started
  }

  const syncWhenOnline = async () => {
    if (!navigator.onLine) return;
    if (isVipAutoSyncing) return;

    isVipAutoSyncing = true;
    try {
      await syncPendingVipScans({ syncType: 'auto' });
    } catch (error) {
      console.error('[vip-offline-queue] Auto-sync error', error);
    } finally {
      isVipAutoSyncing = false;
    }
  };

  // Sync immediately if online
  syncWhenOnline();

  // Listen for online event
  window.addEventListener('online', syncWhenOnline);

  // Periodic sync check
  vipAutoSyncInterval = window.setInterval(syncWhenOnline, intervalMs);
};

export const stopVipAutoSync = (): void => {
  if (vipAutoSyncInterval !== null) {
    clearInterval(vipAutoSyncInterval);
    vipAutoSyncInterval = null;
  }
};

/**
 * Get the count of pending VIP scans (for UI badge)
 */
export const getPendingVipScanCount = async (): Promise<number> => {
  return await db.queuedVipScans
    .where('syncStatus')
    .anyOf(['pending', 'failed'])
    .count();
};
