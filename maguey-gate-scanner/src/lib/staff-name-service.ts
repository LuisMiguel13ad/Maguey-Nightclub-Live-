/**
 * Staff Name Resolution Service
 *
 * Resolves user UUIDs to human-readable display names using the profiles table,
 * with fallback to a truncated UUID. Caches results to avoid repeated queries.
 */
import { supabase } from '@/integrations/supabase/client';

// In-memory cache: UUID -> display name
const nameCache = new Map<string, string>();

/**
 * Resolve a batch of staff UUIDs to display names.
 * Queries the profiles table for first_name + last_name.
 * Falls back to truncated UUID if no profile found.
 * Results are cached for subsequent lookups.
 *
 * @param userIds - Array of user UUIDs to resolve
 * @returns Map of UUID -> display name
 */
export async function resolveStaffNames(userIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uncachedIds: string[] = [];

  // Check cache first
  for (const id of userIds) {
    if (!id || id === 'unknown') {
      result.set(id || 'unknown', 'Unknown Staff');
      continue;
    }
    const cached = nameCache.get(id);
    if (cached) {
      result.set(id, cached);
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length === 0) return result;

  // Query profiles table for uncached IDs
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', uncachedIds);

    if (!error && profiles) {
      for (const profile of profiles) {
        const fullName = [profile.first_name, profile.last_name]
          .filter(Boolean)
          .join(' ')
          .trim();
        if (fullName) {
          nameCache.set(profile.id, fullName);
          result.set(profile.id, fullName);
        }
      }
    }
  } catch (err) {
    console.warn('[staff-name-service] Error querying profiles:', err);
  }

  // For any still-unresolved IDs, use truncated UUID as fallback
  for (const id of uncachedIds) {
    if (!result.has(id)) {
      const fallback = id.length > 8 ? `Staff-${id.slice(0, 8)}` : id;
      nameCache.set(id, fallback);
      result.set(id, fallback);
    }
  }

  return result;
}

/**
 * Get display name for a single staff ID (sync, cache-only).
 * Call resolveStaffNames first to populate cache.
 */
export function getStaffDisplayName(userId: string): string {
  if (!userId || userId === 'unknown') return 'Unknown Staff';
  return nameCache.get(userId) || (userId.length > 8 ? `Staff-${userId.slice(0, 8)}` : userId);
}

/**
 * Clear the staff name cache (useful on logout or role change).
 */
export function clearStaffNameCache(): void {
  nameCache.clear();
}
