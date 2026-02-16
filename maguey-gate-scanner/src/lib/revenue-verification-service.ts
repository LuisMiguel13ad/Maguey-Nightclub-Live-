/**
 * Revenue Verification Service
 *
 * Client-side service to interact with the verify-revenue Edge Function
 * and manage revenue discrepancy data.
 */

import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

// ========================================
// Types
// ========================================

export interface RevenueVerificationResult {
  dbRevenue: number;
  stripeRevenue: number;
  hasDiscrepancy: boolean;
  discrepancyAmount: number;
  discrepancyPercent: number;
  checkedAt: string;
  breakdown?: {
    ticketRevenue: number;
    vipRevenue: number;
    stripeTransactionCount: number;
  };
}

export interface RevenueDiscrepancy {
  id: string;
  event_id: string | null;
  db_revenue: number;
  stripe_revenue: number;
  discrepancy_amount: number;
  discrepancy_percent: number;
  checked_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  period_start: string | null;
  period_end: string | null;
  metadata: Record<string, unknown> | null;
}

export interface VerifyRevenueOptions {
  eventId?: string;
  startDate: Date;
  endDate: Date;
}

// ========================================
// In-memory cache with TTL
// ========================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<RevenueVerificationResult>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (per RESEARCH.md Stripe rate limit pitfall)

function getCacheKey(options: VerifyRevenueOptions): string {
  return `${options.eventId || 'all'}_${options.startDate.toISOString()}_${options.endDate.toISOString()}`;
}

function getFromCache(key: string): RevenueVerificationResult | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: RevenueVerificationResult): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ========================================
// Exported Functions
// ========================================

/**
 * Verify revenue by calling the verify-revenue Edge Function.
 * Results are cached for 5 minutes to prevent Stripe rate limit issues.
 *
 * @param options - eventId (optional), startDate, endDate
 * @returns RevenueVerificationResult or null on failure
 */
export async function verifyRevenue(
  options: VerifyRevenueOptions
): Promise<RevenueVerificationResult | null> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, skipping revenue verification');
    return null;
  }

  // Check cache first
  const cacheKey = getCacheKey(options);
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log('Revenue verification: returning cached result');
    return cached;
  }

  try {
    const { data, error } = await supabase.functions.invoke('verify-revenue', {
      body: {
        eventId: options.eventId,
        startDate: options.startDate.toISOString(),
        endDate: options.endDate.toISOString(),
      },
    });

    if (error) {
      console.error('verify-revenue error:', error);
      return null;
    }

    if (!data) {
      console.warn('verify-revenue returned no data');
      return null;
    }

    const result = data as RevenueVerificationResult;

    // Cache the result
    setCache(cacheKey, result);

    return result;
  } catch (err) {
    console.error('Failed to verify revenue:', err);
    return null;
  }
}

/**
 * Get recent revenue discrepancies from the audit table.
 *
 * @param limit - Maximum number of records (default 10)
 * @returns Array of discrepancies, empty array on error
 */
export async function getRecentDiscrepancies(
  limit: number = 10
): Promise<RevenueDiscrepancy[]> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, skipping discrepancy fetch');
    return [];
  }

  try {
    // Type assertion needed since revenue_discrepancies table
    // may not be in the generated types yet
    const { data, error } = await (supabase as any)
      .from('revenue_discrepancies')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching discrepancies:', error);
      return [];
    }

    return (data || []) as RevenueDiscrepancy[];
  } catch (err) {
    console.error('Failed to fetch discrepancies:', err);
    return [];
  }
}

/**
 * Get count of unresolved discrepancies.
 *
 * @returns Number of unresolved discrepancies
 */
export async function getUnresolvedDiscrepancyCount(): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  try {
    const { count, error } = await (supabase as any)
      .from('revenue_discrepancies')
      .select('*', { count: 'exact', head: true })
      .is('resolved_at', null);

    if (error) {
      console.error('Error counting unresolved discrepancies:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Failed to count discrepancies:', err);
    return 0;
  }
}

/**
 * Mark a discrepancy as resolved with notes.
 *
 * @param id - Discrepancy ID
 * @param notes - Resolution notes
 * @returns true on success, false on failure
 */
export async function markDiscrepancyResolved(
  id: string,
  notes: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, cannot mark resolved');
    return false;
  }

  try {
    const { error } = await (supabase as any)
      .from('revenue_discrepancies')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_notes: notes,
      })
      .eq('id', id);

    if (error) {
      console.error('Error marking discrepancy resolved:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to mark discrepancy resolved:', err);
    return false;
  }
}

/**
 * Clear the verification cache (useful for forcing a fresh check)
 */
export function clearVerificationCache(): void {
  cache.clear();
}
