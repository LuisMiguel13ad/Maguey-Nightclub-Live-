/**
 * Security Service
 * 
 * Security features including session management, IP whitelisting,
 * and password policy enforcement
 */

import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { logAuditEvent } from './audit-service';

export interface SecuritySettings {
  ip_whitelist_enabled: boolean;
  ip_whitelist: string[];
  session_timeout_minutes: number;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  two_factor_enabled: boolean;
}

export interface LoginAttempt {
  user_id: string;
  email: string;
  ip_address: string;
  success: boolean;
  timestamp: string;
}

/**
 * Check if IP address is whitelisted
 */
export const isIPWhitelisted = async (ipAddress: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return true; // Allow all in development
  }

  try {
    const { data, error } = await supabase
      .from('security_settings')
      .select('ip_whitelist_enabled, ip_whitelist')
      .single();

    if (error || !data) {
      return true; // Default to allow if settings not found
    }

    if (!data.ip_whitelist_enabled) {
      return true; // Whitelist disabled
    }

    return data.ip_whitelist?.includes(ipAddress) || false;
  } catch (error) {
    console.error('Error checking IP whitelist:', error);
    return true; // Default to allow on error
  }
};

/**
 * Record login attempt
 */
export const recordLoginAttempt = async (
  email: string,
  success: boolean,
  ipAddress?: string
): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase
      .from('login_attempts')
      .insert({
        user_id: user?.id || null,
        email,
        ip_address: ipAddress || null,
        success,
        timestamp: new Date().toISOString(),
      });

    // Log audit event
    await logAuditEvent(
      success ? 'login' : 'login_failed',
      'user',
      success ? `Successful login: ${email}` : `Failed login attempt: ${email}`,
      {
        userId: user?.id || null,
        severity: success ? 'info' : 'warning',
        metadata: { email, ipAddress },
      }
    );

    // Check for suspicious activity
    if (!success) {
      await checkSuspiciousActivity(email, ipAddress);
    }
  } catch (error) {
    console.error('Error recording login attempt:', error);
  }
};

/**
 * Check for suspicious login activity
 */
const checkSuspiciousActivity = async (
  email: string,
  ipAddress?: string
): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { count } = await supabase
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('success', false)
      .gte('timestamp', fiveMinutesAgo);

    if (count && count >= 5) {
      // Too many failed attempts
      await logAuditEvent(
        'suspicious_activity',
        'user',
        `Multiple failed login attempts detected for ${email}`,
        {
          severity: 'high',
          metadata: { email, ipAddress, failedAttempts: count },
        }
      );
    }
  } catch (error) {
    console.error('Error checking suspicious activity:', error);
  }
};

/**
 * Get security settings
 */
export const getSecuritySettings = async (): Promise<SecuritySettings | null> => {
  if (!isSupabaseConfigured()) {
    return {
      ip_whitelist_enabled: false,
      ip_whitelist: [],
      session_timeout_minutes: 60,
      password_min_length: 8,
      password_require_uppercase: true,
      password_require_lowercase: true,
      password_require_numbers: true,
      password_require_special: false,
      max_login_attempts: 5,
      lockout_duration_minutes: 15,
      two_factor_enabled: false,
    };
  }

  try {
    const { data, error } = await supabase
      .from('security_settings')
      .select('*')
      .single();

    if (error || !data) {
      return null;
    }

    return data as SecuritySettings;
  } catch (error) {
    console.error('Error fetching security settings:', error);
    return null;
  }
};

/**
 * Update security settings
 */
export const updateSecuritySettings = async (
  settings: Partial<SecuritySettings>
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  try {
    const { error } = await supabase
      .from('security_settings')
      .upsert(settings, { onConflict: 'id' });

    if (error) throw error;

    await logAuditEvent(
      'settings_changed',
      'security_settings',
      'Security settings updated',
      {
        severity: 'info',
        metadata: settings,
      }
    );
  } catch (error) {
    console.error('Error updating security settings:', error);
    throw error;
  }
};

/**
 * Validate password against policy
 */
export const validatePassword = (
  password: string,
  settings?: SecuritySettings | null
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const defaultSettings: SecuritySettings = {
    ip_whitelist_enabled: false,
    ip_whitelist: [],
    session_timeout_minutes: 60,
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_numbers: true,
    password_require_special: false,
    max_login_attempts: 5,
    lockout_duration_minutes: 15,
    two_factor_enabled: false,
  };

  const policy = settings || defaultSettings;

  if (password.length < policy.password_min_length) {
    errors.push(`Password must be at least ${policy.password_min_length} characters`);
  }

  if (policy.password_require_uppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (policy.password_require_lowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (policy.password_require_numbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (policy.password_require_special && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Get client IP address (simplified - would need server-side in production)
 */
export const getClientIP = (): string | undefined => {
  // In a real implementation, this would be obtained from server-side headers
  // For now, return undefined (will be set by server if available)
  return undefined;
};


