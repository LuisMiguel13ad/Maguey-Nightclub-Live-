/**
 * NFC Service for reading NFC-enabled tickets
 * Supports Web NFC API (Chrome/Edge) and NDEF format
 */

export type ScanMethod = 'qr' | 'nfc' | 'manual';

export interface NFCTicketPayload {
  token: string;
  signature?: string;
  meta?: Record<string, unknown> | null;
  raw?: string;
}

export interface NFCReadResult {
  success: boolean;
  payload?: NFCTicketPayload;
  error?: string;
  tagId?: string;
}

/**
 * Check if NFC is available on the current device
 */
export const isNFCAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check for Web NFC API (Chrome/Edge)
  if ('NDEFReader' in window) {
    return true;
  }
  
  // Check for Android NFC (via user agent)
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    // Android may support NFC but Web NFC API might not be available
    // We'll attempt to use it anyway
    return true;
  }
  
  return false;
};

/**
 * Check if NFC is currently enabled and ready
 */
export const isNFCEnabled = async (): Promise<boolean> => {
  if (!isNFCAvailable()) return false;
  
  try {
    // Try to create an NDEFReader instance
    if ('NDEFReader' in window) {
      const reader = new (window as any).NDEFReader();
      return true;
    }
  } catch (error) {
    console.debug('[NFC] NFC not enabled:', error);
    return false;
  }
  
  return false;
};

/**
 * Read NFC tag and extract ticket data
 * Supports NDEF format with ticket token and optional signature
 */
export const readNFCTag = async (): Promise<NFCReadResult> => {
  if (!isNFCAvailable()) {
    return {
      success: false,
      error: 'NFC is not available on this device',
    };
  }

  try {
    if (!('NDEFReader' in window)) {
      return {
        success: false,
        error: 'Web NFC API is not supported. Please use Chrome or Edge browser.',
      };
    }

    const reader = new (window as any).NDEFReader();
    
    // Set up reading with timeout
    const readPromise = new Promise<NFCReadResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error('NFC read timeout. Please try again.'));
      }, 10000); // 10 second timeout

      reader.addEventListener('reading', (event: any) => {
        clearTimeout(timeout);
        try {
          const { message, serialNumber } = event;
          const tagId = serialNumber || 'unknown';
          
          // Parse NDEF records
          const records = message.records || [];
          let ticketData: NFCTicketPayload | null = null;
          
          for (const record of records) {
            // Try to decode as text record
            if (record.recordType === 'text') {
              const decoder = new TextDecoder();
              const text = decoder.decode(record.data);
              
              // Try to parse as JSON (our ticket format)
              try {
                const parsed = JSON.parse(text);
                ticketData = {
                  token: parsed.token || parsed.ticket_id || '',
                  signature: parsed.signature,
                  meta: parsed.meta || null,
                  raw: text,
                };
                break;
              } catch (e) {
                // If not JSON, treat as plain token
                ticketData = {
                  token: text.trim(),
                  raw: text,
                };
              }
            } else if (record.recordType === 'mime' && record.mediaType === 'application/json') {
              // MIME type JSON record
              const decoder = new TextDecoder();
              const text = decoder.decode(record.data);
              const parsed = JSON.parse(text);
              ticketData = {
                token: parsed.token || parsed.ticket_id || '',
                signature: parsed.signature,
                meta: parsed.meta || null,
                raw: text,
              };
              break;
            } else if (record.recordType === 'url' || record.recordType === 'absolute-url') {
              // URL record - extract token from URL if possible
              const decoder = new TextDecoder();
              const url = decoder.decode(record.data);
              // Try to extract ticket token from URL
              const match = url.match(/ticket[=:]([^&\/]+)/i);
              if (match) {
                ticketData = {
                  token: match[1],
                  raw: url,
                };
              }
            }
          }
          
          if (!ticketData || !ticketData.token) {
            resolve({
              success: false,
              error: 'No valid ticket data found on NFC tag',
              tagId,
            });
            return;
          }
          
          resolve({
            success: true,
            payload: ticketData,
            tagId,
          });
        } catch (error: any) {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: error.message || 'Failed to parse NFC data',
          });
        }
      });

      reader.addEventListener('readingerror', (event: any) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: event.message || 'Failed to read NFC tag',
        });
      });

      // Start scanning
      reader.scan().catch((error: any) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message || 'Failed to start NFC scan',
        });
      });
    });

    return await readPromise;
  } catch (error: any) {
    console.error('[NFC] Read error:', error);
    return {
      success: false,
      error: error.message || 'NFC read failed',
    };
  }
};

/**
 * Validate NFC signature (if present)
 * Uses the same signing key as QR codes
 */
export const validateNFCSignature = async (
  token: string,
  signature?: string
): Promise<boolean> => {
  if (!signature) {
    // No signature to validate - allow unsigned tickets
    return true;
  }

  try {
    // Use the same QR signing secret for NFC signatures
    const secret = import.meta.env.VITE_QR_SIGNING_SECRET;
    if (!secret) {
      console.warn('[NFC] No signing secret configured - skipping signature validation');
      return true; // Allow if no secret configured
    }

    if (!globalThis.crypto?.subtle) {
      console.warn('[NFC] Web Crypto API unavailable - skipping signature validation');
      return true; // Allow if crypto unavailable
    }

    const textEncoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      textEncoder.encode(token)
    );

    // Convert to base64
    const expectedSignature = btoa(
      String.fromCharCode(...new Uint8Array(expectedBuffer))
    );

    // Constant-time comparison
    return constantTimeEquals(signature, expectedSignature);
  } catch (error) {
    console.error('[NFC] Signature validation error:', error);
    return false;
  }
};

/**
 * Constant-time string comparison to prevent timing attacks
 */
const constantTimeEquals = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

/**
 * Trigger haptic feedback (vibration) on successful NFC read
 */
export const triggerHapticFeedback = (pattern: 'success' | 'error' | 'warning' = 'success'): void => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  const patterns = {
    success: [50], // Short vibration
    error: [100, 50, 100], // Error pattern
    warning: [50, 50, 50], // Warning pattern
  };

  try {
    navigator.vibrate(patterns[pattern]);
  } catch (error) {
    // Ignore vibration errors
    console.debug('[NFC] Vibration not supported:', error);
  }
};

/**
 * Get user-friendly error message for NFC errors
 */
export const getNFCErrorMessage = (error: string): string => {
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('timeout')) {
    return 'NFC read timeout. Please hold the tag closer and try again.';
  }
  
  if (errorLower.includes('not supported') || errorLower.includes('not available')) {
    return 'NFC is not supported on this device. Please use QR code scanning instead.';
  }
  
  if (errorLower.includes('permission') || errorLower.includes('denied')) {
    return 'NFC permission denied. Please enable NFC in your browser settings.';
  }
  
  if (errorLower.includes('not enabled')) {
    return 'NFC is not enabled. Please enable NFC on your device.';
  }
  
  if (errorLower.includes('not found') || errorLower.includes('no valid')) {
    return 'No valid ticket data found on NFC tag.';
  }
  
  return error || 'Failed to read NFC tag. Please try again.';
};

