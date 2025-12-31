/**
 * Emergency Override Service
 * Handles emergency override mode for bypassing validation checks
 */

import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export type OverrideType = 'capacity' | 'refund' | 'transfer' | 'id_verification' | 'duplicate';

export interface OverrideState {
  isActive: boolean;
  activatedAt: number | null;
  expiresAt: number | null;
  activatedBy: string | null;
  pinHash: string | null;
}

export interface OverrideLog {
  id: string;
  ticket_id: string | null;
  user_id: string | null;
  override_type: OverrideType;
  reason: string;
  notes: string | null;
  scan_log_id: string | null;
  created_at: string;
}

// Storage keys
const STORAGE_KEY_OVERRIDE_STATE = 'emergency_override_state';
const STORAGE_KEY_OVERRIDE_PIN = 'emergency_override_pin_hash';
const DEFAULT_OVERRIDE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Simple PIN hashing (for local storage - in production, use proper hashing)
 */
const hashPIN = (pin: string): string => {
  // Simple hash for demo - in production, use proper crypto
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
};

/**
 * Get override state from localStorage
 */
export const getOverrideState = (): OverrideState => {
  if (typeof window === 'undefined') {
    return {
      isActive: false,
      activatedAt: null,
      expiresAt: null,
      activatedBy: null,
      pinHash: null,
    };
  }

  const stored = localStorage.getItem(STORAGE_KEY_OVERRIDE_STATE);
  if (!stored) {
    return {
      isActive: false,
      activatedAt: null,
      expiresAt: null,
      activatedBy: null,
      pinHash: null,
    };
  }

  try {
    const state = JSON.parse(stored);
    // Check if override has expired
    if (state.expiresAt && Date.now() > state.expiresAt) {
      // Override expired, clear it
      localStorage.removeItem(STORAGE_KEY_OVERRIDE_STATE);
      return {
        isActive: false,
        activatedAt: null,
        expiresAt: null,
        activatedBy: null,
        pinHash: null,
      };
    }
    return state;
  } catch {
    return {
      isActive: false,
      activatedAt: null,
      expiresAt: null,
      activatedBy: null,
      pinHash: null,
    };
  }
};

/**
 * Check if override mode is currently active
 */
export const isOverrideActive = (): boolean => {
  const state = getOverrideState();
  if (!state.isActive) return false;
  
  // Check expiration
  if (state.expiresAt && Date.now() > state.expiresAt) {
    deactivateOverride();
    return false;
  }
  
  return true;
};

/**
 * Get remaining override time in milliseconds
 */
export const getRemainingOverrideTime = (): number => {
  const state = getOverrideState();
  if (!state.isActive || !state.expiresAt) return 0;
  
  const remaining = state.expiresAt - Date.now();
  return Math.max(0, remaining);
};

/**
 * Set override PIN (first time setup)
 */
export const setOverridePIN = (pin: string): void => {
  if (typeof window === 'undefined') return;
  const pinHash = hashPIN(pin);
  localStorage.setItem(STORAGE_KEY_OVERRIDE_PIN, pinHash);
};

/**
 * Verify override PIN
 */
export const verifyOverridePIN = (pin: string): boolean => {
  if (typeof window === 'undefined') return false;
  const storedHash = localStorage.getItem(STORAGE_KEY_OVERRIDE_PIN);
  if (!storedHash) {
    // No PIN set, allow activation (first time)
    return true;
  }
  const pinHash = hashPIN(pin);
  return pinHash === storedHash;
};

/**
 * Activate override mode
 */
export const activateOverride = (pin: string, userId: string | null, durationMs: number = DEFAULT_OVERRIDE_DURATION_MS): boolean => {
  if (!verifyOverridePIN(pin)) {
    return false;
  }

  const now = Date.now();
  const expiresAt = now + durationMs;

  const state: OverrideState = {
    isActive: true,
    activatedAt: now,
    expiresAt,
    activatedBy: userId,
    pinHash: hashPIN(pin),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_OVERRIDE_STATE, JSON.stringify(state));
    
    // Set up expiration check
    const remainingMs = durationMs;
    setTimeout(() => {
      const currentState = getOverrideState();
      if (currentState.isActive && currentState.expiresAt === expiresAt) {
        deactivateOverride();
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('override-expired'));
      }
    }, remainingMs);
  }

  return true;
};

/**
 * Deactivate override mode
 */
export const deactivateOverride = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_OVERRIDE_STATE);
  window.dispatchEvent(new CustomEvent('override-deactivated'));
};

/**
 * Log override action to database
 */
export const logOverrideAction = async (
  ticketId: string | null,
  userId: string | null,
  overrideType: OverrideType,
  reason: string,
  notes: string | null,
  scanLogId: string | null = null
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // Queue for sync if offline
    const pendingOverrides = JSON.parse(localStorage.getItem('pending_override_logs') || '[]');
    pendingOverrides.push({
      ticket_id: ticketId,
      user_id: userId,
      override_type: overrideType,
      reason,
      notes,
      scan_log_id: scanLogId,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem('pending_override_logs', JSON.stringify(pendingOverrides));
    return;
  }

  try {
    const { error } = await supabase
      .from('emergency_override_logs')
      .insert({
        ticket_id: ticketId,
        user_id: userId,
        override_type: overrideType,
        reason,
        notes,
        scan_log_id: scanLogId,
      });

    if (error) {
      console.error('Error logging override action:', error);
      // Still queue for retry
      const pendingOverrides = JSON.parse(localStorage.getItem('pending_override_logs') || '[]');
      pendingOverrides.push({
        ticket_id: ticketId,
        user_id: userId,
        override_type: overrideType,
        reason,
        notes,
        scan_log_id: scanLogId,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem('pending_override_logs', JSON.stringify(pendingOverrides));
    }
  } catch (error) {
    console.error('Unexpected error logging override:', error);
  }
};

/**
 * Sync pending override logs
 */
export const syncPendingOverrideLogs = async (): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;

  const pendingOverrides = JSON.parse(localStorage.getItem('pending_override_logs') || '[]');
  if (pendingOverrides.length === 0) return 0;

  try {
    const { error } = await supabase
      .from('emergency_override_logs')
      .insert(pendingOverrides);

    if (error) {
      console.error('Error syncing pending override logs:', error);
      return 0;
    }

    // Clear pending logs on success
    localStorage.removeItem('pending_override_logs');
    return pendingOverrides.length;
  } catch (error) {
    console.error('Unexpected error syncing override logs:', error);
    return 0;
  }
};

/**
 * Get override statistics
 */
export const getOverrideStats = async (
  startDate?: Date,
  endDate?: Date
): Promise<{
  total_overrides: number;
  capacity_overrides: number;
  refund_overrides: number;
  transfer_overrides: number;
  id_verification_overrides: number;
  duplicate_overrides: number;
  unique_users: number;
}> => {
  if (!isSupabaseConfigured()) {
    return {
      total_overrides: 0,
      capacity_overrides: 0,
      refund_overrides: 0,
      transfer_overrides: 0,
      id_verification_overrides: 0,
      duplicate_overrides: 0,
      unique_users: 0,
    };
  }

  try {
    const start = startDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate?.toISOString() || new Date().toISOString();

    const { data, error } = await supabase
      .rpc('get_override_stats', {
        start_date: start,
        end_date: end,
      });

    if (error) throw error;

    return data?.[0] || {
      total_overrides: 0,
      capacity_overrides: 0,
      refund_overrides: 0,
      transfer_overrides: 0,
      id_verification_overrides: 0,
      duplicate_overrides: 0,
      unique_users: 0,
    };
  } catch (error) {
    console.error('Error fetching override stats:', error);
    return {
      total_overrides: 0,
      capacity_overrides: 0,
      refund_overrides: 0,
      transfer_overrides: 0,
      id_verification_overrides: 0,
      duplicate_overrides: 0,
      unique_users: 0,
    };
  }
};

/**
 * Get recent override logs
 */
export const getRecentOverrideLogs = async (limit: number = 50): Promise<OverrideLog[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('emergency_override_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []) as OverrideLog[];
  } catch (error) {
    console.error('Error fetching override logs:', error);
    return [];
  }
};

