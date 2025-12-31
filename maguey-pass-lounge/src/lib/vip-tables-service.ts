/**
 * VIP Tables Service
 * Handles VIP table reservations, availability, and guest passes
 */

import { supabase } from './supabase';
import { generateSecureQrPayload, generateQrImage } from './ticket-generator';

// Types
export type VipTableTier = 'premium' | 'standard' | 'regular' | 'front_row' | string;

export interface VipTable {
  id: string;
  table_number: string;
  table_name: string;
  tier: VipTableTier;
  price: number;
  guest_capacity: number;
  bottle_service_description: string;
  floor_section: string | null;
  position_description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface VipTableWithAvailability extends VipTable {
  is_available: boolean;
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
  // Generated data
  qr_code_url?: string;
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
 * Get all VIP tables
 */
export async function getAllVipTables(): Promise<VipTable[]> {
  const { data, error } = await supabase
    .from('vip_tables')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching VIP tables:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all tables for a specific event (including reserved ones for floor plan display)
 */
export async function getAvailableTablesForEvent(eventId: string): Promise<VipTableWithAvailability[]> {
  // Get ALL VIP tables for this specific event from event_vip_tables (including unavailable)
  const { data: tables, error: tablesError } = await supabase
    .from('event_vip_tables')
    .select('*')
    .eq('event_id', eventId)
    .order('table_number', { ascending: true });

  if (tablesError) {
    console.error('Error fetching VIP tables:', tablesError);
    throw tablesError;
  }

  // Get reservations for this event to check which tables are reserved
  const { data: reservations, error: reservationsError } = await supabase
    .from('vip_reservations')
    .select('event_vip_table_id, status')
    .eq('event_id', eventId)
    .in('status', ['pending', 'confirmed', 'checked_in']);

  if (reservationsError) {
    console.error('Error fetching reservations:', reservationsError);
    // Don't throw - continue with all tables marked as available
  }

  const reservedTableIds = new Set(reservations?.map(r => r.event_vip_table_id).filter(Boolean) || []);

  // Map event_vip_tables to VipTableWithAvailability format
  // A table is available only if it's marked as is_available AND doesn't have an active reservation
  return (tables || []).map(table => ({
    id: table.id,
    event_id: table.event_id,
    table_name: `Table ${table.table_number}`,
    table_number: table.table_number,
    tier: table.tier,
    guest_capacity: table.capacity,
    price: table.price_cents / 100, // Convert cents to dollars
    bottle_service_description: table.package_description || 'Bottle service included',
    floor_section: 'VIP Section', // Default section
    position_description: null,
    is_available: table.is_available && !reservedTableIds.has(table.id),
    sort_order: table.display_order || table.table_number,
  }));
}

/**
 * Get a single VIP table by ID
 */
export async function getVipTableById(tableId: string): Promise<VipTable | null> {
  const { data, error } = await supabase
    .from('vip_tables')
    .select('*')
    .eq('id', tableId)
    .single();

  if (error) {
    console.error('Error fetching VIP table:', error);
    return null;
  }

  return data;
}

/**
 * Check if a specific table is available for an event
 */
export async function checkTableAvailability(eventId: string, tableId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('table_reservations')
    .select('id')
    .eq('event_id', eventId)
    .eq('table_id', tableId)
    .not('status', 'eq', 'cancelled')
    .not('payment_status', 'in', '(failed,refunded)')
    .limit(1);

  if (error) {
    console.error('Error checking availability:', error);
    throw error;
  }

  return !data || data.length === 0;
}

// ============================================================================
// Reservation Functions
// ============================================================================

/**
 * Generate a unique reservation number
 */
function generateReservationNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `VIP-${datePart}-${randomPart}`;
}

/**
 * Create a new table reservation
 */
export async function createTableReservation(
  data: CreateReservationData
): Promise<{ reservation: TableReservation; guestPasses: TableGuestPass[] }> {
  // First check availability
  const isAvailable = await checkTableAvailability(data.eventId, data.tableId);
  if (!isAvailable) {
    throw new Error('This table is no longer available for this event');
  }

  // Get table details for pricing
  const table = await getVipTableById(data.tableId);
  if (!table) {
    throw new Error('Table not found');
  }

  // Validate guest count
  if (data.guestCount > table.guest_capacity) {
    throw new Error(`This table has a maximum capacity of ${table.guest_capacity} guests`);
  }

  const reservationNumber = generateReservationNumber();

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
      payment_status: data.isWalkIn ? 'paid' : 'pending',
      status: data.isWalkIn ? 'confirmed' : 'pending',
      is_walk_in: data.isWalkIn || false,
      created_by: data.createdBy || null,
      notes: data.notes || null,
      paid_at: data.isWalkIn ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (reservationError) {
    console.error('Error creating reservation:', reservationError);
    throw reservationError;
  }

  // Generate guest passes
  const guestPasses = await generateGuestPasses(reservation.id, data.guestCount);

  return { reservation, guestPasses };
}

/**
 * Generate QR-coded guest passes for a reservation
 */
export async function generateGuestPasses(
  reservationId: string,
  guestCount: number
): Promise<TableGuestPass[]> {
  const passes: TableGuestPass[] = [];

  for (let i = 1; i <= guestCount; i++) {
    // Generate secure QR payload
    const qrPayload = await generateSecureQrPayload({
      type: 'vip_table_guest',
      reservationId,
      guestNumber: i,
    });

    // Generate pass ID
    const passId = `VIP-PASS-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

    const { data: pass, error } = await supabase
      .from('table_guest_passes')
      .insert({
        pass_id: passId,
        reservation_id: reservationId,
        guest_number: i,
        qr_token: qrPayload.token,
        qr_signature: qrPayload.signature,
        status: 'issued',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating guest pass:', error);
      throw error;
    }

    // Generate QR code image
    const qrCodeUrl = await generateQrImage(qrPayload.rawPayload);

    passes.push({
      ...pass,
      qr_code_url: qrCodeUrl,
    });
  }

  return passes;
}

/**
 * Get reservation by ID with all related data
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
 * Get reservation by reservation number
 */
export async function getReservationByNumber(reservationNumber: string): Promise<TableReservation | null> {
  const { data, error } = await supabase
    .from('table_reservations')
    .select(`
      *,
      vip_table:vip_tables(*),
      event:events(id, name, event_date, event_time, venue_name, image_url),
      guest_passes:table_guest_passes(*)
    `)
    .eq('reservation_number', reservationNumber)
    .single();

  if (error) {
    console.error('Error fetching reservation:', error);
    return null;
  }

  return data;
}

/**
 * Get all reservations for an event
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
 * Update reservation payment status after Stripe webhook
 */
export async function updateReservationPayment(
  reservationId: string,
  paymentData: {
    paymentStatus: 'paid' | 'failed';
    stripePaymentIntentId?: string;
    stripeSessionId?: string;
  }
): Promise<TableReservation> {
  const updateData: Record<string, unknown> = {
    payment_status: paymentData.paymentStatus,
  };

  if (paymentData.paymentStatus === 'paid') {
    updateData.status = 'confirmed';
    updateData.paid_at = new Date().toISOString();
  }

  if (paymentData.stripePaymentIntentId) {
    updateData.stripe_payment_intent_id = paymentData.stripePaymentIntentId;
  }

  if (paymentData.stripeSessionId) {
    updateData.stripe_session_id = paymentData.stripeSessionId;
  }

  const { data, error } = await supabase
    .from('table_reservations')
    .update(updateData)
    .eq('id', reservationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating reservation payment:', error);
    throw error;
  }

  return data;
}

// ============================================================================
// Guest Pass Functions
// ============================================================================

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

/**
 * Check in a guest pass
 */
export async function checkInGuestPass(
  passId: string,
  checkedInBy?: string
): Promise<TableGuestPass> {
  const { data, error } = await supabase
    .from('table_guest_passes')
    .update({
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
      checked_in_by: checkedInBy || null,
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
      .is('arrival_time', null); // Only set arrival_time if not already set
  }

  return data;
}

/**
 * Get all guest passes for a reservation with QR codes
 */
export async function getGuestPassesWithQrCodes(reservationId: string): Promise<TableGuestPass[]> {
  const { data, error } = await supabase
    .from('table_guest_passes')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('guest_number', { ascending: true });

  if (error) {
    console.error('Error fetching guest passes:', error);
    throw error;
  }

  // Generate QR code URLs for each pass
  const passesWithQr = await Promise.all(
    (data || []).map(async (pass) => {
      const qrPayload = JSON.stringify({
        token: pass.qr_token,
        signature: pass.qr_signature,
        meta: {
          type: 'vip_table_guest',
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
  reservationsByTier: Record<string, number>;
}> {
  const tables = await getAvailableTablesForEvent(eventId);
  const reservations = await getReservationsForEvent(eventId);

  const confirmedReservations = reservations.filter(
    r => r.status !== 'cancelled' && r.payment_status !== 'failed' && r.payment_status !== 'refunded'
  );

  const totalRevenue = confirmedReservations.reduce((sum, r) => sum + Number(r.total_amount), 0);
  const totalGuests = confirmedReservations.reduce((sum, r) => sum + r.guest_count, 0);
  const checkedInGuests = confirmedReservations.reduce((sum, r) => sum + r.checked_in_guests, 0);

  const reservationsByTier: Record<string, number> = {
    premium: 0,
    standard: 0,
    regular: 0,
  };

  confirmedReservations.forEach(r => {
    if (r.vip_table) {
      reservationsByTier[r.vip_table.tier]++;
    }
  });

  return {
    totalTables: tables.length,
    reservedTables: tables.filter(t => !t.is_available).length,
    availableTables: tables.filter(t => t.is_available).length,
    totalRevenue,
    totalGuests,
    checkedInGuests,
    reservationsByTier,
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
