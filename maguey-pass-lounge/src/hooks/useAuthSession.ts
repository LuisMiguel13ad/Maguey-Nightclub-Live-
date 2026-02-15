/**
 * useAuthSession Hook
 * Manages session initialization, auth state, and core authentication (signUp, signIn, signOut)
 */

import { useState, useEffect } from 'react';
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

export function useAuthSession() {
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

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    logActivity,
  };
}
