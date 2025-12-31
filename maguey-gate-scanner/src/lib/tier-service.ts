/**
 * Ticket Tier Service
 * Handles fetching and managing ticket tier information
 */

import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export interface TicketTier {
  id: string;
  name: string;
  color: string;
  sound_profile: string;
  perks_description: string | null;
  priority_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Default tier configurations (fallback if database is not available)
const DEFAULT_TIERS: Record<string, TicketTier> = {
  general: {
    id: 'default-general',
    name: 'general',
    color: '#6b7280', // Gray
    sound_profile: 'general',
    perks_description: 'Standard entry ticket',
    priority_level: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  vip: {
    id: 'default-vip',
    name: 'vip',
    color: '#fbbf24', // Gold/Yellow
    sound_profile: 'vip',
    perks_description: 'VIP access with priority entry and free drink voucher',
    priority_level: 10,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  premium: {
    id: 'default-premium',
    name: 'premium',
    color: '#a855f7', // Purple
    sound_profile: 'premium',
    perks_description: 'Premium access with reserved seating',
    priority_level: 5,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  backstage: {
    id: 'default-backstage',
    name: 'backstage',
    color: '#ef4444', // Red
    sound_profile: 'backstage',
    perks_description: 'Backstage access with meet & greet',
    priority_level: 15,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

// Cache for tier data
let tierCache: Map<string, TicketTier> = new Map();
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get tier information by name
 */
export const getTierInfo = async (tierName: string | null | undefined): Promise<TicketTier | null> => {
  const normalizedTier = (tierName || 'general').toLowerCase();
  
  // Check cache first
  const now = Date.now();
  if (tierCache.has(normalizedTier) && now < cacheExpiry) {
    return tierCache.get(normalizedTier) || null;
  }

  // If Supabase is not configured, use defaults
  if (!isSupabaseConfigured()) {
    return DEFAULT_TIERS[normalizedTier] || DEFAULT_TIERS.general;
  }

  try {
    // Try to fetch from database using the function
    const { data, error } = await supabase
      .rpc('get_tier_info', { tier_name: normalizedTier });

    if (error) {
      console.warn('[tier-service] Error fetching tier info:', error);
      // Fallback to direct query
      const { data: directData, error: directError } = await supabase
        .from('ticket_tiers')
        .select('*')
        .eq('name', normalizedTier)
        .eq('is_active', true)
        .maybeSingle();

      if (directError) {
        console.warn('[tier-service] Direct query also failed:', directError);
        return DEFAULT_TIERS[normalizedTier] || DEFAULT_TIERS.general;
      }

      if (directData) {
        tierCache.set(normalizedTier, directData as TicketTier);
        cacheExpiry = now + CACHE_DURATION;
        return directData as TicketTier;
      }
    } else if (data && data.length > 0) {
      const tierInfo = data[0] as TicketTier;
      tierCache.set(normalizedTier, tierInfo);
      cacheExpiry = now + CACHE_DURATION;
      return tierInfo;
    }

    // Fallback to defaults
    return DEFAULT_TIERS[normalizedTier] || DEFAULT_TIERS.general;
  } catch (error) {
    console.error('[tier-service] Unexpected error:', error);
    return DEFAULT_TIERS[normalizedTier] || DEFAULT_TIERS.general;
  }
};

/**
 * Get all active tiers
 */
export const getAllTiers = async (): Promise<TicketTier[]> => {
  if (!isSupabaseConfigured()) {
    return Object.values(DEFAULT_TIERS);
  }

  try {
    const { data, error } = await supabase
      .from('ticket_tiers')
      .select('*')
      .eq('is_active', true)
      .order('priority_level', { ascending: false });

    if (error) {
      console.warn('[tier-service] Error fetching all tiers:', error);
      return Object.values(DEFAULT_TIERS);
    }

    return (data || []) as TicketTier[];
  } catch (error) {
    console.error('[tier-service] Unexpected error fetching all tiers:', error);
    return Object.values(DEFAULT_TIERS);
  }
};

/**
 * Get tier color
 */
export const getTierColor = (tierName: string | null | undefined): string => {
  const normalizedTier = (tierName || 'general').toLowerCase();
  return DEFAULT_TIERS[normalizedTier]?.color || DEFAULT_TIERS.general.color;
};

/**
 * Get tier display name (capitalized)
 */
export const getTierDisplayName = (tierName: string | null | undefined): string => {
  const normalizedTier = (tierName || 'general').toLowerCase();
  return normalizedTier.charAt(0).toUpperCase() + normalizedTier.slice(1).toUpperCase();
};

/**
 * Clear tier cache (useful after updates)
 */
export const clearTierCache = (): void => {
  tierCache.clear();
  cacheExpiry = 0;
};

