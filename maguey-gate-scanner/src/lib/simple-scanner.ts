import { supabase, Ticket } from './supabase';

export interface ScanResult {
  success: boolean;
  ticket: Ticket | null;
  message: string;
  alreadyScanned?: boolean;

  // Detailed rejection info
  rejectionReason?: 'already_used' | 'wrong_event' | 'invalid' | 'expired' | 'tampered' | 'not_found' | 'offline_unknown';
  rejectionDetails?: {
    previousScan?: {
      staff: string;      // Display name or "Unknown Staff"
      gate: string;       // Device ID or "Unknown Gate"
      time: string;       // Formatted time "2:30 PM"
    };
    wrongEventDate?: string;  // "Saturday Feb 1st"
    wrongEventName?: string;  // Event name for context
  };

  // Offline mode fields
  offlineValidated?: boolean;  // True if validated against cache (not server)
  offlineWarning?: string;     // Warning message for unknown tickets in offline mode
}

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// QR code signature verification
const textEncoder = new TextEncoder();

interface QrPayload {
  token: string;
  signature: string;
  meta?: Record<string, unknown> | null;
}

function getSigningSecret(): string | null {
  // Try to get from environment
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_QR_SIGNING_SECRET) {
    return import.meta.env.VITE_QR_SIGNING_SECRET;
  }
  return null;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function verifySignature(token: string, signature: string): Promise<boolean> {
  const secret = getSigningSecret();
  if (!secret) {
    console.warn('[simple-scanner] No QR signing secret configured - skipping signature verification');
    return true; // Allow if no secret configured (dev mode)
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      textEncoder.encode(token)
    );

    const expectedSignature = bufferToBase64(signatureBuffer);

    // Constant-time comparison to prevent timing attacks
    if (expectedSignature.length !== signature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('[simple-scanner] Signature verification error:', error);
    return false;
  }
}

/**
 * Parse QR code input - could be JSON payload or plain ticket ID
 */
async function parseQrInput(input: string): Promise<{ token: string; isVerified: boolean; error?: string }> {
  const trimmed = input.trim();

  // Try to parse as JSON (QR code payload)
  if (trimmed.startsWith('{')) {
    try {
      const payload = JSON.parse(trimmed) as QrPayload;

      if (!payload.token) {
        return { token: '', isVerified: false, error: 'Invalid QR code: missing token' };
      }

      if (!payload.signature) {
        console.warn('[simple-scanner] QR payload missing signature');
        return { token: payload.token, isVerified: false };
      }

      // Verify signature
      const isValid = await verifySignature(payload.token, payload.signature);

      if (!isValid) {
        console.error('[simple-scanner] Invalid QR signature - possible forgery!');
        return { token: '', isVerified: false, error: 'Invalid QR code signature - ticket may be forged' };
      }

      console.log('[simple-scanner] QR signature verified successfully');
      return { token: payload.token, isVerified: true };

    } catch (e) {
      console.error('[simple-scanner] Failed to parse QR JSON:', e);
      return { token: '', isVerified: false, error: 'Invalid QR code format' };
    }
  }

  // Plain text input (manual entry or simple QR)
  return { token: trimmed, isVerified: false };
}

/**
 * Find a ticket by ID, QR code data, or NFC tag
 * Searches multiple columns to find a match
 */
export async function findTicket(input: string): Promise<Ticket | null> {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    console.log('[simple-scanner] findTicket: empty input');
    return null;
  }

  console.log('[simple-scanner] findTicket: searching for', trimmedInput);

  // Build query - search ticket_id and qr_code_data
  // Only include id search if input looks like a UUID
  let query = supabase
    .from('tickets')
    .select('*');

  if (UUID_REGEX.test(trimmedInput)) {
    // Input is a UUID - search id, ticket_id, and qr_code_data
    console.log('[simple-scanner] Input looks like UUID, searching id/ticket_id/qr_code_data');
    query = query.or(`id.eq.${trimmedInput},ticket_id.eq.${trimmedInput},qr_code_data.eq.${trimmedInput}`);
  } else {
    // Input is not a UUID - only search ticket_id and qr_code_data
    console.log('[simple-scanner] Input is not UUID, searching ticket_id/qr_code_data');
    query = query.or(`ticket_id.eq.${trimmedInput},qr_code_data.eq.${trimmedInput}`);
  }

  const { data, error } = await query.limit(1).single();

  if (error) {
    // PGRST116 = no rows found, which is not really an error
    if (error.code === 'PGRST116') {
      console.log('[simple-scanner] No ticket found for input:', trimmedInput);
      return null;
    }
    console.error('[simple-scanner] Error finding ticket:', error);
    return null;
  }

  console.log('[simple-scanner] Found ticket:', data?.ticket_id, data?.guest_name);
  return data as Ticket;
}

/**
 * Find a ticket and filter by event name
 */
export async function findTicketForEvent(input: string, eventName?: string): Promise<Ticket | null> {
  const ticket = await findTicket(input);

  if (!ticket) {
    return null;
  }

  // If event filter is specified, check it matches
  if (eventName && ticket.event_name !== eventName) {
    return null;
  }

  return ticket;
}

/**
 * Mark a ticket as scanned
 * Returns success/failure with appropriate message
 */
export async function scanTicket(
  input: string,
  userId?: string,
  method: 'manual' | 'qr' | 'nfc' = 'manual'
): Promise<ScanResult> {
  // Parse input - handles both QR JSON payloads and plain ticket IDs
  const parsed = await parseQrInput(input);

  if (parsed.error) {
    // Determine if it's a tampered/invalid signature or general invalid
    const isTampered = parsed.error.toLowerCase().includes('forged') ||
                       parsed.error.toLowerCase().includes('signature');
    return {
      success: false,
      ticket: null,
      message: parsed.error,
      rejectionReason: isTampered ? 'tampered' : 'invalid',
    };
  }

  if (!parsed.token) {
    return {
      success: false,
      ticket: null,
      message: 'Invalid input - no ticket ID found',
      rejectionReason: 'invalid',
    };
  }

  console.log('[simple-scanner] Searching for ticket with token:', parsed.token, 'verified:', parsed.isVerified);

  // Find the ticket using the token
  const ticket = await findTicket(parsed.token);

  if (!ticket) {
    return {
      success: false,
      ticket: null,
      message: 'Ticket not found',
      rejectionReason: 'not_found',
    };
  }

  // Check if already scanned - check both is_used and status for robustness
  const isAlreadyScanned = ticket.is_used === true || ticket.status === 'scanned';
  if (isAlreadyScanned) {
    // Format the previous scan time
    const scannedTime = ticket.scanned_at
      ? new Date(ticket.scanned_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      : 'unknown time';

    // Get staff name from scan - will show "Staff" as default
    // In production, could be enhanced with a profiles lookup
    const staffName = 'Staff';

    // Get gate/device info - could use device_id from scanner context
    const gateName = 'Gate';

    return {
      success: false,
      ticket,
      message: `Already scanned at ${scannedTime}`,
      alreadyScanned: true,
      rejectionReason: 'already_used',
      rejectionDetails: {
        previousScan: {
          staff: staffName,
          gate: gateName,
          time: scannedTime,
        },
      },
    };
  }

  // Mark as scanned - update both is_used and status for schema consistency
  const now = new Date().toISOString();
  console.log('[simple-scanner] Marking ticket as scanned:', ticket.id);

  const { data: updateData, error: updateError } = await supabase
    .from('tickets')
    .update({
      is_used: true,
      status: 'scanned',
      scanned_at: now,
    })
    .eq('id', ticket.id)
    .select();

  if (updateError) {
    console.error('[simple-scanner] Error updating ticket:', updateError);
    console.error('[simple-scanner] Error code:', updateError.code);
    console.error('[simple-scanner] Error message:', updateError.message);
    return {
      success: false,
      ticket,
      message: `Failed to mark ticket as scanned: ${updateError.message}`,
    };
  }

  console.log('[simple-scanner] Update result:', updateData);

  // Check if update actually happened (RLS might silently block)
  if (!updateData || updateData.length === 0) {
    console.error('[simple-scanner] Update returned no data - possibly RLS blocked');
    return {
      success: false,
      ticket,
      message: 'Update blocked - check database permissions',
    };
  }

  // Log the scan
  await logScan(ticket.id, 'success', method, userId);

  // Return updated ticket
  return {
    success: true,
    ticket: {
      ...ticket,
      is_used: true,
      status: 'scanned',
      scanned_at: now,
    },
    message: 'Valid ticket - Entry granted',
  };
}

/**
 * Log a scan attempt to the scan_logs table
 */
export async function logScan(
  ticketId: string,
  result: 'success' | 'already_scanned' | 'not_found' | 'error',
  method: 'manual' | 'qr' | 'nfc' = 'manual',
  userId?: string
): Promise<void> {
  const traceId = crypto.randomUUID();

  const { error } = await supabase.from('scan_logs').insert({
    ticket_id: ticketId,
    scanned_by: userId || null,
    scan_result: result,
    trace_id: traceId,
    metadata: {
      timestamp: new Date().toISOString(),
      scan_method: method, // moved to metadata since column doesn't exist
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
  });

  if (error) {
    console.error('Error logging scan:', error);
  }
}

/**
 * Get list of available events for the scanner dropdown
 */
export async function getActiveEvents(): Promise<{ id: string; name: string; event_date: string }[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, event_date')
    .gte('event_date', new Date().toISOString().split('T')[0])
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  return data || [];
}

/**
 * Get unique event names from tickets (fallback if no events table)
 */
export async function getEventNamesFromTickets(): Promise<string[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select('event_name')
    .not('event_name', 'is', null);

  if (error) {
    console.error('Error fetching event names:', error);
    return [];
  }

  // Get unique event names
  const uniqueNames = [...new Set(data?.map(t => t.event_name) || [])];
  return uniqueNames.filter(Boolean) as string[];
}

/**
 * Debug: Get sample tickets from database
 */
export async function debugGetSampleTickets(): Promise<void> {
  const { data, error } = await supabase
    .from('tickets')
    .select('ticket_id, guest_name, event_name, qr_code_data, is_used')
    .limit(5);

  if (error) {
    console.error('[DEBUG] Error fetching sample tickets:', error);
    return;
  }

  console.log('[DEBUG] Sample tickets in database:', data);
  if (data && data.length > 0) {
    console.log('[DEBUG] ===== VALID TICKET IDs TO TEST =====');
    data.forEach((t, i) => {
      console.log(`[DEBUG] ${i + 1}. ticket_id: "${t.ticket_id}" | guest: ${t.guest_name} | used: ${t.is_used}`);
    });
    console.log('[DEBUG] =====================================');
  } else {
    console.log('[DEBUG] No tickets found in database!');
  }
}
