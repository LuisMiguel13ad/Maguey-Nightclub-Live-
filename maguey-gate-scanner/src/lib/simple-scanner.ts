import { supabase as defaultClient, Ticket } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { validateOffline, markAsScannedOffline, CachedTicket } from './offline-ticket-cache';

export interface ScanResult {
  success: boolean;
  ticket: Ticket | null;
  message: string;
  alreadyScanned?: boolean;

  // Detailed rejection info
  rejectionReason?: 'already_used' | 'wrong_event' | 'invalid' | 'expired' | 'tampered' | 'not_found' | 'offline_unknown' | 'reentry';
  rejectionDetails?: {
    previousScan?: {
      staff: string;      // Display name or "Unknown Staff"
      gate: string;       // Device ID or "Unknown Gate"
      time: string;       // Formatted time "2:30 PM"
    };
    wrongEventDate?: string;  // "Saturday Feb 1st"
    wrongEventName?: string;  // Event name for context
  };

  // VIP-linked ticket info (for re-entry and display)
  vipInfo?: {
    tableName: string;
    tableNumber: string;
    reservationId: string;
  };

  // Offline mode fields
  offlineValidated?: boolean;  // True if validated against cache (not server)
  offlineWarning?: string;     // Warning message for unknown tickets in offline mode
}

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// VIP link check result interface
interface VipLinkCheckResult {
  is_vip_linked: boolean;
  allow_reentry?: boolean;
  vip_reservation_id?: string;
  table_number?: string;
  table_name?: string;
  reservation_status?: string;
  error?: string;
}

// QR code signature verification
interface QrPayload {
  token: string;
  signature: string;
  meta?: Record<string, unknown> | null;
}

function getSupabaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) {
    return import.meta.env.VITE_SUPABASE_URL;
  }
  return '';
}

function getSupabaseAnonKey(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) {
    return import.meta.env.VITE_SUPABASE_ANON_KEY;
  }
  return '';
}

/**
 * Verify QR signature by calling server-side Edge Function
 * Never exposes HMAC secret to client
 */
async function verifySignature(token: string, signature: string): Promise<boolean> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[simple-scanner] Supabase not configured - cannot verify signature');
    return false; // Fail closed
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/verify-qr-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ token, signature }),
    });

    if (!response.ok) {
      console.error('[simple-scanner] Signature verification request failed:', response.status);
      return false; // Fail closed
    }

    const result = await response.json();
    return result.valid === true;
  } catch (error) {
    console.error('[simple-scanner] Signature verification error:', error);
    return false; // Fail closed - network error means reject
  }
}

/**
 * Parse QR code input - could be JSON payload or plain ticket ID
 */
async function parseQrInput(input: string): Promise<{ token: string; isVerified: boolean; signature?: string; error?: string }> {
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
        return { token: payload.token, isVerified: false, signature: payload.signature };
      }

      // Verify signature
      const isValid = await verifySignature(payload.token, payload.signature);

      if (!isValid) {
        console.error('[simple-scanner] Invalid QR signature - possible forgery!');
        return { token: '', isVerified: false, error: 'Invalid QR code signature - ticket may be forged' };
      }

      console.log('[simple-scanner] QR signature verified successfully');
      return { token: payload.token, isVerified: true, signature: payload.signature };

    } catch (e) {
      console.error('[simple-scanner] Failed to parse QR JSON:', e);
      return { token: '', isVerified: false, error: 'Invalid QR code format' };
    }
  }

  // Plain text input (manual entry or simple QR)
  return { token: trimmed, isVerified: false };
}

/**
 * Check if a GA ticket is linked to a VIP reservation (for re-entry privilege)
 */
async function checkVipLinkedTicket(ticketId: string, client: SupabaseClient = defaultClient): Promise<VipLinkCheckResult> {
  try {
    const { data, error } = await client.rpc('check_vip_linked_ticket_reentry', {
      p_ticket_id: ticketId
    });

    if (error) {
      console.error('[simple-scanner] Error checking VIP link:', error);
      return { is_vip_linked: false };
    }

    return data as VipLinkCheckResult;
  } catch (error) {
    console.error('[simple-scanner] Exception checking VIP link:', error);
    return { is_vip_linked: false };
  }
}

/**
 * Find a ticket by ID, QR code data, or NFC tag
 * Searches multiple columns to find a match
 */
export async function findTicket(input: string, client: SupabaseClient = defaultClient): Promise<Ticket | null> {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    console.log('[simple-scanner] findTicket: empty input');
    return null;
  }

  console.log('[simple-scanner] findTicket: searching for', trimmedInput);

  // Build query - search ticket_id and qr_code_data
  // Only include id search if input looks like a UUID
  let query = client
    .from('tickets')
    .select('*');

  if (UUID_REGEX.test(trimmedInput)) {
    // Input is a UUID - search id, ticket_id, qr_code_data AND qr_token

    // Diagnostic: Check Auth State
    // const { data: { user } } = await client.auth.getUser();
    // console.log('[simple-scanner] Current User:', user?.id || 'ANON');

    // Optimization & Workaround: Check qr_token directly first
    // This avoids potential issues with complex OR queries in some environments
    const { data: directMatch } = await client
      .from('tickets')
      .select('id')
      .eq('qr_token', trimmedInput)
      .maybeSingle();

    if (directMatch) {
      console.log('[simple-scanner] Direct match found by qr_token:', directMatch.id);
      // Found it! Use ID for the main query to fetch full details
      query = client.from('tickets').select('*').eq('id', directMatch.id);
    } else {
      console.log('[simple-scanner] No direct qr_token match, using OR query');
      query = query.or(`id.eq.${trimmedInput},ticket_id.eq.${trimmedInput},qr_code_data.eq.${trimmedInput},qr_token.eq.${trimmedInput}`);
    }
  } else {
    // Input is not a UUID - only search ticket_id and qr_code_data
    console.log('[simple-scanner] Input is not UUID, searching ticket_id/qr_code_data');
    query = query.or(`ticket_id.eq.${trimmedInput},qr_code_data.eq.${trimmedInput}`);
  }

  const { data, error } = await query.maybeSingle();
  console.log('[DEBUG-FIX-APPLIED v4] Query Result:', { data, error });

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
export async function findTicketForEvent(input: string, eventName?: string, client: SupabaseClient = defaultClient): Promise<Ticket | null> {
  const ticket = await findTicket(input, client);

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
  method: 'manual' | 'qr' | 'nfc' = 'manual',
  client: SupabaseClient = defaultClient
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
  const ticket = await findTicket(parsed.token, client);

  if (!ticket) {
    return {
      success: false,
      ticket: null,
      message: 'Ticket not found',
      rejectionReason: 'not_found',
    };
  }

  // Check if ticket is linked to VIP reservation (for re-entry privilege)
  const vipLinkCheck = await checkVipLinkedTicket(ticket.id, client);
  const isVipLinked = vipLinkCheck.is_vip_linked && vipLinkCheck.allow_reentry;

  // Check if already scanned - check both is_used and status for robustness
  const isAlreadyScanned = ticket.is_used === true || ticket.status === 'scanned';
  if (isAlreadyScanned) {
    // If VIP-linked, allow re-entry
    if (isVipLinked) {
      console.log('[simple-scanner] VIP-linked ticket re-entry granted');

      // Format the previous scan time
      const scannedTime = ticket.scanned_at
        ? new Date(ticket.scanned_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
        : 'unknown time';

      return {
        success: true,
        ticket,
        message: `Re-entry granted - Last entry at ${scannedTime}`,
        rejectionReason: 'reentry',
        vipInfo: {
          tableName: vipLinkCheck.table_name || `Table ${vipLinkCheck.table_number}`,
          tableNumber: vipLinkCheck.table_number || '',
          reservationId: vipLinkCheck.vip_reservation_id || '',
        },
      };
    }

    // Regular GA ticket - reject re-entry
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

  const { data: updateData, error: updateError } = await client
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

  // If VIP-linked, increment the reservation's checked_in_guests count
  if (isVipLinked && vipLinkCheck.vip_reservation_id) {
    console.log('[simple-scanner] Incrementing VIP reservation checked-in count');
    try {
      const { error: incrementError } = await client.rpc('increment_vip_checked_in', {
        p_reservation_id: vipLinkCheck.vip_reservation_id
      });

      if (incrementError) {
        console.error('[simple-scanner] Error incrementing VIP check-in count:', incrementError);
        // Don't fail the scan - ticket already marked as scanned
      }
    } catch (error) {
      console.error('[simple-scanner] Exception incrementing VIP check-in count:', error);
      // Don't fail the scan - ticket already marked as scanned
    }
  }

  // Log the scan
  await logScan(ticket.id, 'success', method, userId, client); // Pass client

  // Build result with VIP info if applicable
  const result: ScanResult = {
    success: true,
    ticket: {
      ...ticket,
      is_used: true,
      status: 'scanned',
      scanned_at: now,
    },
    message: 'Valid ticket - Entry granted',
  };

  if (isVipLinked) {
    result.vipInfo = {
      tableName: vipLinkCheck.table_name || `Table ${vipLinkCheck.table_number}`,
      tableNumber: vipLinkCheck.table_number || '',
      reservationId: vipLinkCheck.vip_reservation_id || '',
    };
  }

  return result;
}

/**
 * Log a scan attempt to the scan_logs table
 */
export async function logScan(
  ticketId: string,
  result: 'success' | 'already_scanned' | 'not_found' | 'error',
  method: 'manual' | 'qr' | 'nfc' = 'manual',
  userId?: string,
  client: SupabaseClient = defaultClient
): Promise<void> {
  const traceId = crypto.randomUUID();

  const { error } = await client.from('scan_logs').insert({
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
export async function getActiveEvents(client: SupabaseClient = defaultClient): Promise<{ id: string; name: string; event_date: string }[]> {
  const { data, error } = await client
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
export async function getEventNamesFromTickets(client: SupabaseClient = defaultClient): Promise<string[]> {
  const { data, error } = await client
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
 * Get unique events from tickets with both name and ID
 * Returns array of {id, name} for scanner dropdown
 */
export async function getEventsFromTickets(client: SupabaseClient = defaultClient): Promise<{ id: string; name: string }[]> {
  const { data, error } = await client
    .from('tickets')
    .select('event_id, event_name')
    .not('event_name', 'is', null)
    .not('event_id', 'is', null);

  if (error) {
    console.error('Error fetching events from tickets:', error);
    return [];
  }

  // Get unique events by ID
  const eventMap = new Map<string, string>();
  data?.forEach(t => {
    if (t.event_id && t.event_name && !eventMap.has(t.event_id)) {
      eventMap.set(t.event_id, t.event_name);
    }
  });

  return Array.from(eventMap.entries()).map(([id, name]) => ({ id, name }));
}

/**
 * Debug: Get sample tickets from database
 */
export async function debugGetSampleTickets(client: SupabaseClient = defaultClient): Promise<void> {
  const { data, error } = await client
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

// ============================================================================
// Offline Scanning
// ============================================================================

/**
 * Scan a ticket while offline - validates against local cache
 * Per context decision: Accept unknown tickets with warning, first-scan-wins for conflicts
 */
export async function scanTicketOffline(
  input: string,
  userId?: string,
  eventId?: string
): Promise<ScanResult> {
  // Parse input for QR signature verification
  const parsed = await parseQrInput(input);

  if (parsed.error) {
    const isTampered = parsed.error.toLowerCase().includes('forged') ||
      parsed.error.toLowerCase().includes('signature');
    return {
      success: false,
      ticket: null,
      message: parsed.error,
      rejectionReason: isTampered ? 'tampered' : 'invalid',
      offlineValidated: true,
    };
  }

  if (!parsed.token) {
    return {
      success: false,
      ticket: null,
      message: 'Invalid input - no ticket ID found',
      rejectionReason: 'invalid',
      offlineValidated: true,
    };
  }

  console.log('[simple-scanner] Offline scan for token:', parsed.token);

  // Validate against offline cache
  const cacheResult = await validateOffline(parsed.token, eventId);

  if (cacheResult.status === 'not_in_cache') {
    // Per context decision: Accept unknown tickets with warning
    // They'll be verified when sync happens
    console.log('[simple-scanner] Offline: Ticket not in cache, accepting with warning');

    return {
      success: true,
      ticket: null, // No ticket data available offline
      message: 'Accepted (verify when online)',
      offlineValidated: true,
      offlineWarning: 'Ticket not in local cache. Will verify when connection restored.',
    };
  }

  if (cacheResult.status === 'wrong_event') {
    return {
      success: false,
      ticket: cacheResult.ticket ? convertCachedToTicket(cacheResult.ticket) : null,
      message: 'This ticket is for a different event',
      rejectionReason: 'wrong_event',
      offlineValidated: true,
    };
  }

  if (cacheResult.status === 'scanned') {
    // Already scanned - show cached scan info
    const cachedTicket = cacheResult.ticket!;
    const scannedTime = cachedTicket.scannedAt
      ? new Date(cachedTicket.scannedAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      : 'earlier';

    return {
      success: false,
      ticket: convertCachedToTicket(cachedTicket),
      message: `Already scanned at ${scannedTime}`,
      alreadyScanned: true,
      rejectionReason: 'already_used',
      rejectionDetails: {
        previousScan: {
          staff: cachedTicket.scannedByName || 'Staff',
          gate: 'This device',
          time: scannedTime,
        },
      },
      offlineValidated: true,
    };
  }

  // Valid ticket - mark as scanned in cache
  const cachedTicket = cacheResult.ticket!;
  await markAsScannedOffline(cachedTicket.ticketId, userId);

  return {
    success: true,
    ticket: convertCachedToTicket(cachedTicket),
    message: 'Valid ticket - Entry granted (offline)',
    offlineValidated: true,
  };
}

/**
 * Convert CachedTicket to Ticket interface for consistency
 */
function convertCachedToTicket(cached: CachedTicket): Ticket {
  return {
    id: cached.ticketId,
    ticket_id: cached.ticketId,
    guest_name: cached.guestName || null,
    ticket_type: cached.ticketType,
    event_name: null, // Not stored in cache
    event_id: cached.eventId,
    is_used: cached.status === 'scanned',
    status: cached.status,
    scanned_at: cached.scannedAt || null,
    // Other fields from Ticket interface set to null/defaults
    qr_code_data: cached.qrToken,
    price: null,
    purchase_date: null,
    created_at: null,
    updated_at: null,
  } as Ticket;
}
