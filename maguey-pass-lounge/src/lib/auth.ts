import { User } from '@supabase/supabase-js';

export type UserRole = 'attendee' | 'organizer';

export const VALID_ROLES: UserRole[] = ['attendee', 'organizer'];
export const DEFAULT_ROLE: UserRole = 'attendee';

/**
 * Extracts the user role from Supabase user metadata
 * @param user - Supabase user object
 * @returns UserRole
 */
export const getUserRole = (user: User | null): UserRole => {
    if (!user) return DEFAULT_ROLE;

    // Check user_metadata for account_type (which maps to our roles)
    const accountType = user.user_metadata?.account_type;

    if (accountType && VALID_ROLES.includes(accountType as UserRole)) {
        return accountType as UserRole;
    }

    return DEFAULT_ROLE;
};

/**
 * Checks if a user has one of the allowed roles
 * @param userRole - The user's role
 * @param allowedRoles - Array of allowed roles
 * @returns boolean
 */
export const hasRequiredRole = (userRole: UserRole, allowedRoles?: UserRole[]): boolean => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.includes(userRole);
};
