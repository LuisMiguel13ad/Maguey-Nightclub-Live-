/**
 * VIP Tables Service
 * Handles VIP table reservations, availability, and guest passes
 *
 * CONSOLIDATED: Uses event-specific schema only
 * - event_vip_tables (tables per event)
 * - vip_reservations (bookings)
 * - vip_guest_passes (individual guest QR codes)
 */

import { supabase } from './supabase';
import type { EventVipTable as DbEventVipTable, VipReservation as DbVipReservation, VipGuestPass as DbVipGuestPass } from './supabase';
import { generateSecureQrPayload, generateQrImage } from './ticket-generator';
import { useEffect, useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type VipTableTier = 'premium' | 'standard' | 'regular' | 'front_row' | string;

export interface EventVipTable extends DbEventVipTable {
  // Extended fields for compatibility
}

export interface EventVipTableWithAvailability extends EventVipTable {
  has_active_reservation: boolean;
  guest_capacity: number; // Alias for capacity
}

// Legacy alias for compatibility
export type VipTable = EventVipTable;
export type VipTableWithAvailability = EventVipTableWithAvailability;

export interface VipReservation extends Omit<DbVipReservation, 'package_snapshot'> {
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
  } | null;
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
  // Map old field names for backward compatibility
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
  vip_table?: EventVipTable;
}

export interface VipGuestPass extends DbVipGuestPass {
  // Generated data
  qr_code_url?: string;
}

// Legacy alias
export interface TableGuestPass extends VipGuestPass {
  pass_id: string;
  qr_token: string;
}

export interface CreateReservationData {
  eventId: string;
  tableId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  guestCount: number;
  bottleChoice?: string;
  specialRequests?: string;
  isWalkIn?: boolean;
  createdBy?: string;
  notes?: string;
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
    .order('table_number', { ascending: true });

  if (error) {
    console.error('Error fetching VIP tables:', error);
    throw error;
  }

  return (data || []) as EventVipTable[];
}

/**
 * Get all tables for a specific event with availability status
 */
export async function getAvailableTablesForEvent(eventId: string): Promise<VipTableWithAvailability[]> {
  // Get all VIP tables for this event (removed is_active filter for compatibility with Owner Suite)
  const { data: tables, error: tablesError } = await supabase
    .from('event_vip_tables')
    .select('*')
    .eq('event_id', eventId)
    .order('table_number', { ascending: true });

  if (tablesError) {
    console.error('Error fetching VIP tables:', tablesError);
    throw tablesError;
  }

  // Get active reservations for this event
  const { data: reservations, error: reservationsError } = await supabase
    .from('vip_reservations')
    .select('event_vip_table_id, status')
    .eq('event_id', eventId)
    .in('status', ['pending', 'confirmed', 'checked_in']);

  if (reservationsError) {
    console.error('Error fetching reservations:', reservationsError);
    // Don't throw - continue with all tables showing availability based on is_available flag
  }

  const typedReservations = (reservations || []) as Array<{ event_vip_table_id: string; status: string }>;
  const reservedTableIds = new Set(
    typedReservations.map(r => r.event_vip_table_id).filter(Boolean)
  );

  const typedTables = (tables || []) as EventVipTable[];

  // Map to VipTableWithAvailability format
  // Handle both price formats: price (decimal from schema) and price_cents (integer from Owner Suite)
  return typedTables.map(table => {
    const tableAny = table as Record<string, unknown>;
    const priceValue = tableAny.price_cents
      ? Number(tableAny.price_cents) / 100
      : Number(table.price) || 0;

    return {
      ...table,
      price: priceValue,
      has_active_reservation: reservedTableIds.has(table.id),
      is_available: table.is_available && !reservedTableIds.has(table.id),
      // Legacy compatibility fields
      guest_capacity: table.capacity,
      table_name: table.table_name || `Table ${table.table_number}`,
    };
  });
}

/**
 * React hook for realtime floor plan updates
 * Subscribes to vip_reservations and event_vip_tables changes for the event
 */
export function useRealtimeFloorPlan(eventId: string): {
  tables: VipTableWithAvailability[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [tables, setTables] = useState<VipTableWithAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTables = useCallback(async () => {
    try {
      const data = await getAvailableTablesForEvent(eventId);
      setTables(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch tables'));
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    // Initial fetch
    fetchTables();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`floor-plan-${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vip_reservations',
        filter: `event_id=eq.${eventId}`
      }, (payload) => {
        console.log('[floor-plan] Reservation changed:', payload.eventType);
        fetchTables();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'event_vip_tables',
        filter: `event_id=eq.${eventId}`
      }, (payload) => {
        console.log('[floor-plan] Table updated:', payload.eventType);
        fetchTables();
      })
      .subscribe((status) => {
        console.log('[floor-plan] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchTables]);

  return { tables, isLoading, error, refetch: fetchTables };
}

/**
 * Get a single VIP table by ID
 */
export async function getVipTableById(tableId: string): Promise<EventVipTable | null> {
  const { data, error } = await supabase
    .from('event_vip_tables')
    .select('*')
    .eq('id', tableId)
    .single();

  if (error) {
    console.error('Error fetching VIP table:', error);
    return null;
  }

  return data as EventVipTable;
}

/**
 * Check if a specific table is available for an event
 */
export async function checkTableAvailability(eventId: string, tableId: string): Promise<boolean> {
  // Check the table's is_available flag
  const { data: table, error: tableError } = await supabase
    .from('event_vip_tables')
    .select('is_available')
    .eq('id', tableId)
    .eq('event_id', eventId)
    .single();

  if (tableError || !table) {
    console.error('Error checking table:', tableError);
    return false;
  }

  const typedTable = table as { is_available: boolean };
  if (!typedTable.is_available) {
    return false;
  }

  // Check for existing active reservations
  const { data: reservations, error: reservationsError } = await supabase
    .from('vip_reservations')
    .select('id')
    .eq('event_id', eventId)
    .eq('event_vip_table_id', tableId)
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .limit(1);

  if (reservationsError) {
    console.error('Error checking reservations:', reservationsError);
    throw reservationsError;
  }

  return !reservations || reservations.length === 0;
}

// ============================================================================
// Reservation Functions
// ============================================================================

/**
 * Generate a unique QR code token for reservation
 */
function generateQrCodeToken(): string {
  return `VIP-${crypto.randomUUID().substring(0, 12).toUpperCase()}`;
}

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
 * Create a new VIP table reservation using atomic RPC function
 * This prevents race conditions by using database-level row locking
 */
export async function createTableReservation(
  data: CreateReservationData
): Promise<{ reservation: VipReservation; guestPasses: VipGuestPass[] }> {
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
      p_is_walk_in: data.isWalkIn || false,
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
  const reservation = await getReservationById(atomicResult.reservation_id!);
  if (!reservation) {
    throw new Error('Failed to fetch created reservation');
  }

  // Map guest passes from the atomic result
  const guestPasses: VipGuestPass[] = (atomicResult.guest_passes || []).map((pass, index) => ({
    id: '', // Will be populated when fetched
    reservation_id: atomicResult.reservation_id!,
    guest_number: pass.guest_number,
    guest_name: null,
    qr_code_token: pass.qr_code_token,
    qr_signature: pass.qr_signature,
    status: 'issued' as const,
    checked_in_at: null,
    checked_in_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // If we need full guest pass data with IDs, fetch from reservation
  if (reservation.guest_passes && reservation.guest_passes.length > 0) {
    return { reservation, guestPasses: reservation.guest_passes };
  }

  return { reservation, guestPasses };
}

/**
 * @deprecated Guest passes are now created atomically by create_vip_reservation_atomic RPC.
 * Use this only if you need to manually create passes for existing reservations.
 * For new reservations, use createTableReservation() which handles everything atomically.
 */
export async function generateGuestPasses(
  reservationId: string,
  guestCount: number
): Promise<VipGuestPass[]> {
  console.warn('generateGuestPasses is deprecated. Passes are now created atomically with reservations.');

  const passes: VipGuestPass[] = [];

  for (let i = 1; i <= guestCount; i++) {
    // Generate secure QR payload
    const qrPayload = await generateSecureQrPayload({
      type: 'vip_guest',
      reservationId,
      guestNumber: i,
    });

    const qrCodeToken = `VIP-PASS-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

    const insertData = {
      reservation_id: reservationId,
      guest_number: i,
      qr_code_token: qrCodeToken,
      qr_signature: qrPayload.signature,
      status: 'issued',
    };

    const { data: pass, error } = await supabase
      .from('vip_guest_passes')
      .insert(insertData as never)
      .select()
      .single();

    if (error) {
      console.error('Error creating guest pass:', error);
      throw error;
    }

    // Generate QR code image
    const qrCodeUrl = await generateQrImage(qrPayload.rawPayload);

    passes.push({
      ...(pass as unknown as VipGuestPass),
      qr_code_url: qrCodeUrl,
    });
  }

  return passes;
}

/**
 * Get reservation by ID with all related data
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
 * Get reservation by QR code token
 */
export async function getReservationByQrToken(qrToken: string): Promise<VipReservation | null> {
  const { data, error } = await supabase
    .from('vip_reservations')
    .select(`
      *,
      event_vip_table:event_vip_tables(*),
      event:events(id, name, event_date, event_time, venue_name, image_url),
      guest_passes:vip_guest_passes(*)
    `)
    .eq('qr_code_token', qrToken)
    .single();

  if (error) {
    console.error('Error fetching reservation:', error);
    return null;
  }

  return data as unknown as VipReservation;
}

/**
 * Get all reservations for an event
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
 * Update reservation after successful payment
 */
export async function confirmReservationPayment(
  reservationId: string,
  stripePaymentIntentId: string
): Promise<VipReservation> {
  // Get reservation to find the table
  const reservation = await getReservationById(reservationId);

  const { data, error } = await supabase
    .from('vip_reservations')
    .update({
      status: 'confirmed',
      stripe_payment_intent_id: stripePaymentIntentId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', reservationId)
    .select()
    .single();

  if (error) {
    console.error('Error confirming reservation:', error);
    throw error;
  }

  // Mark table as unavailable
  if (reservation?.event_vip_table_id) {
    await supabase
      .from('event_vip_tables')
      .update({ is_available: false } as never)
      .eq('id', reservation.event_vip_table_id);
  }

  return data as unknown as VipReservation;
}

/**
 * Mark reservation payment as failed
 */
export async function failReservationPayment(reservationId: string): Promise<void> {
  const { error } = await supabase
    .from('vip_reservations')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', reservationId);

  if (error) {
    console.error('Error failing reservation:', error);
    throw error;
  }
}

// ============================================================================
// Guest Pass Functions
// ============================================================================

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

/**
 * Get guest pass by QR token (for scanner)
 */
export async function getGuestPassByQrToken(qrToken: string): Promise<{
  pass: VipGuestPass;
  reservation: VipReservation;
} | null> {
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
    .eq('qr_code_token', qrToken)
    .single();

  if (error) {
    console.error('Error fetching guest pass:', error);
    return null;
  }

  if (!data) return null;

  const typedData = data as unknown as VipGuestPass & { reservation: VipReservation };

  return {
    pass: typedData,
    reservation: typedData.reservation,
  };
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
  checkedInBy?: string
): Promise<VipGuestPass> {
  // Call the atomic check-in function
  const { data: result, error: rpcError } = await supabase.rpc(
    'check_in_vip_guest_atomic',
    {
      p_pass_id: passId,
      p_checked_in_by: checkedInBy || 'system',
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
 * Check in all guests for a reservation
 */
export async function checkInAllGuests(
  reservationId: string,
  checkedInBy?: string
): Promise<void> {
  const now = new Date().toISOString();

  // Update all issued passes to checked_in
  const { error: passesError } = await supabase
    .from('vip_guest_passes')
    .update({
      status: 'checked_in',
      checked_in_at: now,
      checked_in_by: checkedInBy || null,
    } as never)
    .eq('reservation_id', reservationId)
    .eq('status', 'issued');

  if (passesError) {
    console.error('Error checking in all guests:', passesError);
    throw passesError;
  }

  // Count total checked-in guests
  const { count } = await supabase
    .from('vip_guest_passes')
    .select('*', { count: 'exact', head: true })
    .eq('reservation_id', reservationId)
    .eq('status', 'checked_in');

  // Update reservation
  const { data: currentReservation } = await supabase
    .from('vip_reservations')
    .select('checked_in_at')
    .eq('id', reservationId)
    .single();

  const typedCurrentReservation = currentReservation as { checked_in_at: string | null } | null;

  const updateData: Record<string, unknown> = {
    checked_in_guests: count || 0,
    status: 'checked_in',
    updated_at: now,
  };

  // Only set checked_in_at if not already set
  if (!typedCurrentReservation?.checked_in_at) {
    updateData.checked_in_at = now;
  }

  const { error: reservationError } = await supabase
    .from('vip_reservations')
    .update(updateData as never)
    .eq('id', reservationId);

  if (reservationError) {
    console.error('Error updating reservation:', reservationError);
    throw reservationError;
  }
}

/**
 * Get all guest passes for a reservation with QR codes
 */
export async function getGuestPassesWithQrCodes(reservationId: string): Promise<VipGuestPass[]> {
  const { data, error } = await supabase
    .from('vip_guest_passes')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('guest_number', { ascending: true });

  if (error) {
    console.error('Error fetching guest passes:', error);
    throw error;
  }

  const typedData = (data || []) as unknown as VipGuestPass[];

  // Generate QR code URLs for each pass
  const passesWithQr = await Promise.all(
    typedData.map(async (pass) => {
      const qrPayload = JSON.stringify({
        token: pass.qr_code_token,
        signature: pass.qr_signature,
        meta: {
          type: 'vip_guest',
          reservationId: pass.reservation_id,
          guestNumber: pass.guest_number,
        },
      });
      const qrCodeUrl = await generateQrImage(qrPayload);
      return {
        ...pass,
        qr_code_url: qrCodeUrl,
      };
    })
  );

  return passesWithQr;
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
  const tables = await getAvailableTablesForEvent(eventId);
  const reservations = await getReservationsForEvent(eventId);

  const activeReservations = reservations.filter(
    r => r.status !== 'cancelled'
  );

  const confirmedReservations = reservations.filter(
    r => r.status === 'confirmed' || r.status === 'checked_in' || r.status === 'completed'
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

  // Walk-ins would need to be tracked via package_snapshot
  const walkInCount = 0;

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

  activeReservations.forEach(r => {
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
    reservedTables: tables.filter(t => !t.is_available).length,
    availableTables: tables.filter(t => t.is_available).length,
    totalRevenue,
    totalGuests,
    checkedInGuests,
    walkInCount,
    reservationsByTier,
    reservationsByStatus,
  };
}

// ============================================================================
// Bottle Choices
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

export function getBottleChoicesByCategory(): Record<string, typeof BOTTLE_CHOICES> {
  return BOTTLE_CHOICES.reduce((acc, bottle) => {
    if (!acc[bottle.category]) {
      acc[bottle.category] = [];
    }
    acc[bottle.category].push(bottle);
    return acc;
  }, {} as Record<string, typeof BOTTLE_CHOICES>);
}

// ============================================================================
// Legacy Compatibility Helpers
// ============================================================================

/**
 * Convert VipReservation to legacy TableReservation format
 * Use this when interfacing with old components
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
    is_walk_in: false,
    arrival_time: reservation.checked_in_at,
    vip_table: reservation.event_vip_table,
  };
}

// ============================================================================
// Deprecated Functions (kept for backward compatibility)
// ============================================================================

/** @deprecated Use getTablesForEvent instead */
export async function getAllVipTables(): Promise<EventVipTable[]> {
  console.warn('getAllVipTables is deprecated. Use getTablesForEvent(eventId) instead.');
  // Return empty array since we need an event ID now
  return [];
}

/** @deprecated Use getReservationByQrToken instead */
export async function getReservationByNumber(reservationNumber: string): Promise<VipReservation | null> {
  console.warn('getReservationByNumber is deprecated. Use getReservationByQrToken instead.');
  return getReservationByQrToken(reservationNumber);
}

/** @deprecated Payment updates are now handled by confirmReservationPayment */
export async function updateReservationPayment(
  reservationId: string,
  paymentData: {
    paymentStatus: 'paid' | 'failed';
    stripePaymentIntentId?: string;
    stripeSessionId?: string;
  }
): Promise<VipReservation> {
  console.warn('updateReservationPayment is deprecated. Use confirmReservationPayment or failReservationPayment instead.');
  if (paymentData.paymentStatus === 'paid' && paymentData.stripePaymentIntentId) {
    return confirmReservationPayment(reservationId, paymentData.stripePaymentIntentId);
  } else {
    await failReservationPayment(reservationId);
    const reservation = await getReservationById(reservationId);
    if (!reservation) throw new Error('Reservation not found');
    return reservation;
  }
}
