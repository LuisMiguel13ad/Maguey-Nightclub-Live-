import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { getSyncStatus, syncPendingScans, getPendingScans, type QueuedScan } from './offline-queue-service';

export interface SyncStatus {
  status: 'synced' | 'syncing' | 'pending' | 'failed';
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  retryCount: number;
  syncHealthScore: number;
  isOnline: boolean;
  nextAutoSyncIn?: number; // seconds until next auto-sync
}

export interface SyncHistoryEntry {
  id: string;
  deviceId: string;
  userId: string | null;
  syncType: 'auto' | 'manual' | 'retry';
  status: 'success' | 'partial' | 'failed';
  scansProcessed: number;
  scansSucceeded: number;
  scansFailed: number;
  durationMs: number | null;
  errorMessage: string | null;
  syncSpeedScansPerSec: number | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface SyncStatusUpdate {
  status: SyncStatus;
  failedScans: QueuedScan[];
}

type SyncStatusCallback = (update: SyncStatusUpdate) => void;

// Get device ID from localStorage
const getDeviceId = (): string => {
  const stored = localStorage.getItem('scanner_device_id');
  if (stored) return stored;
  
  const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('scanner_device_id', deviceId);
  return deviceId;
};

const deviceId = getDeviceId();

// Cache for current sync status
let cachedStatus: SyncStatus | null = null;
let statusCallbacks: Set<SyncStatusCallback> = new Set();
let realtimeSubscription: any = null;
let pollingInterval: number | null = null;
let nextAutoSyncTime: number | null = null;

/**
 * Convert queue status to sync status
 */
const queueStatusToSyncStatus = async (): Promise<SyncStatus> => {
  const queueStatus = await getSyncStatus();
  const isOnline = navigator.onLine;
  
  // Determine overall status
  let status: SyncStatus['status'] = 'synced';
  if (queueStatus.syncing > 0) {
    status = 'syncing';
  } else if (queueStatus.failed > 0) {
    status = 'failed';
  } else if (queueStatus.pending > 0) {
    status = 'pending';
  }

  // Calculate sync health score
  const syncHealthScore = queueStatus.total > 0
    ? Math.round((queueStatus.synced / queueStatus.total) * 10000) / 100
    : 100;

  // Get last synced time from failed scans (most recent retry)
  const pendingScans = await getPendingScans();
  const failedScans = pendingScans.filter(s => s.syncStatus === 'failed');
  const lastRetryAt = failedScans.length > 0
    ? failedScans
        .map(s => s.lastRetryAt ? new Date(s.lastRetryAt).getTime() : 0)
        .reduce((a, b) => Math.max(a, b), 0)
    : null;

  const lastSyncError = failedScans.length > 0
    ? failedScans[0].errorMessage || null
    : null;

  const maxRetryCount = failedScans.length > 0
    ? Math.max(...failedScans.map(s => s.retryCount))
    : 0;

  // Calculate next auto-sync time (5 seconds from now if pending)
  const nextAutoSyncIn = (queueStatus.pending > 0 || queueStatus.failed > 0) && isOnline
    ? 5
    : undefined;

  return {
    status,
    pending: queueStatus.pending,
    syncing: queueStatus.syncing,
    synced: queueStatus.synced,
    failed: queueStatus.failed,
    total: queueStatus.total,
    lastSyncedAt: lastRetryAt ? new Date(lastRetryAt) : null,
    lastSyncError,
    retryCount: maxRetryCount,
    syncHealthScore,
    isOnline,
    nextAutoSyncIn,
  };
};

/**
 * Update sync status in database
 */
const updateDatabaseSyncStatus = async (status: SyncStatus): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    const { error } = await supabase
      .from('sync_status')
      .upsert({
        device_id: deviceId,
        user_id: userId,
        status: status.status,
        pending_count: status.pending,
        syncing_count: status.syncing,
        synced_count: status.synced,
        failed_count: status.failed,
        total_count: status.total,
        last_synced_at: status.lastSyncedAt?.toISOString() || null,
        last_sync_error: status.lastSyncError,
        retry_count: status.retryCount,
        sync_health_score: status.syncHealthScore,
        is_online: status.isOnline,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'device_id',
      });

    if (error) {
      console.error('[sync-status] Failed to update database sync status:', error);
    }
  } catch (error) {
    console.error('[sync-status] Error updating database sync status:', error);
  }
};

/**
 * Log sync operation to history
 */
export const logSyncHistory = async (
  syncType: 'auto' | 'manual' | 'retry',
  status: 'success' | 'partial' | 'failed',
  scansProcessed: number,
  scansSucceeded: number,
  scansFailed: number,
  durationMs: number,
  errorMessage?: string | null
): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    const syncSpeed = durationMs > 0
      ? Math.round((scansProcessed / (durationMs / 1000)) * 100) / 100
      : null;

    const { error } = await supabase
      .from('sync_history')
      .insert({
        device_id: deviceId,
        user_id: userId,
        sync_type: syncType,
        status,
        scans_processed: scansProcessed,
        scans_succeeded: scansSucceeded,
        scans_failed: scansFailed,
        duration_ms: durationMs,
        error_message: errorMessage || null,
        sync_speed_scans_per_sec: syncSpeed,
        started_at: new Date(Date.now() - durationMs).toISOString(),
        completed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[sync-status] Failed to log sync history:', error);
    }
  } catch (error) {
    console.error('[sync-status] Error logging sync history:', error);
  }
};

/**
 * Get current sync status
 */
export const getCurrentSyncStatus = async (): Promise<SyncStatus> => {
  const status = await queueStatusToSyncStatus();
  cachedStatus = status;
  await updateDatabaseSyncStatus(status);
  return status;
};

/**
 * Get sync history (last N entries)
 */
export const getSyncHistory = async (limit: number = 20): Promise<SyncHistoryEntry[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('sync_history')
      .select('*')
      .eq('device_id', deviceId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(entry => ({
      id: entry.id,
      deviceId: entry.device_id,
      userId: entry.user_id,
      syncType: entry.sync_type,
      status: entry.status,
      scansProcessed: entry.scans_processed,
      scansSucceeded: entry.scans_succeeded,
      scansFailed: entry.scans_failed,
      durationMs: entry.duration_ms,
      errorMessage: entry.error_message,
      syncSpeedScansPerSec: entry.sync_speed_scans_per_sec,
      startedAt: new Date(entry.started_at),
      completedAt: entry.completed_at ? new Date(entry.completed_at) : null,
    }));
  } catch (error) {
    console.error('[sync-status] Error fetching sync history:', error);
    return [];
  }
};

/**
 * Get failed scans for retry
 */
export const getFailedScans = async (): Promise<QueuedScan[]> => {
  const pendingScans = await getPendingScans();
  return pendingScans.filter(s => s.syncStatus === 'failed');
};

/**
 * Subscribe to sync status updates
 */
export const subscribeToSyncStatus = (callback: SyncStatusCallback): (() => void) => {
  statusCallbacks.add(callback);

  // Immediately call with current status
  getCurrentSyncStatus().then(status => {
    getFailedScans().then(failedScans => {
      callback({ status, failedScans });
    });
  });

  // Return unsubscribe function
  return () => {
    statusCallbacks.delete(callback);
  };
};

/**
 * Notify all subscribers of status update
 */
const notifySubscribers = async () => {
  const status = await getCurrentSyncStatus();
  const failedScans = await getFailedScans();
  
  statusCallbacks.forEach(callback => {
    try {
      callback({ status, failedScans });
    } catch (error) {
      console.error('[sync-status] Error in status callback:', error);
    }
  });
};

/**
 * Start real-time sync status monitoring
 */
export const startSyncStatusMonitoring = (): void => {
  if (pollingInterval !== null) {
    return; // Already started
  }

  // Initial update
  notifySubscribers();

  // Set up Supabase Realtime subscription if configured
  if (isSupabaseConfigured()) {
    try {
      realtimeSubscription = supabase
        .channel(`sync_status:${deviceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sync_status',
            filter: `device_id=eq.${deviceId}`,
          },
          () => {
            // Database was updated, refresh local status
            notifySubscribers();
          }
        )
        .subscribe();

      console.log('[sync-status] Realtime subscription started');
    } catch (error) {
      console.error('[sync-status] Failed to start realtime subscription:', error);
    }
  }

  // Poll every 2-3 seconds for updates
  pollingInterval = window.setInterval(() => {
    notifySubscribers();
  }, 2500);

  // Listen for online/offline events
  const handleOnline = () => {
    notifySubscribers();
  };
  const handleOffline = () => {
    notifySubscribers();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  console.log('[sync-status] Monitoring started');
};

/**
 * Stop real-time sync status monitoring
 */
export const stopSyncStatusMonitoring = (): void => {
  if (pollingInterval !== null) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
    realtimeSubscription = null;
  }

  statusCallbacks.clear();
  console.log('[sync-status] Monitoring stopped');
};

/**
 * Manual sync with progress tracking
 */
export const performManualSync = async (): Promise<{
  success: number;
  failed: number;
  total: number;
}> => {
  const startTime = Date.now();
  
  try {
    const result = await syncPendingScans({ syncType: 'manual' });
    const durationMs = Date.now() - startTime;

    // Determine sync status
    let syncStatus: 'success' | 'partial' | 'failed' = 'success';
    if (result.failed > 0 && result.success === 0) {
      syncStatus = 'failed';
    } else if (result.failed > 0) {
      syncStatus = 'partial';
    }

    // Log to history (already logged by syncPendingScans, but we can add additional logging if needed)
    // The syncPendingScans function now handles logging internally

    // Update status
    await notifySubscribers();

    // Notify on failure
    if (result.failed > 0) {
      const status = await getCurrentSyncStatus();
      await notifySyncFailure(result.failed, status.lastSyncError || undefined);
    }

    return result;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    await logSyncHistory(
      'manual',
      'failed',
      0,
      0,
      0,
      durationMs,
      error.message || 'Unknown error'
    );
    await notifySubscribers();
    await notifySyncFailure(0, error.message || 'Unknown error');
    throw error;
  }
};

/**
 * Request push notification permission
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * Show push notification for sync failure
 */
export const notifySyncFailure = async (failedCount: number, errorMessage?: string): Promise<void> => {
  const hasPermission = await requestNotificationPermission();
  
  if (!hasPermission) {
    return;
  }

  const title = `Sync Failed: ${failedCount} scan${failedCount !== 1 ? 's' : ''} pending`;
  const body = errorMessage || 'Please check your connection and try syncing again.';

  try {
    const notification = new Notification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'sync-failure',
      requireInteraction: false,
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
  } catch (error) {
    console.error('[sync-status] Failed to show notification:', error);
  }
};

