/**
 * Biometric Authentication Service
 * Uses Web Authentication API (WebAuthn) for passwordless authentication
 * Supports Face ID, Touch ID, Windows Hello, and security keys
 */

import { supabase } from './supabase';

export interface BiometricCredential {
  credentialId: string;
  publicKey: string;
  deviceName: string;
  deviceType: string;
  createdAt: string;
}

/**
 * Check if WebAuthn is supported in the current browser
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  );

}

/**
 * Get device type based on user agent
 */
function getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Generate a simple device fingerprint
 */
function generateDeviceFingerprint(): string {
  if (typeof window === 'undefined') return '';
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Device fingerprint', 2, 2);
  }
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
  ].join('|');
  
  return btoa(fingerprint).substring(0, 32);
}

/**
 * Register a new biometric credential for the user
 * @param userId - The user's ID
 * @param deviceName - Name for the device (e.g., "John's iPhone")
 * @returns The credential ID if successful
 */
export async function registerBiometric(
  userId: string,
  deviceName: string
): Promise<{ credentialId: string; error: Error | null }> {
  if (!isWebAuthnSupported()) {
    return {
      credentialId: '',
      error: new Error('WebAuthn is not supported in this browser'),
    };
  }

  try {
    // Generate a random challenge
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Get user email for credential creation
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return {
        credentialId: '',
        error: new Error('User not authenticated'),
      };
    }

    // Create credential
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Maguey Pass Lounge',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: user.email,
          displayName: user.user_metadata?.first_name || user.email,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Prefer platform authenticators (Face ID, Touch ID)
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'direct',
      },
    })) as PublicKeyCredential;

    if (!credential) {
      return {
        credentialId: '',
        error: new Error('Failed to create credential'),
      };
    }

    const response = credential.response as AuthenticatorAttestationResponse;
    const publicKey = Array.from(new Uint8Array(response.getPublicKey() || new Uint8Array(0)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const credentialId = Array.from(new Uint8Array(credential.rawId))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Store credential in database
    const deviceType = getDeviceType();
    const deviceFingerprint = generateDeviceFingerprint();

    const { error: dbError } = await supabase.from('user_devices').insert({
      user_id: userId,
      device_name: deviceName || `${deviceType} device`,
      device_type: deviceType,
      device_fingerprint: deviceFingerprint,
      credential_id: credentialId,
      public_key: publicKey,
      is_trusted: true,
      last_used: new Date().toISOString(),
    });

    if (dbError) {
      return {
        credentialId: '',
        error: dbError as Error,
      };
    }

    return {
      credentialId,
      error: null,
    };
  } catch (error) {
    return {
      credentialId: '',
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Authenticate using a biometric credential
 * @param userId - The user's ID
 * @returns Success status
 */
export async function authenticateBiometric(
  userId: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: new Error('WebAuthn is not supported in this browser'),
    };
  }

  try {
    // Get user's registered credentials
    const { data: devices, error: fetchError } = await supabase
      .from('user_devices')
      .select('credential_id, public_key')
      .eq('user_id', userId)
      .eq('is_trusted', true);

    if (fetchError || !devices || devices.length === 0) {
      return {
        success: false,
        error: new Error('No biometric credentials found'),
      };
    }

    // Generate challenge
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Convert credential IDs from hex strings to ArrayBuffers
    const allowCredentials = devices.map(device => ({
      id: Uint8Array.from(
        device.credential_id.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      ),
      type: 'public-key' as const,
    }));

    // Request authentication
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials,
        timeout: 60000,
        userVerification: 'required',
      },
    })) as PublicKeyCredential;

    if (!credential) {
      return {
        success: false,
        error: new Error('Biometric authentication failed'),
      };
    }

    // Update last used timestamp
    const credentialId = Array.from(new Uint8Array(credential.rawId))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    await supabase
      .from('user_devices')
      .update({ last_used: new Date().toISOString() })
      .eq('credential_id', credentialId);

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get user's registered biometric devices
 */
export async function getBiometricDevices(
  userId: string
): Promise<BiometricCredential[]> {
  const { data, error } = await supabase
    .from('user_devices')
    .select('credential_id, public_key, device_name, device_type, created_at')
    .eq('user_id', userId)
    .eq('is_trusted', true)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(device => ({
    credentialId: device.credential_id,
    publicKey: device.public_key,
    deviceName: device.device_name,
    deviceType: device.device_type || 'desktop',
    createdAt: device.created_at,
  }));
}

/**
 * Remove a biometric credential
 */
export async function removeBiometricCredential(
  userId: string,
  credentialId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('user_devices')
    .delete()
    .eq('user_id', userId)
    .eq('credential_id', credentialId);

  return { error: error as Error | null };
}

