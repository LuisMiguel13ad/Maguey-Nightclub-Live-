import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { localStorageService } from '@/lib/localStorage';

export type UserRole = 'owner' | 'promoter' | 'employee';

const DEFAULT_ROLE: UserRole = 'employee';
const VALID_ROLES: UserRole[] = ['owner', 'promoter', 'employee'];

/**
 * Get user role from Supabase user metadata
 * @param user - Supabase user object
 * @returns User role, defaults to 'employee'
 */
export const getUserRole = (user: any): UserRole => {
  if (!user) return DEFAULT_ROLE;

  // Check user_metadata first (new way)
  if (user.user_metadata?.role) {
    const role = user.user_metadata.role;
    if (VALID_ROLES.includes(role)) {
      return role as UserRole;
    }
  }

  // Fallback to app_metadata (older way)
  if (user.app_metadata?.role) {
    const role = user.app_metadata.role;
    if (VALID_ROLES.includes(role)) {
      return role as UserRole;
    }
  }

  return DEFAULT_ROLE;
};

/**
 * Set user role in Supabase user metadata
 * @param role - Role to assign ('owner' | 'promoter' | 'employee')
 */
export const setUserRole = async (role: UserRole): Promise<void> => {
  if (!isSupabaseConfigured() && import.meta.env.DEV) {
    const currentUser = localStorageService.getUser();
    if (currentUser) {
      localStorageService.setUser({
        ...currentUser,
        role,
      });
    } else {
      localStorageService.setUser({
        id: 'local-user',
        email: 'local@offline.dev',
        role,
      });
    }
    return;
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Cannot set user role: Supabase not configured in production');
  }

  const { error } = await supabase.auth.updateUser({
    data: { role },
  });

  if (error) {
    console.error('Failed to set user role:', error);
    throw error;
  }
};

/**
 * Check if user has permission for a specific action
 * @param role - User's role
 * @param permission - Permission to check
 * @returns true if user has permission
 */
export const hasPermission = (
  role: UserRole,
  permission: 'view_analytics' | 'view_events' | 'view_orders' | 'manage_tickets' | 'manage_events' | 'manage_staff'
): boolean => {
  if (role === 'owner') {
    return true; // Owners have all permissions
  }

  if (role === 'promoter') {
    // Promoters can view but not manage
    const promoterPermissions = ['view_analytics', 'view_events', 'view_orders'];
    return promoterPermissions.includes(permission);
  }

  // Employees have scanner access only (no special permissions)
  return false;
};

/**
 * Get current user's role from session
 * @returns User role or null if not authenticated
 */
export const getCurrentUserRole = async (): Promise<UserRole | null> => {
  if (!isSupabaseConfigured() && import.meta.env.DEV) {
    return DEFAULT_ROLE; // Default role for development mode
  }

  if (!isSupabaseConfigured()) {
    return null; // Production: not configured = not authenticated
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return null;
  }

  return getUserRole(session.user);
};

