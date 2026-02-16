import { supabase } from '@/lib/supabase';

export interface TicketValidationResult {
  success: boolean;
  ticket?: {
    id: string;
    order_id: string;
    event_id: string;
    attendee_name: string;
    attendee_email: string | null;
    qr_code_value: string | null;
    qr_token: string;
    status: string;
    is_used: boolean;
    scanned_at: string | null;
    event_name: string | null;
    ticket_type: string | null;
    orders?: {
      purchaser_name: string | null;
      purchaser_email: string;
      total: number;
    };
    events?: {
      name: string;
      event_date: string;
      event_time: string | null;
      venue_name: string | null;
      venue_address: string | null;
    };
  };
  error?: string;
  message?: string;
}

/**
 * Validate a ticket by QR code or token
 * @param qrCode - The QR code value or token from the ticket
 * @param scannerId - Optional ID of the staff member scanning (user ID)
 * @returns Validation result with ticket details or error
 */
export async function validateTicket(
  qrCode: string,
  scannerId?: string
): Promise<TicketValidationResult> {
  try {
    // Parse QR code if it's in format: MAG-{orderId}|{eventName}|{eventDate}
    const parts = qrCode.split('|');
    const orderIdPart = parts[0];
    
    // Try to find ticket by qr_code_value or qr_token
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        orders (
          purchaser_name,
          purchaser_email,
          total,
          status
        ),
        events (
          name,
          event_date,
          event_time,
          venue_name,
          venue_address
        )
      `)
      .or(`qr_code_value.eq."${qrCode}",qr_token.eq."${qrCode}"`)
      .maybeSingle();

    if (ticketError) {
      console.error('Error querying ticket:', ticketError);
      await logScan(qrCode, scannerId, 'failure', 'Database error');
      return {
        success: false,
        error: 'Database error',
        message: 'An error occurred while validating the ticket.'
      };
    }

    if (!ticket) {
      await logScan(qrCode, scannerId, 'failure', 'Ticket not found');
      return {
        success: false,
        error: 'Invalid ticket code',
        message: 'This ticket code is not recognized in our system.'
      };
    }

    // Check if ticket is already used
    if (ticket.is_used) {
      await logScan(qrCode, scannerId, 'failure', 'Ticket already used', ticket.id);
      return {
        success: false,
        error: 'Ticket already used',
        message: ticket.scanned_at
          ? `This ticket was already scanned on ${new Date(ticket.scanned_at).toLocaleString()}`
          : 'This ticket has already been used.'
      };
    }

    // Check ticket status
    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      await logScan(qrCode, scannerId, 'failure', `Ticket ${ticket.status}`, ticket.id);
      return {
        success: false,
        error: `Ticket ${ticket.status}`,
        message: `This ticket has been ${ticket.status} and is no longer valid.`
      };
    }

    // Validate event date (ticket can only be used on event day)
    if (ticket.events?.event_date) {
      const eventDate = new Date(ticket.events.event_date);
      const today = new Date();
      const isEventDay = 
        eventDate.getFullYear() === today.getFullYear() &&
        eventDate.getMonth() === today.getMonth() &&
        eventDate.getDate() === today.getDate();

      if (!isEventDay) {
        await logScan(qrCode, scannerId, 'failure', 'Wrong event date', ticket.id);
        return {
          success: false,
          error: 'Invalid event date',
          message: `This ticket is only valid for ${eventDate.toLocaleDateString()}, not today.`
        };
      }
    }

    // Check order status
    if (ticket.orders && ticket.orders.status !== 'paid') {
      await logScan(qrCode, scannerId, 'failure', 'Order not paid', ticket.id);
      return {
        success: false,
        error: 'Order not paid',
        message: 'This ticket is associated with an unpaid order.'
      };
    }

    // Mark ticket as used
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        is_used: true,
        scanned_at: new Date().toISOString(),
        current_status: 'inside',
        entry_count: (ticket.entry_count || 0) + 1,
        last_entry_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', ticket.id);

    if (updateError) {
      console.error('Error updating ticket:', updateError);
      await logScan(qrCode, scannerId, 'failure', 'Failed to update ticket', ticket.id);
      return {
        success: false,
        error: 'Processing error',
        message: 'An error occurred while processing the ticket.'
      };
    }

    // Log successful scan
    await logScan(qrCode, scannerId, 'success', undefined, ticket.id);
    await logScanHistory(ticket.id, scannerId, 'entry');

    return {
      success: true,
      ticket: {
        ...ticket,
        is_used: true,
        scanned_at: new Date().toISOString()
      },
      message: 'Ticket validated successfully!'
    };
  } catch (error) {
    console.error('Ticket validation error:', error);
    await logScan(qrCode, scannerId, 'failure', 'Unexpected error');
    return {
      success: false,
      error: 'Validation error',
      message: 'An unexpected error occurred while validating the ticket.'
    };
  }
}

/**
 * Log a scan attempt to ticket_scan_logs table
 */
async function logScan(
  qrCode: string,
  scannerId?: string,
  result: 'success' | 'failure' = 'failure',
  error?: string,
  ticketId?: string
): Promise<void> {
  try {
    await supabase.from('ticket_scan_logs').insert({
      ticket_id: ticketId || null,
      scanned_by: scannerId || null,
      scan_source: 'scanner-app',
      scan_result: result,
      metadata: error ? { error } : {}
    });
  } catch (error) {
    console.error('Error logging scan:', error);
    // Don't throw - logging failures shouldn't break the validation flow
  }
}

/**
 * Log scan history for entry/exit tracking
 */
async function logScanHistory(
  ticketId: string,
  scannerId?: string,
  scanType: 'entry' | 'exit' = 'entry'
): Promise<void> {
  try {
    await supabase.from('scan_history').insert({
      ticket_id: ticketId,
      scanned_by: scannerId || null,
      scan_type: scanType,
      device_id: typeof window !== 'undefined' ? navigator.userAgent : null
    });
  } catch (error) {
    console.error('Error logging scan history:', error);
    // Don't throw - logging failures shouldn't break the validation flow
  }
}

/**
 * Get scan statistics for today
 */
export async function getScanStats(date?: string): Promise<{
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  successRate: number;
}> {
  try {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: scans, error } = await supabase
      .from('ticket_scan_logs')
      .select('scan_result')
      .gte('scanned_at', startOfDay.toISOString())
      .lte('scanned_at', endOfDay.toISOString());

    if (error) {
      console.error('Error fetching scan stats:', error);
      return {
        totalScans: 0,
        successfulScans: 0,
        failedScans: 0,
        successRate: 0
      };
    }

    const totalScans = scans?.length || 0;
    const successfulScans = scans?.filter(s => s.scan_result === 'success').length || 0;
    const failedScans = totalScans - successfulScans;
    const successRate = totalScans > 0 ? (successfulScans / totalScans) * 100 : 0;

    return {
      totalScans,
      successfulScans,
      failedScans,
      successRate
    };
  } catch (error) {
    console.error('Error getting scan stats:', error);
    return {
      totalScans: 0,
      successfulScans: 0,
      failedScans: 0,
      successRate: 0
    };
  }
}

/**
 * Get recent scan history
 */
export async function getScanHistory(limit: number = 50): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('ticket_scan_logs')
      .select(`
        *,
        tickets (
          order_id,
          attendee_name,
          events (
            name
          )
        )
      `)
      .order('scanned_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching scan history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting scan history:', error);
    return [];
  }
}

