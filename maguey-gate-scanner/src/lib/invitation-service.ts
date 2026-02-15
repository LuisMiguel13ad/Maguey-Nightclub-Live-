import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

export interface Invitation {
  id: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_at?: string;
  used_by?: string;
  metadata?: Record<string, any>;
}

export interface InvitationValidation {
  valid: boolean;
  invitation?: Invitation;
  error?: string;
}

/**
 * Generate a cryptographically secure invitation token
 */
export const generateInvitationToken = (): string => {
  // Generate a random token using crypto API
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Create a new invitation
 * @param createdBy - User ID creating the invitation
 * @param expiresIn - Number of hours until expiration (default: 168 = 7 days)
 * @param metadata - Optional metadata to store with invitation
 */
export const createInvitation = async (
  createdBy: string,
  expiresIn: number = 168, // 7 days in hours
  metadata?: Record<string, any>
): Promise<{ success: boolean; invitation?: Invitation; token?: string; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase is not configured',
    };
  }

  try {
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresIn);

    const invitationData = {
      token,
      created_by: createdBy,
      expires_at: expiresAt.toISOString(),
      metadata: metadata || {},
    };

    const { data, error } = await supabase
      .from('invitations')
      .insert(invitationData)
      .select()
      .single();

    if (error) {
      console.error('Error creating invitation:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      invitation: data,
      token,
    };
  } catch (error: any) {
    console.error('createInvitation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create invitation',
    };
  }
};

/**
 * Validate an invitation token
 * @param token - Invitation token to validate
 */
export const validateInvitation = async (token: string): Promise<InvitationValidation> => {
  if (!isSupabaseConfigured()) {
    return {
      valid: false,
      error: 'Supabase is not configured',
    };
  }

  if (!token || token.trim() === '') {
    return {
      valid: false,
      error: 'Invalid invitation token',
    };
  }

  try {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      console.error('Error validating invitation:', error);
      return {
        valid: false,
        error: 'Failed to validate invitation',
      };
    }

    if (!data) {
      return {
        valid: false,
        error: 'Invitation not found',
      };
    }

    // Check if already used
    if (data.used_at) {
      return {
        valid: false,
        error: 'This invitation has already been used',
      };
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    if (now > expiresAt) {
      return {
        valid: false,
        error: 'This invitation has expired',
      };
    }

    return {
      valid: true,
      invitation: data,
    };
  } catch (error: any) {
    console.error('validateInvitation error:', error);
    return {
      valid: false,
      error: error.message || 'Failed to validate invitation',
    };
  }
};

/**
 * Consume (mark as used) an invitation
 * @param token - Invitation token to consume
 * @param usedBy - User ID that is consuming the invitation
 */
export const consumeInvitation = async (
  token: string,
  usedBy: string
): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase is not configured',
    };
  }

  try {
    // First validate the invitation
    const validation = await validateInvitation(token);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Invalid invitation',
      };
    }

    // Mark as used
    const { error } = await supabase
      .from('invitations')
      .update({
        used_at: new Date().toISOString(),
        used_by: usedBy,
      })
      .eq('token', token);

    if (error) {
      console.error('Error consuming invitation:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('consumeInvitation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to consume invitation',
    };
  }
};

/**
 * Get all invitations created by a user
 * @param userId - User ID to fetch invitations for
 */
export const getInvitationsByUser = async (userId: string): Promise<Invitation[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return [];
    }

    return data || [];
  } catch (error: any) {
    console.error('getInvitationsByUser error:', error);
    return [];
  }
};

/**
 * Revoke (delete) an unused invitation
 * @param invitationId - ID of invitation to revoke
 */
export const revokeInvitation = async (invitationId: string): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase is not configured',
    };
  }

  try {
    // Check if invitation exists and is not used
    const { data: invitation } = await supabase
      .from('invitations')
      .select('used_at')
      .eq('id', invitationId)
      .single();

    if (invitation?.used_at) {
      return {
        success: false,
        error: 'Cannot revoke an invitation that has already been used',
      };
    }

    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      console.error('Error revoking invitation:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('revokeInvitation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to revoke invitation',
    };
  }
};

/**
 * Generate the full invitation URL
 * @param token - Invitation token
 */
export const getInvitationUrl = (token: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/auth/owner?invite=${token}`;
};

