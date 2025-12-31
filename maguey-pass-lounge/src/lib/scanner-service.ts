/**
 * Scanner Service
 * Functions for scanning tickets and retrieving ticket data with event images
 */

import { supabase } from './supabase';

export interface ScannedTicket {
  id: string;
  ticket_id: string;
  order_id: string;
  event_id: string;
  ticket_type: string;
  ticket_type_name: string;
  status: string;
  price: number;
  fee: number;
  total: number;
  issued_at: string;
  checked_in_at: string | null;
  expires_at: string;
  // Event data (from JOIN)
  event_name: string;
  event_image: string;
  event_date: string;
  event_time: string;
  venue_name: string;
  venue_address: string;
  city: string;
  // Order data (from JOIN)
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  order_total: number;
}

/**
 * Scan a ticket by qr_token (UUID from QR code)
 * Returns ticket with event image and all relevant data
 * 
 * NOTE: Scanner searches by qr_token, not ticket_id
 * The QR code encodes the qr_token (UUID), not the human-readable ticket_id
 */
export async function scanTicket(qrToken: string): Promise<{
  success: boolean;
  ticket?: ScannedTicket;
  error?: string;
}> {
  try {
    // Use the view for optimized query with event image
    // Scanner searches by qr_token (UUID from QR code)
    const { data, error } = await supabase
      .from('ticket_scan_view')
      .select('*')
      .eq('qr_token', qrToken)  // ← Search by qr_token (UUID), not ticket_id
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || 'Ticket not found',
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'Ticket not found',
      };
    }

    // Map view data to ScannedTicket interface
    // Handle both snake_case from database and camelCase conversions
    const ticket: ScannedTicket = {
      id: data.id || data.ticket_id,
      ticket_id: data.ticket_id,
      order_id: data.order_id,
      event_id: data.event_id,
      ticket_type: data.ticket_type,
      ticket_type_name: data.ticket_type_name,
      status: data.status,
      price: typeof data.price === 'string' ? parseFloat(data.price) : data.price,
      fee: typeof data.fee === 'string' ? parseFloat(data.fee) : data.fee,
      total: typeof data.total === 'string' ? parseFloat(data.total) : data.total,
      issued_at: data.issued_at,
      checked_in_at: data.checked_in_at || null,
      expires_at: data.expires_at,
      event_name: data.event_name,
      event_image: data.event_image || '',
      event_date: data.event_date,
      event_time: data.event_time,
      venue_name: data.venue_name,
      venue_address: data.venue_address,
      city: data.city || '',
      customer_first_name: data.customer_first_name,
      customer_last_name: data.customer_last_name,
      customer_email: data.customer_email,
      order_total: typeof data.order_total === 'string' ? parseFloat(data.order_total) : data.order_total,
    };

    return {
      success: true,
      ticket,
    };
  } catch (error) {
    console.error('Error scanning ticket:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan ticket',
    };
  }
}

/**
 * Check in a ticket (update status to checked_in)
 * Uses qr_token to identify the ticket
 */
export async function checkInTicket(qrToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('tickets')
      .update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
      })
      .eq('qr_token', qrToken);  // ← Update by qr_token, not ticket_id

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to check in ticket',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error checking in ticket:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check in ticket',
    };
  }
}

/**
 * Get all tickets for an event (for event management)
 */
export async function getTicketsForEvent(eventId: string): Promise<{
  success: boolean;
  tickets?: ScannedTicket[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('ticket_scan_view')
      .select('*')
      .eq('event_id', eventId)
      .order('issued_at', { ascending: false });

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch tickets',
      };
    }

    const tickets: ScannedTicket[] = (data || []).map((item: any) => ({
      id: item.id || item.ticket_id,
      ticket_id: item.ticket_id,
      order_id: item.order_id,
      event_id: item.event_id,
      ticket_type: item.ticket_type,
      ticket_type_name: item.ticket_type_name,
      status: item.status,
      price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
      fee: typeof item.fee === 'string' ? parseFloat(item.fee) : item.fee,
      total: typeof item.total === 'string' ? parseFloat(item.total) : item.total,
      issued_at: item.issued_at,
      checked_in_at: item.checked_in_at || null,
      expires_at: item.expires_at,
      event_name: item.event_name,
      event_image: item.event_image || '',
      event_date: item.event_date,
      event_time: item.event_time,
      venue_name: item.venue_name,
      venue_address: item.venue_address,
      city: item.city || '',
      customer_first_name: item.customer_first_name,
      customer_last_name: item.customer_last_name,
      customer_email: item.customer_email,
      order_total: typeof item.order_total === 'string' ? parseFloat(item.order_total) : item.order_total,
    }));

    return {
      success: true,
      tickets,
    };
  } catch (error) {
    console.error('Error fetching tickets for event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tickets',
    };
  }
}

