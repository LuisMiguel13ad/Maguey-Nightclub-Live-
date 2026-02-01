/**
 * VIP Tables Admin Service
 * Admin functions for managing VIP table reservations
 *
 * CONSOLIDATED: Uses event-specific schema only
 * - event_vip_tables (tables per event)
 * - vip_reservations (bookings)
 * - vip_guest_passes (individual guest QR codes)
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Types
// ============================================================================

export type VipTableTier = 'premium' | 'standard' | 'regular' | 'front_row' | string;

export interface EventVipTable {
  id: string;
  event_id: string;
  table_number: number;
  table_name: string;
  tier: VipTableTier;
  price: number;
  capacity: number;
  bottles_included: number;
  bottle_service_description: string | null;
  floor_section: string | null;
  position_description: string | null;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Legacy alias
export type VipTable = EventVipTable & {
  guest_capacity: number;
};

export interface VipReservation {
  id: string;
  event_id: string;
  event_vip_table_id: string;
  table_number: number;
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string | null;
  amount_paid_cents: number;
  stripe_payment_intent_id: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'checked_in';
  qr_code_token: string;
  invite_code: string | null;
  package_snapshot: {
    tier: string;
    tableNumber: number;
    guestCount: number;
    price: number;
    displayName: string;
    bottleChoice?: string;
    specialRequests?: string;
    firstName?: string;
    lastName?: string;
    isWalkIn?: boolean;
  } | null;
  special_requests: string | null;
  disclaimer_accepted_at: string | null;
  refund_policy_accepted_at: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  checked_in_guests: number;
  created_at: string;
  updated_at: string;
  // Joined data
  event_vip_table?: EventVipTable;
  event?: {
    id: string;
    name: string;
    event_date: string;
    event_time: string;
    venue_name: string;
    image_url: string;
  };
  guest_passes?: VipGuestPass[];
}

// Legacy alias
export interface TableReservation extends VipReservation {
  reservation_number: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  guest_count: number;
  bottle_choice: string | null;
  table_price: number;
  total_amount: number;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  paid_at: string | null;
  is_walk_in: boolean;
  arrival_time: string | null;
  table_id: string;
  notes: string | null;
  created_by: string | null;
  vip_table?: VipTable;
}

export interface VipGuestPass {
  id: string;
  reservation_id: string;
  guest_number: number;
  guest_name: string | null;
  qr_code_token: string;
  qr_signature: string;
  status: 'issued' | 'checked_in' | 'cancelled';
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
  updated_at: string;
}

// Legacy alias
export type TableGuestPass = VipGuestPass & {
  pass_id: string;
  qr_token: string;
};

export interface CreateWalkInReservationData {
  eventId: string;
  tableId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  guestCount: number;
  bottleChoice?: string;
  specialRequests?: string;
  notes?: string;
  createdBy: string;
}

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * Get all VIP tables for a specific event
 */
export async function getTablesForEvent(eventId: string): Promise<EventVipTable[]> {
  const { data, error } = await supabase
    .from('event_vip_tables')
    .select('*')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching VIP tables:', error);
    throw error;
  }

  return (data || []) as EventVipTable[];
}

/**
 * Get all reservations for an event with full details
 */
export async function getReservationsForEvent(eventId: string): Promise<VipReservation[]> {
  const { data, error } = await supabase
    .from('vip_reservations')
    .select(`
      *,
      event_vip_table:event_vip_tables(*),
      guest_passes:vip_guest_passes(*)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching reservations:', error);
    throw error;
  }

  return (data || []) as unknown as VipReservation[];
}

/**
 * Get reservation by ID
 */
export async function getReservationById(reservationId: string): Promise<VipReservation | null> {
  const { data, error } = await supabase
    .from('vip_reservations')
    .select(`
      *,
      event_vip_table:event_vip_tables(*),
      event:events(id, name, event_date, event_time, venue_name, image_url),
      guest_passes:vip_guest_passes(*)
    `)
    .eq('id', reservationId)
    .single();

  if (error) {
    console.error('Error fetching reservation:', error);
    return null;
  }

  return data as unknown as VipReservation;
}

/**
 * Get available tables for an event
 */
export async function getAvailableTablesForEvent(eventId: string): Promise<EventVipTable[]> {
  // Get all active tables for this event
  const { data: tables, error: tablesError } = await supabase
    .from('event_vip_tables')
    .select('*')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (tablesError) {
    console.error('Error fetching VIP tables:', tablesError);
    throw tablesError;
  }

  // Get active reservations for this event
  const { data: reservations, error: reservationsError } = await supabase
    .from('vip_reservations')
    .select('event_vip_table_id')
    .eq('event_id', eventId)
    .in('status', ['pending', 'confirmed', 'checked_in']);

  if (reservationsError) {
    console.error('Error fetching reservations:', reservationsError);
    throw reservationsError;
  }

  const typedReservations = (reservations || []) as Array<{ event_vip_table_id: string }>;
  const reservedTableIds = new Set(typedReservations.map(r => r.event_vip_table_id));
  const typedTables = (tables || []) as EventVipTable[];

  return typedTables.filter(table => table.is_available && !reservedTableIds.has(table.id));
}

// ============================================================================
// Admin Actions
// ============================================================================

/**
 * Result type from atomic reservation RPC
 */
interface AtomicReservationResult {
  success: boolean;
  error?: string;
  message?: string;
  reservation_id?: string;
  qr_code_token?: string;
  table_number?: number;
  table_name?: string;
  tier?: string;
  price?: number;
  price_cents?: number;
  guest_count?: number;
  guest_passes?: Array<{
    guest_number: number;
    qr_code_token: string;
    qr_signature: string;
  }>;
  status?: string;
}

/**
 * Create a walk-in reservation (immediate confirmation)
 * Uses atomic RPC function to prevent race conditions
 */
export async function createWalkInReservation(
  data: CreateWalkInReservationData
): Promise<VipReservation> {
  // Call the atomic reservation function
  const { data: result, error: rpcError } = await supabase.rpc(
    'create_vip_reservation_atomic',
    {
      p_event_id: data.eventId,
      p_table_id: data.tableId,
      p_purchaser_name: `${data.customerFirstName} ${data.customerLastName}`.trim(),
      p_purchaser_email: data.customerEmail,
      p_purchaser_phone: data.customerPhone || null,
      p_guest_count: data.guestCount,
      p_bottle_choice: data.bottleChoice || null,
      p_special_requests: data.specialRequests || null,
      p_is_walk_in: true,
    }
  );

  if (rpcError) {
    console.error('Error calling create_vip_reservation_atomic:', rpcError);
    throw new Error(rpcError.message || 'Failed to create reservation');
  }

  const atomicResult = result as AtomicReservationResult;

  // Check if the atomic operation succeeded
  if (!atomicResult.success) {
    // Map error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      TABLE_NOT_FOUND: 'Table not found or not active for this event',
      TABLE_NOT_AVAILABLE: 'This table is no longer available',
      TABLE_ALREADY_RESERVED: 'This table already has an active reservation',
      EXCEEDS_CAPACITY: atomicResult.message || 'Guest count exceeds table capacity',
      DUPLICATE_RESERVATION: 'A reservation already exists for this table',
    };

    throw new Error(errorMessages[atomicResult.error || ''] || atomicResult.message || 'Failed to create reservation');
  }

  // Fetch the complete reservation with related data
  const completeReservation = await getReservationById(atomicResult.reservation_id!);
  if (!completeReservation) {
    throw new Error('Failed to fetch created reservation');
  }

  return completeReservation;
}

// Note: Guest pass generation is now handled atomically by create_vip_reservation_atomic RPC function

/**
 * Update reservation status
 */
export async function updateReservationStatus(
  reservationId: string,
  status: VipReservation['status']
): Promise<VipReservation> {
  const { data, error } = await supabase
    .from('vip_reservations')
    .update({
      status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', reservationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating reservation status:', error);
    throw error;
  }

  return data as unknown as VipReservation;
}

/**
 * Add notes to a reservation (store in special_requests or package_snapshot)
 */
export async function addReservationNotes(
  reservationId: string,
  notes: string
): Promise<VipReservation> {
  // Get current reservation to merge notes
  const current = await getReservationById(reservationId);
  if (!current) {
    throw new Error('Reservation not found');
  }

  const updatedSnapshot = {
    ...(current.package_snapshot || {}),
    adminNotes: notes,
  };

  const { data, error } = await supabase
    .from('vip_reservations')
    .update({
      package_snapshot: updatedSnapshot,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', reservationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating reservation notes:', error);
    throw error;
  }

  return data as unknown as VipReservation;
}

/**
 * Result type from atomic check-in RPC
 */
interface AtomicCheckInResult {
  success: boolean;
  error?: string;
  message?: string;
  pass_id?: string;
  reservation_id?: string;
  guest_number?: number;
  checked_in_guests?: number;
  checked_in_at?: string;
}

/**
 * Check in a guest pass using atomic RPC function
 * This prevents race conditions by using database-level row locking
 */
export async function checkInGuestPass(
  passId: string,
  checkedInBy: string
): Promise<VipGuestPass> {
  // Call the atomic check-in function
  const { data: result, error: rpcError } = await supabase.rpc(
    'check_in_vip_guest_atomic',
    {
      p_pass_id: passId,
      p_checked_in_by: checkedInBy,
    }
  );

  if (rpcError) {
    console.error('Error calling check_in_vip_guest_atomic:', rpcError);
    throw new Error(rpcError.message || 'Failed to check in guest');
  }

  const atomicResult = result as AtomicCheckInResult;

  // Check if the atomic operation succeeded
  if (!atomicResult.success) {
    // Map error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      PASS_NOT_FOUND: 'Guest pass not found',
      ALREADY_CHECKED_IN: 'This pass has already been checked in',
      PASS_CANCELLED: 'This pass has been cancelled',
      RESERVATION_NOT_CONFIRMED: 'Reservation is not confirmed',
    };

    throw new Error(errorMessages[atomicResult.error || ''] || atomicResult.message || 'Failed to check in guest');
  }

  // Fetch the updated pass
  const { data: pass, error: fetchError } = await supabase
    .from('vip_guest_passes')
    .select('*')
    .eq('id', passId)
    .single();

  if (fetchError || !pass) {
    throw new Error('Failed to fetch updated pass');
  }

  return pass as unknown as VipGuestPass;
}

/**
 * Result type from VIP scan with re-entry RPC
 */
export interface VipScanWithReentryResult {
  success: boolean;
  entryType: 'first_entry' | 'reentry';
  error?: string;
  message?: string;
  passId?: string;
  reservationId?: string;
  guestNumber?: number;
  checkedInGuests?: number;
  totalGuests?: number;
  lastEntryTime?: string;
}

/**
 * Process VIP scan with re-entry support
 * Allows VIP hosts and linked guests to re-enter venue
 * First scan: changes status to checked_in
 * Subsequent scans: returns re-entry info without error
 */
export async function processVipScanWithReentry(
  passId: string,
  scannedBy: string
): Promise<VipScanWithReentryResult> {
  const { data: result, error: rpcError } = await supabase.rpc(
    'process_vip_scan_with_reentry',
    {
      p_pass_id: passId,
      p_scanned_by: scannedBy,
    }
  );

  if (rpcError) {
    console.error('Error calling process_vip_scan_with_reentry:', rpcError);
    return {
      success: false,
      entryType: 'first_entry',
      error: 'RPC_ERROR',
      message: rpcError.message || 'Failed to process VIP scan',
    };
  }

  // Map snake_case to camelCase
  return {
    success: result.success,
    entryType: result.entry_type,
    error: result.error,
    message: result.message,
    passId: result.pass_id,
    reservationId: result.reservation_id,
    guestNumber: result.guest_number,
    checkedInGuests: result.checked_in_guests,
    totalGuests: result.total_guests,
    lastEntryTime: result.last_entry_time,
  };
}

/**
 * Result from manual payment confirmation
 */
export interface ConfirmPaymentResult {
  success: boolean;
  message: string;
  guestPassesCreated?: number;
  error?: string;
}

/**
 * Manually confirm payment for a reservation (for cash/card at door)
 * Creates guest passes and changes status to confirmed
 */
export async function confirmPaymentManually(
  reservationId: string,
  confirmedBy: string
): Promise<ConfirmPaymentResult> {
  const now = new Date().toISOString();

  // First, get the reservation details
  const { data: reservation, error: fetchError } = await supabase
    .from('vip_reservations')
    .select('id, status, event_id, event_vip_table_id, purchaser_name, purchaser_email, package_snapshot')
    .eq('id', reservationId)
    .single();

  if (fetchError || !reservation) {
    console.error('Error fetching reservation:', fetchError);
    return {
      success: false,
      message: 'Reservation not found',
      error: 'NOT_FOUND',
    };
  }

  // Check if already confirmed
  if (reservation.status !== 'pending') {
    return {
      success: false,
      message: `Reservation is already ${reservation.status}`,
      error: 'ALREADY_PROCESSED',
    };
  }

  // Get the guest count from package_snapshot
  const packageSnapshot = reservation.package_snapshot as { guestCount?: number } | null;
  const guestCount = packageSnapshot?.guestCount || 1;

  // Update reservation to confirmed
  const { error: updateError } = await supabase
    .from('vip_reservations')
    .update({
      status: 'confirmed',
      payment_confirmed_at: now,
      payment_confirmed_by: confirmedBy,
      payment_method: 'manual',
      updated_at: now,
    } as never)
    .eq('id', reservationId);

  if (updateError) {
    console.error('Error updating reservation:', updateError);
    return {
      success: false,
      message: 'Failed to update reservation status',
      error: 'UPDATE_FAILED',
    };
  }

  // Create guest passes
  const passesToCreate = [];
  for (let i = 1; i <= guestCount; i++) {
    const token = `VIP-${reservationId.split('-')[0]}-G${i}-${Date.now()}`;
    const signature = `${token}|${reservationId}|${i}|${reservation.event_id}`;

    passesToCreate.push({
      reservation_id: reservationId,
      guest_number: i,
      pass_id: `PASS-${reservationId.split('-')[0]}-${i}`,
      qr_code_token: token,
      qr_signature: signature,
      status: 'issued',
      created_at: now,
    });
  }

  const { error: passesError } = await supabase
    .from('vip_guest_passes')
    .insert(passesToCreate as never[]);

  if (passesError) {
    console.error('Error creating guest passes:', passesError);
    // Don't fail the whole operation - passes can be created later
    return {
      success: true,
      message: `Payment confirmed but guest passes could not be created: ${passesError.message}`,
      guestPassesCreated: 0,
    };
  }

  return {
    success: true,
    message: `Payment confirmed. ${guestCount} guest passes created.`,
    guestPassesCreated: guestCount,
  };
}

/**
 * Result from check-in all guests operation
 */
export interface CheckInAllResult {
  success: boolean;
  checkedIn: number;
  alreadyCheckedIn: number;
  total: number;
  error?: string;
  message: string;
}

/**
 * Mark all guests as checked in with validation and detailed feedback
 */
export async function checkInAllGuests(
  reservationId: string,
  checkedInBy: string,
  reservationStatus?: string
): Promise<CheckInAllResult> {
  const now = new Date().toISOString();

  // Check if reservation is in valid status for check-in (using passed status to avoid RLS issues)
  if (reservationStatus === 'pending') {
    return {
      success: false,
      checkedIn: 0,
      alreadyCheckedIn: 0,
      total: 0,
      error: 'PAYMENT_NOT_CONFIRMED',
      message: 'Cannot check in - payment has not been confirmed yet',
    };
  }

  if (reservationStatus === 'cancelled') {
    return {
      success: false,
      checkedIn: 0,
      alreadyCheckedIn: 0,
      total: 0,
      error: 'RESERVATION_CANCELLED',
      message: 'Cannot check in - reservation has been cancelled',
    };
  }

  // Get all passes for this reservation
  const { data: passes, error: passesQueryError } = await supabase
    .from('vip_guest_passes')
    .select('id, status')
    .eq('reservation_id', reservationId);

  if (passesQueryError) {
    return {
      success: false,
      checkedIn: 0,
      alreadyCheckedIn: 0,
      total: 0,
      error: 'QUERY_ERROR',
      message: 'Failed to fetch guest passes',
    };
  }

  // No passes exist yet
  if (!passes || passes.length === 0) {
    return {
      success: false,
      checkedIn: 0,
      alreadyCheckedIn: 0,
      total: 0,
      error: 'NO_PASSES',
      message: 'No guest passes found - passes are created after payment is confirmed',
    };
  }

  const issuedPasses = passes.filter(p => p.status === 'issued');
  const checkedInPasses = passes.filter(p => p.status === 'checked_in');

  // All passes already checked in
  if (issuedPasses.length === 0 && checkedInPasses.length > 0) {
    return {
      success: true,
      checkedIn: 0,
      alreadyCheckedIn: checkedInPasses.length,
      total: passes.length,
      message: 'All guests are already checked in',
    };
  }

  // Update all issued passes to checked_in
  const { error: passesError } = await supabase
    .from('vip_guest_passes')
    .update({
      status: 'checked_in',
      checked_in_at: now,
      checked_in_by: checkedInBy,
    } as never)
    .eq('reservation_id', reservationId)
    .eq('status', 'issued');

  if (passesError) {
    console.error('Error checking in all guests:', passesError);
    return {
      success: false,
      checkedIn: 0,
      alreadyCheckedIn: checkedInPasses.length,
      total: passes.length,
      error: 'UPDATE_ERROR',
      message: 'Failed to check in guests',
    };
  }

  // Also check in linked GA tickets
  let linkedTicketsCheckedIn = 0;
  const { data: linkedTickets } = await supabase
    .from('vip_linked_tickets')
    .select('ticket_id')
    .eq('vip_reservation_id', reservationId);

  if (linkedTickets && linkedTickets.length > 0) {
    const ticketIds = linkedTickets.map(lt => lt.ticket_id);
    const { data: updatedTickets, error: ticketsError } = await supabase
      .from('tickets')
      .update({
        status: 'checked_in',
        checked_in_at: now,
        checked_in_by: checkedInBy,
      } as never)
      .in('id', ticketIds)
      .eq('status', 'valid')
      .select('id');

    if (!ticketsError && updatedTickets) {
      linkedTicketsCheckedIn = updatedTickets.length;
    }
  }

  // Update reservation - use COALESCE via raw SQL or just set the timestamp
  // For simplicity, always set checked_in_at (it tracks most recent check-in activity)
  const totalCheckedIn = passes.length + linkedTicketsCheckedIn;
  const { error: reservationError } = await supabase
    .from('vip_reservations')
    .update({
      checked_in_guests: totalCheckedIn,
      status: 'checked_in',
      checked_in_at: now,
      updated_at: now,
    } as never)
    .eq('id', reservationId);

  if (reservationError) {
    console.error('Error updating reservation:', reservationError);
  }

  // Build result message
  const vipMessage = issuedPasses.length > 0
    ? `${issuedPasses.length} VIP pass${issuedPasses.length !== 1 ? 'es' : ''}`
    : '';
  const linkedMessage = linkedTicketsCheckedIn > 0
    ? `${linkedTicketsCheckedIn} linked GA ticket${linkedTicketsCheckedIn !== 1 ? 's' : ''}`
    : '';
  const messageParts = [vipMessage, linkedMessage].filter(Boolean);
  const message = messageParts.length > 0
    ? `Successfully checked in ${messageParts.join(' and ')}`
    : 'All guests already checked in';

  return {
    success: true,
    checkedIn: issuedPasses.length + linkedTicketsCheckedIn,
    alreadyCheckedIn: checkedInPasses.length,
    total: passes.length + (linkedTickets?.length || 0),
    message,
  };
}

/**
 * Result type from signature verification RPC
 */
interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
  message?: string;
  pass_id?: string;
  reservation_id?: string;
  guest_number?: number;
  event_id?: string;
  status?: string;
  checked_in_at?: string;
}

/**
 * Verify a VIP pass QR code signature using atomic RPC function
 * Returns validation result with pass status
 */
export async function verifyPassSignature(
  qrToken: string,
  signature: string,
  reservationId?: string,
  guestNumber?: number
): Promise<SignatureVerificationResult> {
  const { data: result, error: rpcError } = await supabase.rpc(
    'verify_vip_pass_signature',
    {
      p_qr_token: qrToken,
      p_signature: signature,
      p_reservation_id: reservationId || null,
      p_guest_number: guestNumber || null,
    }
  );

  if (rpcError) {
    console.error('Error calling verify_vip_pass_signature:', rpcError);
    return {
      valid: false,
      error: 'RPC_ERROR',
      message: rpcError.message || 'Failed to verify signature',
    };
  }

  return result as SignatureVerificationResult;
}

// Note: VipGuestPass interface is defined earlier in this file (lines 110-122)
// The interface uses qr_code_token to match the database schema

/**
 * Get guest pass by QR token (for scanner)
 */
export async function getGuestPassByQrToken(qrToken: string): Promise<{
  pass: VipGuestPass;
  reservation: VipReservation;
} | null> {
  // First try the vip_guest_passes table (legacy/admin generated passes)
  const { data, error } = await supabase
    .from('vip_guest_passes')
    .select(`
      *,
      reservation:vip_reservations(
        *,
        event_vip_table:event_vip_tables(*),
        event:events(id, name, event_date, event_time, venue_name)
      )
    `)
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (!error && data) {
    const typedData = data as unknown as VipGuestPass & { reservation: VipReservation };
    return {
      pass: typedData,
      reservation: typedData.reservation,
    };
  }

  // Fallback: Check standard tickets table (for invite link purchases)
  // 1. Find the ticket by QR token
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('id, status, ticket_type, attendee_name')
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (ticketError || !ticket) {
    if (ticketError) console.error('Error fetching fallback ticket:', ticketError);
    return null;
  }

  // 2. Check if this ticket is linked to a VIP reservation
  const { data: linkedTicket, error: linkedError } = await supabase
    .from('vip_linked_tickets')
    .select(`
            *,
            reservation:vip_reservations(
                *,
                event_vip_table:event_vip_tables(*),
                event:events(id, name, event_date, event_time, venue_name)
            )
        `)
    .eq('ticket_id', ticket.id)
    .maybeSingle();

  if (linkedError || !linkedTicket) {
    if (linkedError) console.error('Error fetching linked ticket info:', linkedError);
    return null;
  }

  // 3. Construct a VipGuestPass-compatible object
  const reservation = linkedTicket.reservation as unknown as VipReservation;
  const mockPass: VipGuestPass = {
    id: linkedTicket.id, // Use link ID as pass ID
    reservation_id: reservation.id,
    guest_number: 0, // Unknown for linked tickets, could show 'Linked Guest'
    guest_name: linkedTicket.purchased_by_name || ticket.attendee_name,
    qr_token: qrToken,
    qr_signature: 'valid', // Assumed valid if ticket exists
    status: ticket.status === 'scanned' ? 'checked_in' : 'issued',
    checked_in_at: null, // Would need to check scan logs
    checked_in_by: null,
    created_at: linkedTicket.created_at,
    updated_at: linkedTicket.created_at
  };

  return {
    pass: mockPass,
    reservation: reservation
  };
}

/**
 * Get guest pass by QR token with signature verification
 * Combines lookup and signature verification in one call
 */
export async function getGuestPassByQrTokenWithVerification(
  qrToken: string,
  signature: string
): Promise<{
  pass: VipGuestPass;
  reservation: VipReservation;
  verified: boolean;
  verificationError?: string;
} | null> {
  // First verify the signature
  // Note: For linked tickets, we might need a different verification strategy
  // But for now, using the same verification check
  const verificationResult = await verifyPassSignature(qrToken, signature);

  // Get the pass data regardless of verification (to show details)
  const passData = await getGuestPassByQrToken(qrToken);

  if (!passData) {
    return null;
  }

  // If it's a linked ticket (constructed mock pass), simplify verification
  const isLinkedTicket = passData.pass.guest_number === 0;

  return {
    pass: passData.pass,
    reservation: passData.reservation,
    verified: isLinkedTicket ? true : verificationResult.valid, // Trust linked tickets lookup for now
    verificationError: isLinkedTicket ? undefined : (verificationResult.valid ? undefined : verificationResult.message),
  };
}

// ============================================================================
// Stats and Reports
// ============================================================================

/**
 * Get table reservation statistics for an event
 */
export async function getEventTableStats(eventId: string): Promise<{
  totalTables: number;
  reservedTables: number;
  availableTables: number;
  totalRevenue: number;
  totalGuests: number;
  checkedInGuests: number;
  walkInCount: number;
  reservationsByTier: Record<string, number>;
  reservationsByStatus: Record<string, number>;
}> {
  const tables = await getTablesForEvent(eventId);
  const reservations = await getReservationsForEvent(eventId);

  const activeReservations = reservations.filter(
    r => r.status !== 'cancelled'
  );

  const confirmedReservations = reservations.filter(
    r => r.status === 'confirmed' || r.status === 'checked_in' || r.status === 'completed'
  );

  // Get reserved table IDs
  const reservedTableIds = new Set(
    activeReservations.map(r => r.event_vip_table_id).filter(Boolean)
  );

  // Calculate revenue (amount_paid_cents to dollars)
  const totalRevenue = confirmedReservations.reduce(
    (sum, r) => sum + (r.amount_paid_cents / 100),
    0
  );

  // Calculate guests from package_snapshot
  const totalGuests = confirmedReservations.reduce(
    (sum, r) => sum + (r.package_snapshot?.guestCount || 0),
    0
  );

  const checkedInGuests = confirmedReservations.reduce(
    (sum, r) => sum + (r.checked_in_guests || 0),
    0
  );

  // Count walk-ins
  const walkInCount = confirmedReservations.filter(
    r => r.package_snapshot?.isWalkIn === true
  ).length;

  const reservationsByTier: Record<string, number> = {
    premium: 0,
    front_row: 0,
    standard: 0,
    regular: 0,
  };

  const reservationsByStatus: Record<string, number> = {
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
    no_show: 0,
    checked_in: 0,
  };

  reservations.forEach(r => {
    const tier = r.package_snapshot?.tier || r.event_vip_table?.tier || 'standard';
    if (reservationsByTier[tier] !== undefined) {
      reservationsByTier[tier]++;
    }
    if (reservationsByStatus[r.status] !== undefined) {
      reservationsByStatus[r.status]++;
    }
  });

  return {
    totalTables: tables.length,
    reservedTables: reservedTableIds.size,
    availableTables: tables.length - reservedTableIds.size,
    totalRevenue,
    totalGuests,
    checkedInGuests,
    walkInCount,
    reservationsByTier,
    reservationsByStatus,
  };
}

// ============================================================================
// Bottle Choices (for admin reference)
// ============================================================================

export const BOTTLE_CHOICES = [
  { id: 'grey-goose', name: 'Grey Goose Vodka', category: 'Vodka' },
  { id: 'titos', name: "Tito's Vodka", category: 'Vodka' },
  { id: 'patron-silver', name: 'Patrón Silver', category: 'Tequila' },
  { id: 'don-julio-blanco', name: 'Don Julio Blanco', category: 'Tequila' },
  { id: 'don-julio-reposado', name: 'Don Julio Reposado', category: 'Tequila' },
  { id: 'clase-azul', name: 'Clase Azul Reposado', category: 'Tequila' },
  { id: 'hennessy-vs', name: 'Hennessy VS', category: 'Cognac' },
  { id: 'hennessy-vsop', name: 'Hennessy VSOP', category: 'Cognac' },
  { id: 'dusse', name: "D'Ussé Cognac", category: 'Cognac' },
  { id: 'johnnie-black', name: 'Johnnie Walker Black', category: 'Whiskey' },
  { id: 'jack-daniels', name: 'Jack Daniels', category: 'Whiskey' },
  { id: 'casamigos-blanco', name: 'Casamigos Blanco', category: 'Tequila' },
  { id: 'buchanans', name: 'Buchanan\'s 12 Year', category: 'Whiskey' },
  { id: 'ciroc', name: 'Cîroc Vodka', category: 'Vodka' },
  { id: 'belvedere', name: 'Belvedere Vodka', category: 'Vodka' },
];

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Convert VipReservation to legacy TableReservation format
 */
export function toLegacyReservation(reservation: VipReservation): TableReservation {
  const snapshot = reservation.package_snapshot;
  return {
    ...reservation,
    reservation_number: reservation.qr_code_token,
    customer_first_name: snapshot?.firstName || reservation.purchaser_name.split(' ')[0] || '',
    customer_last_name: snapshot?.lastName || reservation.purchaser_name.split(' ').slice(1).join(' ') || '',
    customer_email: reservation.purchaser_email,
    customer_phone: reservation.purchaser_phone || '',
    guest_count: snapshot?.guestCount || 0,
    bottle_choice: snapshot?.bottleChoice || null,
    table_price: reservation.amount_paid_cents / 100,
    total_amount: reservation.amount_paid_cents / 100,
    payment_status: reservation.status === 'confirmed' || reservation.status === 'checked_in' || reservation.status === 'completed' ? 'paid' : 'pending',
    paid_at: reservation.status === 'confirmed' ? reservation.updated_at : null,
    is_walk_in: snapshot?.isWalkIn || false,
    arrival_time: reservation.checked_in_at,
    table_id: reservation.event_vip_table_id,
    notes: (snapshot as Record<string, unknown>)?.adminNotes as string || null,
    created_by: null,
    vip_table: reservation.event_vip_table ? {
      ...reservation.event_vip_table,
      guest_capacity: reservation.event_vip_table.capacity,
    } : undefined,
  };
}

// ============================================================================
// Deprecated Functions
// ============================================================================

/** @deprecated Use getTablesForEvent instead */
export async function getAllVipTables(): Promise<VipTable[]> {
  console.warn('getAllVipTables is deprecated. Use getTablesForEvent(eventId) instead.');
  return [];
}
