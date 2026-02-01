import { createClient } from '@supabase/supabase-js'

// Support both Vite (import.meta.env) and Node (process.env) contexts
const env =
  (typeof import.meta !== 'undefined' && (import.meta as any).env) ??
  (typeof process !== 'undefined' ? process.env : {})

// Get credentials from environment
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

const isTestEnv =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'

let supabaseClient: ReturnType<typeof createClient>

if (!supabaseUrl || !supabaseAnonKey) {
  if (isTestEnv) {
    // Provide a stub client so unit tests for pure helpers can run without env vars.
    supabaseClient = {
      from() {
        throw new Error(
          'Supabase client stub: set test env vars or mock the client before calling database methods.'
        )
      },
    } as unknown as ReturnType<typeof createClient>
  } else {
    console.warn('⚠️ Missing Supabase credentials. Check your .env file.');
    // Create a minimal stub client that won't crash the app
    supabaseClient = {
      from() {
        return {
          select: () => ({ data: [], error: { message: 'Supabase not configured' } }),
          insert: () => ({ data: null, error: { message: 'Supabase not configured' } }),
          update: () => ({ data: null, error: { message: 'Supabase not configured' } }),
          delete: () => ({ data: null, error: { message: 'Supabase not configured' } }),
        } as any;
      },
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
      } as any,
    } as unknown as ReturnType<typeof createClient>;
  }
} else {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
}

// Create the connection to Supabase
export const supabase = supabaseClient

// TypeScript types for your database tables
export type Event = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  genre: string | null
  venue_name: string | null
  venue_address: string | null
  city: string | null
  event_date: string
  event_time: string
  status?: 'draft' | 'published' | 'archived' | null // Optional for backward compatibility
  created_at: string
  updated_at: string
}

export type TicketType = {
  id: string
  event_id: string
  code: string
  name: string
  price: number
  fee: number
  limit_per_order: number
  total_inventory: number | null
  /**
   * Number of tickets currently reserved/sold. Used for atomic inventory management.
   */
  tickets_sold: number
  description: string | null
  category: 'general' | 'vip' | 'service' | 'section'
  section_name: string | null
  section_description: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export type Order = {
  id: string
  user_id: string | null
  purchaser_email: string
  purchaser_name: string | null
  event_id: string
  subtotal: number
  fees_total: number
  total: number
  payment_provider: string | null
  payment_reference: string | null
  status: string
  created_at: string
  updated_at: string
}

export type Ticket = {
  id: string
  order_id: string
  ticket_type_id: string
  event_id: string
  attendee_name: string
  attendee_email: string | null
  seat_label: string | null
  /**
   * Legacy QR payload value retained for backward compatibility.
   */
  qr_code_value: string | null
  /**
   * Secure QR token issued for the ticket.
   */
  qr_token: string
  /**
   * HMAC signature computed for the QR token.
   */
  qr_signature: string
  /**
   * Base64 data URL for the QR code image (optional storage).
   */
  qr_code_url: string | null
  /**
   * Ticket price excluding fees.
   */
  price: number
  /**
   * Total fees applied to the ticket.
   */
  fee_total: number
  status: string
  issued_at: string
  scanned_at: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, unknown> | null
}

// ============================================
// RPC Function Types for Atomic Inventory Management
// ============================================

/**
 * Input for a single ticket reservation
 */
export type TicketReservationInput = {
  ticket_type_id: string
  quantity: number
}

/**
 * Result from check_and_reserve_tickets RPC function
 */
export type CheckAndReserveTicketsResult = {
  success: boolean
  reserved: number
  available: number
  ticket_type_name: string | null
  error_message: string | null
}

/**
 * Result from release_reserved_tickets RPC function
 */
export type ReleaseReservedTicketsResult = {
  success: boolean
  released: number
  new_tickets_sold: number
  error_message: string | null
}

/**
 * Result from reserve_tickets_batch RPC function
 */
export type ReserveTicketsBatchResult = {
  success: boolean
  error_message: string | null
  failed_ticket_type_id: string | null
  failed_ticket_type_name: string | null
  requested_quantity: number | null
  available_quantity: number | null
}

// ============================================
// RPC Function Types for Atomic Order Creation
// ============================================

/**
 * Input for atomic order creation line items
 */
export type AtomicOrderLineItem = {
  ticket_type_id: string
  quantity: number
  unit_price: number
  unit_fee: number
  display_name: string
}

/**
 * Result from create_order_with_tickets_atomic RPC function
 */
export type CreateOrderWithTicketsAtomicResult = {
  order_id: string
  order_data: Order
  tickets_data: Array<{
    qr_token: string
    event_id: string
    ticket_type_id: string
    attendee_name: string
    attendee_email: string | null
    order_id: string
    status: string
    issued_at: string
    price: number
    fee_total: number
    qr_signature: string
    qr_code_value: string
    ticket_id: string
  }>
  ticket_email_payloads: Array<{
    ticketId: string
    qrToken: string
    qrSignature: string
    ticket_id: string
  }>
}

// ============================================
// VIP Tables Types (Event-Specific Schema)
// ============================================

/**
 * VIP table available for an event
 */
export type EventVipTable = {
  id: string
  event_id: string
  table_number: number
  table_name: string
  tier: string
  price: number
  capacity: number
  bottles_included: number
  bottle_service_description: string | null
  floor_section: string | null
  position_description: string | null
  is_available: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * VIP reservation for an event
 */
export type VipReservation = {
  id: string
  event_id: string
  event_vip_table_id: string
  table_number: number
  purchaser_name: string
  purchaser_email: string
  purchaser_phone: string | null
  amount_paid_cents: number
  stripe_payment_intent_id: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'checked_in'
  qr_code_token: string
  package_snapshot: Record<string, unknown> | null
  special_requests: string | null
  disclaimer_accepted_at: string | null
  refund_policy_accepted_at: string | null
  checked_in_at: string | null
  checked_in_by: string | null
  checked_in_guests: number
  created_at: string
  updated_at: string
}

/**
 * Individual guest pass for VIP reservation
 */
export type VipGuestPass = {
  id: string
  reservation_id: string
  guest_number: number
  guest_name: string | null
  qr_code_token: string
  qr_signature: string
  status: 'issued' | 'checked_in' | 'cancelled'
  checked_in_at: string | null
  checked_in_by: string | null
  created_at: string
  updated_at: string
}

