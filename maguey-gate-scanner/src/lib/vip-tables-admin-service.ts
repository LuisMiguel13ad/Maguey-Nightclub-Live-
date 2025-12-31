/**
 * VIP Tables Admin Service
 * Admin functions for managing VIP table reservations
 */

import { supabase } from '@/integrations/supabase/client';

// Types
export interface VipTable {
  id: string;
  table_number: string;
  table_name: string;
  tier: 'premium' | 'standard' | 'regular';
  price: number;
  guest_capacity: number;
  bottle_service_description: string;
  floor_section: string | null;
  position_description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface TableReservation {
  id: string;
  reservation_number: string;
  event_id: string;
  table_id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  guest_count: number;
  bottle_choice: string | null;
  special_requests: string | null;
  table_price: number;
  total_amount: number;
  stripe_payment_intent_id: string | null;
  stripe_session_id: string | null;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  paid_at: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  is_walk_in: boolean;
  checked_in_guests: number;
  arrival_time: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  vip_table?: VipTable;
  event?: {
    id: string;
    name: string;
    event_date: string;
    event_time: string;
    venue_name: string;
    image_url: string;
  };
  guest_passes?: TableGuestPass[];
}

export interface TableGuestPass {
  id: string;
  pass_id: string;
  reservation_id: string;
  guest_name: string | null;
  guest_number: number;
  qr_token: string;
  qr_signature: string;
  status: 'issued' | 'checked_in' | 'cancelled';
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
}

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
 * Get all VIP tables
 */
export async function getAllVipTables(): Promise<VipTable[]> {
  const { data, error } = await supabase
    .from('vip_tables')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching VIP tables:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all reservations for an event with full details
 */
export async function getReservationsForEvent(eventId: string): Promise<TableReservation[]> {
  const { data, error } = await supabase
    .from('table_reservations')
    .select(`
      *,
      vip_table:vip_tables(*),
      guest_passes:table_guest_passes(*)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching reservations:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get reservation by ID
 */
export async function getReservationById(reservationId: string): Promise<TableReservation | null> {
  const { data, error } = await supabase
    .from('table_reservations')
    .select(`
      *,
      vip_table:vip_tables(*),
      event:events(id, name, event_date, event_time, venue_name, image_url),
      guest_passes:table_guest_passes(*)
    `)
    .eq('id', reservationId)
    .single();

  if (error) {
    console.error('Error fetching reservation:', error);
    return null;
  }

  return data;
}

/**
 * Get available tables for an event
 */
export async function getAvailableTablesForEvent(eventId: string): Promise<VipTable[]> {
  // Get all active tables
  const { data: tables, error: tablesError } = await supabase
    .from('vip_tables')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (tablesError) {
    console.error('Error fetching VIP tables:', tablesError);
    throw tablesError;
  }

  // Get reservations for this event
  const { data: reservations, error: reservationsError } = await supabase
    .from('table_reservations')
    .select('table_id')
    .eq('event_id', eventId)
    .not('status', 'eq', 'cancelled')
    .not('payment_status', 'in', '(failed,refunded)');

  if (reservationsError) {
    console.error('Error fetching reservations:', reservationsError);
    throw reservationsError;
  }

  const reservedTableIds = new Set(reservations?.map(r => r.table_id) || []);

  return (tables || []).filter(table => !reservedTableIds.has(table.id));
}

// ============================================================================
// Admin Actions
// ============================================================================

/**
 * Create a walk-in reservation (immediate payment)
 */
export async function createWalkInReservation(
  data: CreateWalkInReservationData
): Promise<TableReservation> {
  // Get table details
  const { data: table, error: tableError } = await supabase
    .from('vip_tables')
    .select('*')
    .eq('id', data.tableId)
    .single();

  if (tableError || !table) {
    throw new Error('Table not found');
  }

  // Generate reservation number
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
  const reservationNumber = `VIP-${datePart}-${randomPart}`;

  // Create the reservation
  const { data: reservation, error: reservationError } = await supabase
    .from('table_reservations')
    .insert({
      reservation_number: reservationNumber,
      event_id: data.eventId,
      table_id: data.tableId,
      customer_first_name: data.customerFirstName,
      customer_last_name: data.customerLastName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      guest_count: data.guestCount,
      bottle_choice: data.bottleChoice || null,
      special_requests: data.specialRequests || null,
      table_price: table.price,
      total_amount: table.price,
      payment_status: 'paid',
      status: 'confirmed',
      is_walk_in: true,
      created_by: data.createdBy,
      notes: data.notes || null,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (reservationError) {
    console.error('Error creating walk-in reservation:', reservationError);
    throw reservationError;
  }

  // Generate guest passes
  await generateGuestPassesForReservation(reservation.id, data.guestCount);

  // Fetch the complete reservation with related data
  const completeReservation = await getReservationById(reservation.id);
  if (!completeReservation) {
    throw new Error('Failed to fetch created reservation');
  }

  return completeReservation;
}

/**
 * Generate guest passes for a reservation
 */
async function generateGuestPassesForReservation(
  reservationId: string,
  guestCount: number
): Promise<void> {
  const passes = [];

  for (let i = 1; i <= guestCount; i++) {
    // Generate secure tokens
    const qrToken = crypto.randomUUID();
    const qrSignature = btoa(qrToken + Date.now().toString()); // Simple signature for demo

    // Generate pass ID
    const passId = `VIP-PASS-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

    passes.push({
      pass_id: passId,
      reservation_id: reservationId,
      guest_number: i,
      qr_token: qrToken,
      qr_signature: qrSignature,
      status: 'issued',
    });
  }

  const { error } = await supabase
    .from('table_guest_passes')
    .insert(passes);

  if (error) {
    console.error('Error creating guest passes:', error);
    throw error;
  }
}

/**
 * Update reservation status
 */
export async function updateReservationStatus(
  reservationId: string,
  status: TableReservation['status']
): Promise<TableReservation> {
  const { data, error } = await supabase
    .from('table_reservations')
    .update({ status })
    .eq('id', reservationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating reservation status:', error);
    throw error;
  }

  return data;
}

/**
 * Add notes to a reservation
 */
export async function addReservationNotes(
  reservationId: string,
  notes: string
): Promise<TableReservation> {
  const { data, error } = await supabase
    .from('table_reservations')
    .update({ notes })
    .eq('id', reservationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating reservation notes:', error);
    throw error;
  }

  return data;
}

/**
 * Check in a guest pass
 */
export async function checkInGuestPass(
  passId: string,
  checkedInBy: string
): Promise<TableGuestPass> {
  const { data, error } = await supabase
    .from('table_guest_passes')
    .update({
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
      checked_in_by: checkedInBy,
    })
    .eq('id', passId)
    .select()
    .single();

  if (error) {
    console.error('Error checking in guest:', error);
    throw error;
  }

  // Update the reservation's checked_in_guests count
  const { data: pass } = await supabase
    .from('table_guest_passes')
    .select('reservation_id')
    .eq('id', passId)
    .single();

  if (pass) {
    // Count checked-in guests
    const { count } = await supabase
      .from('table_guest_passes')
      .select('*', { count: 'exact', head: true })
      .eq('reservation_id', pass.reservation_id)
      .eq('status', 'checked_in');

    // Update reservation
    await supabase
      .from('table_reservations')
      .update({
        checked_in_guests: count || 0,
        arrival_time: new Date().toISOString(),
      })
      .eq('id', pass.reservation_id)
      .is('arrival_time', null);
  }

  return data;
}

/**
 * Mark all guests as checked in
 */
export async function checkInAllGuests(
  reservationId: string,
  checkedInBy: string
): Promise<void> {
  const { error: passesError } = await supabase
    .from('table_guest_passes')
    .update({
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
      checked_in_by: checkedInBy,
    })
    .eq('reservation_id', reservationId)
    .eq('status', 'issued');

  if (passesError) {
    console.error('Error checking in all guests:', passesError);
    throw passesError;
  }

  // Get total guest count
  const { count } = await supabase
    .from('table_guest_passes')
    .select('*', { count: 'exact', head: true })
    .eq('reservation_id', reservationId)
    .eq('status', 'checked_in');

  // Update reservation
  const { error: reservationError } = await supabase
    .from('table_reservations')
    .update({
      checked_in_guests: count || 0,
      arrival_time: new Date().toISOString(),
    })
    .eq('id', reservationId);

  if (reservationError) {
    console.error('Error updating reservation:', reservationError);
    throw reservationError;
  }
}

/**
 * Get guest pass by QR token (for scanner)
 */
export async function getGuestPassByQrToken(qrToken: string): Promise<{
  pass: TableGuestPass;
  reservation: TableReservation;
} | null> {
  const { data, error } = await supabase
    .from('table_guest_passes')
    .select(`
      *,
      reservation:table_reservations(
        *,
        vip_table:vip_tables(*),
        event:events(id, name, event_date, event_time, venue_name)
      )
    `)
    .eq('qr_token', qrToken)
    .single();

  if (error) {
    console.error('Error fetching guest pass:', error);
    return null;
  }

  return {
    pass: data,
    reservation: data.reservation,
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
  const tables = await getAllVipTables();
  const reservations = await getReservationsForEvent(eventId);

  const confirmedReservations = reservations.filter(
    r => r.status !== 'cancelled' && r.payment_status !== 'failed' && r.payment_status !== 'refunded'
  );

  const reservedTableIds = new Set(confirmedReservations.map(r => r.table_id));

  const totalRevenue = confirmedReservations.reduce((sum, r) => sum + Number(r.total_amount), 0);
  const totalGuests = confirmedReservations.reduce((sum, r) => sum + r.guest_count, 0);
  const checkedInGuests = confirmedReservations.reduce((sum, r) => sum + r.checked_in_guests, 0);
  const walkInCount = confirmedReservations.filter(r => r.is_walk_in).length;

  const reservationsByTier: Record<string, number> = {
    premium: 0,
    standard: 0,
    regular: 0,
  };

  const reservationsByStatus: Record<string, number> = {
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
    no_show: 0,
  };

  reservations.forEach(r => {
    if (r.vip_table) {
      reservationsByTier[r.vip_table.tier]++;
    }
    reservationsByStatus[r.status]++;
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
