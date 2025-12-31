/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { checkPasswordBreach } from '@/lib/password-breach';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: { firstName?: string; lastName?: string }) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: AuthError | null }>;
  verifyMagicLink: (token: string) => Promise<{ error: AuthError | null }>;
  enable2FA: () => Promise<{ data: { secret: string; qrCode: string; backupCodes: string[] } | null; error: AuthError | null }>;
  verify2FA: (code: string) => Promise<{ error: AuthError | null }>;
  disable2FA: () => Promise<{ error: AuthError | null }>;
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string; dateOfBirth?: string }) => Promise<{ error: AuthError | null }>;
  uploadAvatar: (file: File) => Promise<{ url: string | null; error: AuthError | null }>;
  logActivity: (method: string, success: boolean, failureReason?: string) => Promise<void>;
  checkPasswordBreach: (password: string) => Promise<{ breached: boolean; count: number }>;
  signInWithPhone: (phone: string) => Promise<{ error: AuthError | null }>;
  verifyPhoneOTP: (phone: string, token: string) => Promise<{ error: AuthError | null }>;
  resendVerification: () => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: AuthError | null }>;
  getSessionStatus: () => { isExpiring: boolean; expiresAt: Date | null; minutesRemaining: number };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder');

const demoUser = {
  id: 'demo-user',
  email: 'demo@maguey.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'demo' },
  user_metadata: { first_name: 'Demo', last_name: 'User' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  factors: [],
} as unknown as User;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if Supabase is properly configured
    if (!isSupabaseConfigured) {
      // If Supabase is not configured, skip auth initialization
      // App will work without auth, users just won't be able to login
      setLoading(false);
      return;
    }

    let mounted = true;

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return;
        
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!mounted) return;
        console.error('Error initializing auth:', error);
        setLoading(false);
      });

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null;
    
    try {
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });
      
      subscription = authSubscription;
    } catch (error) {
      console.error('Error setting up auth listener:', error);
      setLoading(false);
    }

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    metadata?: { firstName?: string; lastName?: string; accountType?: "attendee" | "organizer" }
  ) => {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured. Sign up requests are ignored.');
      return {
        error: {
          message: 'Sign up is disabled in demo mode.',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: metadata?.firstName || '',
            last_name: metadata?.lastName || '',
            account_type: metadata?.accountType || 'attendee',
          },
          emailRedirectTo: `${window.location.origin}/account`,
        },
      });

      if (data?.user) {
        setUser(data.user);
        setSession(data.session);
      }

      return { error };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: error as AuthError };
    }
  };

  const logActivity = async (method: string, success: boolean, failureReason?: string) => {
    if (!isSupabaseConfigured || !user) return;

    try {
      // Get IP address (simplified - in production use a proper IP detection service)
      const ipAddress = 'unknown'; // TODO: Implement proper IP detection
      const userAgent = navigator.userAgent;
      const location = 'unknown'; // TODO: Implement geolocation

      await supabase.from('login_activity').insert({
        user_id: user.id,
        method,
        success,
        failure_reason: failureReason || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        location,
      });
    } catch (error) {
      console.error('Log activity error:', error);
      // Don't throw - logging failures shouldn't break the app
    }
  };

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    if (!isSupabaseConfigured) {
      const normalizedEmail = email.trim().toLowerCase();
      const isDemoCredentials =
        (normalizedEmail === 'demo@maguey.com' || normalizedEmail === 'demo@magüey.com') &&
        password === 'demo1234';

      if (isDemoCredentials) {
        setUser(demoUser);
        setSession(null);
        // Skip logging for demo mode
        return { error: null };
      }

      return {
        error: {
          message: 'Demo login only accepts demo@maguey.com / demo1234',
          name: 'AuthError',
        } as AuthError,
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          shouldCreateUser: false,
        },
      });

      if (data?.user) {
        setUser(data.user);
        setSession(data.session);
        // Log activity after user is set
        await logActivity('email', true);
      } else if (error) {
        // Try to log failed attempt (may not have user yet)
        const { data: { user: tempUser } } = await supabase.auth.getUser();
        if (tempUser) {
          await logActivity('email', false, error.message);
        }
      }

      return { error };
    } catch (error) {
      console.error('Sign in error:', error);
      // Try to log failed attempt
      const { data: { user: tempUser } } = await supabase.auth.getUser();
      if (tempUser) {
        await logActivity('email', false, error instanceof Error ? error.message : 'Unknown error');
      }
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setSession(null);
      return;
    }

    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Sign out error:', error);
      // Still clear local state even if sign out fails
      setUser(null);
      setSession(null);
    }
  };

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
        setUser(data.user);
        setSession(data.session);
        await logActivity('magic_link', true);
      } else if (error) {
        await logActivity('magic_link', false, error.message);
      }

      return { error };
    } catch (error) {
      console.error('Magic link verification error:', error);
      await logActivity('magic_link', false, error instanceof Error ? error.message : 'Unknown error');
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

  const checkPasswordBreachWrapper = async (password: string) => {
    return checkPasswordBreach(password);
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
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
    updateProfile,
    uploadAvatar,
    logActivity,
    checkPasswordBreach: checkPasswordBreachWrapper,
    signInWithPhone,
    verifyPhoneOTP,
    resendVerification,
    updatePassword,
    updateEmail,
    getSessionStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

