import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { scanTicket } from './scanner-service';
import type { TicketTransferInfo } from './transfer-service';
import type { RefundInfo } from './refund-service';

export interface QueuedTicket {
  id: string;
  ticket: any;
  ticketId: string;
  guestName?: string;
  ticketType: string;
  eventName: string;
  status: 'pending' | 'valid' | 'invalid' | 'used';
  message: string;
  transferInfo?: TicketTransferInfo;
  refundInfo?: RefundInfo;
  scannedAt: Date;
  orderId?: string; // For group detection
}

export interface BatchGroup {
  orderId: string;
  tickets: QueuedTicket[];
  partySize: number;
  customerName?: string;
  customerEmail?: string;
}

/**
 * Detect if tickets belong to the same group (same order)
 */
export const detectTicketGroups = (queuedTickets: QueuedTicket[]): BatchGroup[] => {
  const groupsMap = new Map<string, QueuedTicket[]>();

  // Group tickets by order_id
  queuedTickets.forEach(ticket => {
    if (ticket.orderId) {
      if (!groupsMap.has(ticket.orderId)) {
        groupsMap.set(ticket.orderId, []);
      }
      groupsMap.get(ticket.orderId)!.push(ticket);
    }
  });

  // Convert to BatchGroup array
  const groups: BatchGroup[] = [];
  groupsMap.forEach((tickets, orderId) => {
    if (tickets.length > 1) {
      // Only create group if 2+ tickets
      groups.push({
        orderId,
        tickets,
        partySize: tickets.length,
        customerName: tickets[0].ticket?.guest_name || tickets[0].ticket?.original_purchaser_name,
        customerEmail: tickets[0].ticket?.guest_email || tickets[0].ticket?.original_purchaser_email,
      });
    }
  });

  return groups;
};

/**
 * Get total party size for a ticket (count tickets in same order)
 */
export const getPartySize = async (ticket: any): Promise<number> => {
  if (!ticket.order_id) return 1;

  const isConfigured = isSupabaseConfigured();
  
  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('id')
        .eq('order_id', ticket.order_id)
        .eq('event_name', ticket.event_name || '');

      if (error) {
        console.error('Error getting party size:', error);
        return 1;
      }

      return data?.length || 1;
    } catch (error) {
      console.error('getPartySize error:', error);
      return 1;
    }
  } else {
    // Local storage mode - check metadata
    return ticket.metadata?.party_size || 1;
  }
};

/**
 * Process all tickets in batch (approve all)
 */
export const approveBatch = async (
  queuedTickets: QueuedTicket[],
  scannedBy?: string
): Promise<{ success: boolean; processed: number; errors: string[] }> => {
  const errors: string[] = [];
  let processed = 0;

  for (const queuedTicket of queuedTickets) {
    // Only process valid tickets
    if (queuedTicket.status === 'valid') {
      try {
        const isConfigured = isSupabaseConfigured();
        
        if (isConfigured) {
          // Use ticket.id (database ID) not queuedTicket.id (queue ID)
          const ticketId = queuedTicket.ticket?.id;
          if (!ticketId) {
            errors.push(`${queuedTicket.ticketId}: Ticket ID not found`);
            continue;
          }
          
          const result = await scanTicket(ticketId, scannedBy);
          if (result.success) {
            processed++;
          } else {
            errors.push(`${queuedTicket.ticketId}: ${result.error}`);
          }
        } else {
          // Local storage mode - mark as scanned
          if (queuedTicket.ticket) {
            const nowIso = new Date().toISOString();
            const updatedTicket = {
              ...queuedTicket.ticket,
              status: "scanned",
              is_used: true,
              scanned_at: nowIso,
              scanned_by: scannedBy ?? "batch-user",
            };
            // Save to local storage if available
            const { localStorageService } = await import('./localStorage');
            localStorageService.saveTicket(updatedTicket);
            processed++;
          }
        }
      } catch (error: any) {
        errors.push(`${queuedTicket.ticketId}: ${error.message}`);
      }
    } else {
      errors.push(`${queuedTicket.ticketId}: ${queuedTicket.message}`);
    }
  }

  return {
    success: errors.length === 0,
    processed,
    errors,
  };
};

/**
 * Clear invalid tickets from queue
 */
export const removeInvalidFromQueue = (
  queuedTickets: QueuedTicket[],
  ticketId: string
): QueuedTicket[] => {
  return queuedTickets.filter(t => t.id !== ticketId);
};

