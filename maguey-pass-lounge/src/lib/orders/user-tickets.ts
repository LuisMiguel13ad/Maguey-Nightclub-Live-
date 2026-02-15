import { supabase } from "../supabase";
import type { UserTicket } from "./types";

/**
 * Get all tickets for a user (by email or user ID)
 */
export async function getUserTickets(
  userEmail: string,
  userId?: string | null
): Promise<UserTicket[]> {
  try {
    // Query tickets directly by attendee_email (matches RLS policy requirement)
    // RLS policy: attendee_email = current_setting('request.jwt.claims')::json->>'email'
    // This bypasses the orders table RLS check and queries tickets directly
    // Query tickets WITHOUT orders join to avoid RLS policy issues
    // The orders RLS policy queries auth.users which regular users can't access
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        events (
          id,
          name,
          image_url,
          event_date,
          event_time,
          venue_name,
          venue_address,
          city
        ),
        ticket_types (
          code,
          name,
          description
        )
      `)
      .eq('attendee_email', userEmail) // RLS policy requires this to match logged-in user's email
      .order('issued_at', { ascending: false });

    if (error) {
      console.error('[getUserTickets] Error fetching tickets:', error);
      console.error('[getUserTickets] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Map to UserTicket interface (handle nested structure from joins)
    // Note: orders join removed to avoid RLS policy issues
    return data.map((item: any) => {
      const event = item.events || {};
      const ticketType = item.ticket_types || {};

      // Derive category from ticket_type code
      const category = ticketType.code === 'VIP' ? 'vip' :
                      ticketType.code === 'GA' ? 'general' : 'general';

      return {
        id: item.id || item.ticket_id,
        ticket_id: item.ticket_id,
        order_id: item.order_id,
        event_id: item.event_id,
        event_name: event.name || '',
        event_image: event.image_url || null,
        event_date: event.event_date || '',
        event_time: event.event_time || '',
        venue_name: event.venue_name || null,
        venue_address: event.venue_address || null,
        city: event.city || null,
        ticket_type: item.ticket_type || ticketType.code || '',
        ticket_type_name: item.ticket_type_name || ticketType.name || '',
        ticket_category: category,
        section_name: ticketType.name || null,
        section_description: ticketType.description || null,
        status: item.status || 'issued',
        price: typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0),
        fee: typeof item.fee === 'string' ? parseFloat(item.fee) : (item.fee || 0),
        total: typeof item.total === 'string' ? parseFloat(item.total) : (item.total || 0),
        attendee_name: item.attendee_name || null, // No order join, use ticket's attendee_name
        attendee_email: item.attendee_email || userEmail, // Use ticket's attendee_email or fallback to userEmail
        issued_at: item.issued_at || item.created_at,
        checked_in_at: item.checked_in_at || null,
        expires_at: item.expires_at || item.event_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default to 30 days from now if not set
        qr_code_url: item.qr_code_url || null,
        qr_code_value: item.qr_code_value || item.ticket_id || null,
      };
    });
  } catch (error) {
    console.error('Error in getUserTickets:', error);
    return [];
  }
}

/**
 * Get a single ticket by ticket_id
 */
export async function getTicketById(ticketId: string): Promise<UserTicket | null> {
  try {
    // Query ticket WITHOUT orders join to avoid RLS policy issues
    // The orders RLS policy queries auth.users which regular users can't access
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        events (
          id,
          name,
          image_url,
          event_date,
          event_time,
          venue_name,
          venue_address,
          city
        ),
        ticket_types (
          code,
          name,
          description
        )
      `)
      .eq('ticket_id', ticketId)
      .single();

    if (error || !data) {
      console.error('[getTicketById] Error fetching ticket:', error);
      if (error) {
        console.error('[getTicketById] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }
      return null;
    }

    const event = data.events || {};
    const ticketType = data.ticket_types || {};

    // Derive category from ticket_type code
    const category = ticketType.code === 'VIP' ? 'vip' :
                    ticketType.code === 'GA' ? 'general' : 'general';

    return {
      id: data.id || data.ticket_id,
      ticket_id: data.ticket_id,
      order_id: data.order_id,
      event_id: data.event_id,
      event_name: event.name || '',
      event_image: event.image_url || null,
      event_date: event.event_date || '',
      event_time: event.event_time || '',
      venue_name: event.venue_name || null,
      venue_address: event.venue_address || null,
      city: event.city || null,
      ticket_type: data.ticket_type || ticketType.code || '',
      ticket_type_name: data.ticket_type_name || ticketType.name || '',
      ticket_category: category,
      section_name: ticketType.name || null,
      section_description: ticketType.description || null,
      status: data.status || 'issued',
      price: typeof data.price === 'string' ? parseFloat(data.price) : (data.price || 0),
      fee: typeof data.fee === 'string' ? parseFloat(data.fee) : (data.fee || 0),
      total: typeof data.total === 'string' ? parseFloat(data.total) : (data.total || 0),
      attendee_name: data.attendee_name || null, // No order join, use ticket's attendee_name
      attendee_email: data.attendee_email || null, // Use ticket's attendee_email
      issued_at: data.issued_at || data.created_at,
      checked_in_at: data.checked_in_at || null,
      expires_at: data.expires_at || data.event_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      qr_code_url: data.qr_code_url || null,
      qr_code_value: data.qr_code_value || data.ticket_id || null,
    };
  } catch (error) {
    console.error('Error in getTicketById:', error);
    return null;
  }
}
