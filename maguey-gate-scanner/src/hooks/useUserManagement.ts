import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { setUserRole, type UserRole } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  last_sign_in_at?: string;
  full_name?: string;
  scan_count?: number;
}

export const useUserManagement = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  /**
   * Ensure current user has a profile in user_profiles table
   * This syncs auth users with the profiles table
   */
  const ensureUserProfile = async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Upsert current user's profile
      await supabase.from('user_profiles').upsert({
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'employee',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        created_at: user.created_at || new Date().toISOString(),
        last_sign_in_at: user.last_sign_in_at || null,
      }, { onConflict: 'id' });
    } catch (error) {
      // Silently fail - the table may not exist yet
      console.warn('Could not sync user profile:', error);
    }
  };

  /**
   * Get all users - Note: In production, this should be a server-side function
   * For now, we'll use a user_profiles table approach
   */
  const getAllUsers = async (): Promise<UserProfile[]> => {
    if (!isSupabaseConfigured()) {
      return [];
    }

    setLoading(true);
    try {
      // First, ensure current user's profile exists
      await ensureUserProfile();

      // Query from user_profiles table
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);

        // Fallback: Return current user only if table doesn't exist
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          return [{
            id: user.id,
            email: user.email || '',
            role: (user.user_metadata?.role || 'employee') as UserRole,
            created_at: user.created_at || new Date().toISOString(),
            last_sign_in_at: user.last_sign_in_at,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          }];
        }

        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('getAllUsers error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch users. Using fallback.',
      });

      // Return current user as fallback
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        return [{
          id: user.id,
          email: user.email || '',
          role: (user.user_metadata?.role || 'employee') as UserRole,
          created_at: user.created_at || new Date().toISOString(),
          last_sign_in_at: user.last_sign_in_at,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        }];
      }

      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update a user's role
   */
  const updateUserRole = async (userId: string, newRole: UserRole): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Supabase is not configured.',
      });
      return false;
    }

    setLoading(true);
    try {
      // Get current user to check permissions
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Check if current user is owner
      const currentRole = user.user_metadata?.role || 'employee';
      if (currentRole !== 'owner') {
        throw new Error('Only owners can change user roles');
      }

      // For the current user, use setUserRole
      if (userId === user.id) {
        await setUserRole(newRole);
        
        // Update user_profiles if it exists
        await supabase
          .from('user_profiles')
          .update({ role: newRole })
          .eq('id', userId);
        
        toast({
          title: 'Role Updated',
          description: `Your role has been updated to ${newRole}.`,
        });
        return true;
      }

      // For other users, update via user_profiles
      // In production, this should call a server function with admin privileges
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      toast({
        title: 'Role Updated',
        description: `User role has been updated to ${newRole}.`,
      });
      return true;
    } catch (error: any) {
      console.error('updateUserRole error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update user role.',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Set user role to owner
   */
  const promoteToOwner = async (userId: string): Promise<boolean> => {
    return updateUserRole(userId, 'owner');
  };

  /**
   * Set user role to promoter
   */
  const setRoleToPromoter = async (userId: string): Promise<boolean> => {
    return updateUserRole(userId, 'promoter');
  };

  /**
   * Set user role to employee
   */
  const demoteToEmployee = async (userId: string): Promise<boolean> => {
    return updateUserRole(userId, 'employee');
  };

  /**
   * Delete a user - Note: In production, use auth.admin.deleteUser()
   */
  const deleteUser = async (userId: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Supabase is not configured.',
      });
      return false;
    }

    setLoading(true);
    try {
      // Get current user to check permissions
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Check if current user is owner
      const currentRole = user.user_metadata?.role || 'employee';
      if (currentRole !== 'owner') {
        throw new Error('Only owners can delete users');
      }

      // Prevent self-deletion
      if (userId === user.id) {
        throw new Error('Cannot delete your own account');
      }

      // Delete from user_profiles
      // In production, call a server function to use auth.admin.deleteUser()
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        throw error;
      }

      toast({
        title: 'User Deleted',
        description: 'User has been removed from the system.',
      });
      return true;
    } catch (error: any) {
      console.error('deleteUser error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete user.',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    getAllUsers,
    updateUserRole,
    promoteToOwner,
    setRoleToPromoter,
    demoteToEmployee,
    deleteUser,
    loading,
  };
};

