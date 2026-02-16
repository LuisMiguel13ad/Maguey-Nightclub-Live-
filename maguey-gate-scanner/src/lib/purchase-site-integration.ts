/**
 * Purchase Site Integration Service
 * 
 * This service provides functions to interact with the purchase site API endpoints
 * and manage ticket synchronization between the purchase site and scanner.
 */

import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

export interface EventAvailability {
  event: {
    id: string;
    name: string;
    event_date: string;
    is_active: boolean;
    venue_capacity: number;
  };
  availability: Array<{
    name: string;
    price: number;
    capacity: number;
    sold: number;
    scanned: number;
    available: number;
    sold_out: boolean;
  }>;
  summary: {
    total_capacity: number;
    total_sold: number;
    total_scanned: number;
    total_available: number;
    is_sold_out: boolean;
  };
  timestamp: string;
}

export interface TicketData {
  ticket_id: string;
  event_name: string;
  ticket_type: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  qr_code_data?: string;
  order_id?: string;
  price_paid?: number;
  stripe_payment_id?: string;
  purchase_date?: string;
  metadata?: Record<string, any>;
}

export interface OrderTicketsResponse {
  order_id: string;
  order: any;
  tickets: any[];
  ticket_count: number;
  scanned_count: number;
  timestamp: string;
}

/**
 * Get real-time event availability
 * @param eventName - Name of the event
 * @returns Event availability data
 */
export const getEventAvailability = async (
  eventName: string
): Promise<EventAvailability> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const functionUrl = `${supabaseUrl}/functions/v1/event-availability/${encodeURIComponent(eventName)}`;

  const response = await fetch(functionUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Standardized: Use VITE_SUPABASE_ANON_KEY with backward compatibility
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch availability: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Create tickets via webhook (for purchase site integration)
 * @param tickets - Array of ticket data to create
 * @param webhookSecret - Optional webhook secret for authentication
 * @returns Created tickets
 */
export const createTicketsViaWebhook = async (
  tickets: TicketData[],
  webhookSecret?: string
): Promise<{ success: boolean; tickets_created: number; tickets: any[] }> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const functionUrl = `${supabaseUrl}/functions/v1/ticket-webhook`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  };

  if (webhookSecret) {
    headers['authorization'] = `Bearer ${webhookSecret}`;
  }

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tickets }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || `Failed to create tickets: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get tickets by order ID
 * @param orderId - Order ID to fetch tickets for
 * @returns Order tickets data
 */
export const getOrderTickets = async (
  orderId: string
): Promise<OrderTicketsResponse> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const functionUrl = `${supabaseUrl}/functions/v1/order-tickets/${encodeURIComponent(orderId)}`;

  const response = await fetch(functionUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Standardized: Use VITE_SUPABASE_ANON_KEY with backward compatibility
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch order tickets: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Check if ticket exists and get its status
 * @param ticketId - Ticket ID to check
 * @returns Ticket status or null if not found
 */
export const getTicketStatus = async (
  ticketId: string
): Promise<{ status: string; scanned_at: string | null; is_used: boolean } | null> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  const { data, error } = await supabase
    .from('tickets')
    .select('status, scanned_at, is_used')
    .eq('ticket_id', ticketId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    status: data.status || 'unknown',
    scanned_at: data.scanned_at,
    is_used: data.is_used,
  };
};

/**
 * Subscribe to real-time ticket updates
 * @param ticketId - Ticket ID to subscribe to
 * @param callback - Callback function when ticket is updated
 * @returns Unsubscribe function
 */
export const subscribeToTicketUpdates = (
  ticketId: string,
  callback: (ticket: any) => void
): (() => void) => {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, cannot subscribe to updates');
    return () => {};
  }

  const channel = supabase
    .channel(`ticket:${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tickets',
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Subscribe to real-time event availability updates
 * @param eventName - Event name to subscribe to
 * @param callback - Callback function when availability changes
 * @returns Unsubscribe function
 */
export const subscribeToEventAvailability = (
  eventName: string,
  callback: (availability: EventAvailability) => void
): (() => void) => {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, cannot subscribe to updates');
    return () => {};
  }

  const channel = supabase
    .channel(`event-availability:${eventName}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `event_name=eq.${eventName}`,
      },
      async () => {
        // Fetch updated availability when tickets change
        try {
          const availability = await getEventAvailability(eventName);
          callback(availability);
        } catch (error) {
          console.error('Error fetching updated availability:', error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};


