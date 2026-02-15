/**
 * useAuthProfile Hook
 * Manages profile updates, avatar upload, email/password changes, and session status
 */

import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { checkPasswordBreach } from '@/lib/password-breach';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder');

export function useAuthProfile(user: User | null, session: Session | null) {
  const updateProfile = async (data: { firstName?: string; lastName?: string; phone?: string; dateOfBirth?: string }) => {
    if (!isSupabaseConfigured || !user) {
      return {
        error: {
          message: 'Profile update is unavailable.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      const updateData: any = {};
      if (data.firstName !== undefined) updateData.first_name = data.firstName;
      if (data.lastName !== undefined) updateData.last_name = data.lastName;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.dateOfBirth !== undefined) updateData.date_of_birth = data.dateOfBirth;

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...updateData,
        });

      // Also update user metadata
      if (data.firstName || data.lastName) {
        await supabase.auth.updateUser({
          data: {
            first_name: data.firstName || user.user_metadata?.first_name,
            last_name: data.lastName || user.user_metadata?.last_name,
          },
        });
      }

      return { error: error as AuthError | null };
    } catch (error) {
      console.error('Update profile error:', error);
      return { error: error as AuthError };
    }
  };

  const uploadAvatar = async (file: File): Promise<{ url: string | null; error: AuthError | null }> => {
    if (!isSupabaseConfigured || !user) {
      return {
        url: null,
        error: {
          message: 'Avatar upload is unavailable.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      // Resize image if needed (basic check)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return {
          url: null,
          error: {
            message: 'Image size must be less than 5MB.',
            name: 'AuthError',
          } as AuthError,
        };
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        return {
          url: null,
          error: uploadError as AuthError,
        };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          avatar_url: avatarUrl,
        });

      if (updateError) {
        return {
          url: null,
          error: updateError as AuthError,
        };
      }

      return { url: avatarUrl, error: null };
    } catch (error) {
      console.error('Upload avatar error:', error);
      return {
        url: null,
        error: error as AuthError,
      };
    }
  };

  const resendVerification = async () => {
    if (!isSupabaseConfigured || !user) {
      return {
        error: {
          message: 'Email verification is unavailable.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email!,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });
      return { error };
    } catch (error) {
      console.error('Resend verification error:', error);
      return { error: error as AuthError };
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (!isSupabaseConfigured || !user) {
      return {
        error: {
          message: 'Password update is unavailable.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error };
    } catch (error) {
      console.error('Update password error:', error);
      return { error: error as AuthError };
    }
  };

  const updateEmail = async (newEmail: string) => {
    if (!isSupabaseConfigured || !user) {
      return {
        error: {
          message: 'Email update is unavailable.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });
      return { error };
    } catch (error) {
      console.error('Update email error:', error);
      return { error: error as AuthError };
    }
  };

  const getSessionStatus = () => {
    if (!session || !session.expires_at) {
      return {
        isExpiring: false,
        expiresAt: null,
        minutesRemaining: 0,
      };
    }

    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    const minutesRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 60000));
    const isExpiring = minutesRemaining <= 5 && minutesRemaining > 0;

    return {
      isExpiring,
      expiresAt,
      minutesRemaining,
    };
  };

  const checkPasswordBreachWrapper = async (password: string) => {
    return checkPasswordBreach(password);
  };

  return {
    updateProfile,
    uploadAvatar,
    resendVerification,
    updatePassword,
    updateEmail,
    getSessionStatus,
    checkPasswordBreach: checkPasswordBreachWrapper,
  };
}
