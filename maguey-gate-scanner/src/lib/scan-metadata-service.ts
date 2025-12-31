/**
 * Scan Metadata Collection Service
 * 
 * Collects device fingerprinting, IP address, geolocation, and network information
 * for fraud detection purposes.
 */

import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

export interface ScanMetadata {
  ip_address: string;
  user_agent: string | null;
  device_fingerprint: string;
  geolocation: {
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
    countryCode?: string;
  } | null;
  network_type: string | null;
  is_vpn: boolean;
  screen_resolution: string | null;
  timezone: string | null;
  language: string | null;
}

/**
 * Generates a device fingerprint from available browser/device information
 */
export const generateDeviceFingerprint = (): string => {
  const components: string[] = [];

  // User agent
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    components.push(navigator.userAgent);
  }

  // Screen resolution
  if (typeof screen !== 'undefined') {
    components.push(`${screen.width}x${screen.height}`);
    components.push(`${screen.availWidth}x${screen.availHeight}`);
  }

  // Timezone
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      components.push(timezone);
    } catch (e) {
      // Ignore timezone errors
    }
  }

  // Language
  if (typeof navigator !== 'undefined') {
    components.push(navigator.language || '');
    if (navigator.languages) {
      components.push(navigator.languages.join(','));
    }
  }

  // Hardware concurrency (CPU cores)
  if (typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator) {
    components.push(`cores:${navigator.hardwareConcurrency}`);
  }

  // Platform
  if (typeof navigator !== 'undefined' && navigator.platform) {
    components.push(navigator.platform);
  }

  // Canvas fingerprinting (simplified - just check if canvas is available)
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
        // Use a hash of the canvas data
        const canvasData = canvas.toDataURL();
        components.push(`canvas:${canvasData.substring(0, 50)}`);
      }
    } catch (e) {
      // Ignore canvas errors
    }
  }

  // Create a simple hash of all components
  const combined = components.join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `fp_${Math.abs(hash).toString(36)}`;
};

/**
 * Detects if the connection is likely a VPN
 * This is a simplified check - in production, you'd use a VPN detection service
 */
export const detectVPN = async (ipAddress: string): Promise<boolean> => {
  // Simplified VPN detection - check for common VPN patterns
  // In production, integrate with a service like ipapi.co, ipgeolocation.io, or similar
  
  // For now, return false - this would be enhanced with actual VPN detection API
  // You can integrate with services like:
  // - https://ipapi.co/{ip}/json/ (has 'vpn' field)
  // - https://ipgeolocation.io/ (has 'is_vpn' field)
  
  return false;
};

/**
 * Gets geolocation information for an IP address
 * Falls back to browser geolocation if IP geolocation fails
 */
export const getGeolocation = async (ipAddress?: string): Promise<ScanMetadata['geolocation']> => {
  // Try browser geolocation first (more accurate)
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 60000, // Cache for 1 minute
        });
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (e) {
      // Browser geolocation failed, fall through to IP geolocation
    }
  }

  // Fallback to IP geolocation (if IP provided)
  if (ipAddress) {
    try {
      // In production, use a geolocation service
      // Example: const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
      // For now, return null
      return null;
    } catch (e) {
      return null;
    }
  }

  return null;
};

/**
 * Gets network type (WiFi, cellular, etc.)
 */
export const getNetworkType = (): string | null => {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return null;
  }

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    return connection.effectiveType || connection.type || null;
  }

  return null;
};

/**
 * Collects all scan metadata
 */
export const collectScanMetadata = async (ipAddress?: string): Promise<ScanMetadata> => {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
  const deviceFingerprint = generateDeviceFingerprint();
  const geolocation = await getGeolocation(ipAddress);
  const networkType = getNetworkType();
  const isVPN = ipAddress ? await detectVPN(ipAddress) : false;
  
  const screenResolution = typeof screen !== 'undefined' 
    ? `${screen.width}x${screen.height}` 
    : null;
  
  const timezone = typeof Intl !== 'undefined' && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : null;
  
  const language = typeof navigator !== 'undefined'
    ? navigator.language || null
    : null;

  // Get IP address if not provided
  let detectedIP = ipAddress;
  if (!detectedIP && typeof window !== 'undefined') {
    // Try to get IP from a service (in production, this would be done server-side)
    // For client-side, we'd need to call an API endpoint
    // For now, we'll rely on server-side IP detection
  }

  return {
    ip_address: detectedIP || 'unknown',
    user_agent: userAgent,
    device_fingerprint: deviceFingerprint,
    geolocation,
    network_type: networkType,
    is_vpn: isVPN,
    screen_resolution: screenResolution,
    timezone,
    language,
  };
};

/**
 * Saves scan metadata to the database
 */
export const saveScanMetadata = async (
  scanLogId: string,
  metadata: ScanMetadata
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    console.warn('[scan-metadata] Supabase not configured, skipping metadata save');
    return;
  }

  try {
    const { error } = await supabase
      .from('scan_metadata')
      .insert({
        scan_log_id: scanLogId,
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        device_fingerprint: metadata.device_fingerprint,
        geolocation: metadata.geolocation,
        network_type: metadata.network_type,
        is_vpn: metadata.is_vpn,
        screen_resolution: metadata.screen_resolution,
        timezone: metadata.timezone,
        language: metadata.language,
      });

    if (error) {
      console.error('[scan-metadata] Error saving metadata:', error);
      throw error;
    }
  } catch (error) {
    console.error('[scan-metadata] Failed to save metadata:', error);
    // Don't throw - metadata collection shouldn't break scanning
  }
};

/**
 * Gets IP address from the client
 * In production, this should be done server-side via headers
 * For now, we'll use a simple approach
 */
export const getClientIPAddress = async (): Promise<string> => {
  // In a real application, IP should be detected server-side
  // For client-side, we can use a service like ipify.org
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (e) {
    console.warn('[scan-metadata] Failed to get IP address:', e);
    return 'unknown';
  }
};

