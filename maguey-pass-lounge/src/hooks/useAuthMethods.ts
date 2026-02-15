/**
 * useAuthMethods Hook
 * Manages OAuth providers, magic link, password reset, 2FA, and phone authentication
 */

import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder');

export function useAuthMethods(user: User | null) {
  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      throw new Error('Google login is unavailable in demo mode.');
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/account`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  const signInWithFacebook = async () => {
    if (!isSupabaseConfigured) {
      throw new Error('Facebook login is unavailable in demo mode.');
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: `${window.location.origin}/account`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Facebook sign in error:', error);
      throw error;
    }
  };

  const signInWithApple = async () => {
    if (!isSupabaseConfigured) {
      throw new Error('Apple login is unavailable in demo mode.');
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/account`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Apple sign in error:', error);
      throw error;
    }
  };

  const signInWithGithub = async () => {
    if (!isSupabaseConfigured) {
      throw new Error('GitHub login is unavailable in demo mode.');
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/account`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('GitHub sign in error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: {
          message: 'Password reset is unavailable in demo mode.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error: error as AuthError };
    }
  };

  const signInWithMagicLink = async (email: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: {
          message: 'Magic link login is unavailable in demo mode.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/account`,
        },
      });
      return { error };
    } catch (error) {
      console.error('Magic link error:', error);
      return { error: error as AuthError };
    }
  };

  const verifyMagicLink = async (token: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: {
          message: 'Magic link verification is unavailable in demo mode.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });

      if (data?.user) {
        // Note: logActivity is called from useAuthSession via the auth state listener
      } else if (error) {
        // Note: logActivity is called from useAuthSession
      }

      return { error };
    } catch (error) {
      console.error('Magic link verification error:', error);
      return { error: error as AuthError };
    }
  };

  const enable2FA = async () => {
    if (!isSupabaseConfigured || !user) {
      return {
        data: null,
        error: {
          message: '2FA is unavailable.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      // Generate TOTP secret
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(20)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
        .match(/.{1,4}/g)
        ?.join(' ') || '';

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () =>
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );

      // Create QR code data URL (using otpauth URL)
      const otpauthUrl = `otpauth://totp/Maguey:${user.email}?secret=${secret.replace(/\s/g, '')}&issuer=Maguey`;
      const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

      // Store secret and backup codes in database
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          two_factor_enabled: false, // Will be enabled after verification
          two_factor_secret: secret.replace(/\s/g, ''),
          backup_codes: backupCodes,
        });

      if (dbError) {
        return {
          data: null,
          error: dbError as AuthError,
        };
      }

      return {
        data: {
          secret,
          qrCode,
          backupCodes,
        },
        error: null,
      };
    } catch (error) {
      console.error('Enable 2FA error:', error);
      return {
        data: null,
        error: error as AuthError,
      };
    }
  };

  const verify2FA = async (code: string) => {
    if (!isSupabaseConfigured || !user) {
      return {
        error: {
          message: '2FA verification is unavailable.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      // Get user's 2FA secret from profile
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('two_factor_secret, backup_codes')
        .eq('id', user.id)
        .single();

      if (fetchError || !profile) {
        return {
          error: {
            message: '2FA not set up. Please enable 2FA first.',
            name: 'AuthError',
          } as AuthError,
        };
      }

      // Simple TOTP verification (in production, use a proper TOTP library)
      // For now, we'll check backup codes
      const backupCodes = profile.backup_codes || [];
      if (backupCodes.includes(code)) {
        // Remove used backup code
        const updatedCodes = backupCodes.filter((c: string) => c !== code);
        await supabase
          .from('profiles')
          .update({ backup_codes: updatedCodes })
          .eq('id', user.id);

        // Enable 2FA
        await supabase
          .from('profiles')
          .update({ two_factor_enabled: true })
          .eq('id', user.id);

        return { error: null };
      }

      // TODO: Implement proper TOTP verification using a library like 'otpauth'
      // For now, return error
      return {
        error: {
          message: 'Invalid 2FA code. Please try again.',
          name: 'AuthError',
        } as AuthError,
      };
    } catch (error) {
      console.error('Verify 2FA error:', error);
      return { error: error as AuthError };
    }
  };

  const disable2FA = async () => {
    if (!isSupabaseConfigured || !user) {
      return {
        error: {
          message: '2FA is unavailable.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: false,
          two_factor_secret: null,
          backup_codes: null,
        })
        .eq('id', user.id);

      return { error: error as AuthError | null };
    } catch (error) {
      console.error('Disable 2FA error:', error);
      return { error: error as AuthError };
    }
  };

  // Phone authentication stubs (TODO: Implement with Twilio or similar)
  const signInWithPhone = async (phone: string) => {
    // TODO: Implement phone authentication with SMS provider
    return {
      error: {
        message: 'Phone authentication is not yet configured. Please contact support.',
        name: 'AuthError',
      } as AuthError,
    };
  };

  const verifyPhoneOTP = async (phone: string, token: string) => {
    // TODO: Implement phone OTP verification
    return {
      error: {
        message: 'Phone authentication is not yet configured. Please contact support.',
        name: 'AuthError',
      } as AuthError,
    };
  };

  return {
    signInWithGoogle,
    signInWithFacebook,
    signInWithApple,
    signInWithGithub,
    resetPassword,
    signInWithMagicLink,
    verifyMagicLink,
    enable2FA,
    verify2FA,
    disable2FA,
    signInWithPhone,
    verifyPhoneOTP,
  };
}
