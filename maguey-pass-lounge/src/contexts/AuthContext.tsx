/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import { createContext, useContext, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useAuthMethods } from '@/hooks/useAuthMethods';
import { useAuthProfile } from '@/hooks/useAuthProfile';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, session, loading, signUp, signIn, signOut, logActivity } = useAuthSession();
  const {
    signInWithGoogle, signInWithFacebook, signInWithApple, signInWithGithub,
    resetPassword, signInWithMagicLink, verifyMagicLink,
    enable2FA, verify2FA, disable2FA,
    signInWithPhone, verifyPhoneOTP
  } = useAuthMethods(user);
  const {
    updateProfile, uploadAvatar,
    resendVerification, updatePassword, updateEmail,
    getSessionStatus, checkPasswordBreach: checkPasswordBreachFn
  } = useAuthProfile(user, session);

  const value: AuthContextType = {
    user, session, loading,
    signUp, signIn, signOut,
    signInWithGoogle, signInWithFacebook, signInWithApple, signInWithGithub,
    resetPassword, signInWithMagicLink, verifyMagicLink,
    enable2FA, verify2FA, disable2FA,
    updateProfile, uploadAvatar,
    logActivity, checkPasswordBreach: checkPasswordBreachFn,
    signInWithPhone, verifyPhoneOTP,
    resendVerification, updatePassword, updateEmail,
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
