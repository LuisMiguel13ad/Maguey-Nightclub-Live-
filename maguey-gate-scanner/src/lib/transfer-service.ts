import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { localStorageService } from '@/lib/localStorage';

export interface TicketTransfer {
  id: string;
  ticket_id: string;
  transferred_from_name: string;
  transferred_from_email?: string;
  transferred_to_name: string;
  transferred_to_email?: string;
  transfer_reason?: string;
  transferred_by?: string;
  transferred_at: string;
  metadata?: Record<string, any>;
}

export interface TransferHistory {
  id: string;
  transferred_from_name: string;
  transferred_from_email?: string;
  transferred_to_name: string;
  transferred_to_email?: string;
  transfer_reason?: string;
  transferred_at: string;
}

export interface TicketTransferInfo {
  originalPurchaserName: string | null;
  originalPurchaserEmail: string | null;
  currentHolderName: string | null;
  currentHolderEmail: string | null;
  isTransferred: boolean;
  transferCount: number;
  transferHistory: TransferHistory[];
  nameMatches: boolean;
}

/**
 * Get transfer information for a ticket
 * @param ticketId - Ticket ID or ticket object
 * @returns Promise<TicketTransferInfo>
 */
export const getTicketTransferInfo = async (ticket: any): Promise<TicketTransferInfo> => {
  if (!ticket) {
    return {
      originalPurchaserName: null,
      originalPurchaserEmail: null,
      currentHolderName: null,
      currentHolderEmail: null,
      isTransferred: false,
      transferCount: 0,
      transferHistory: [],
      nameMatches: true,
    };
  }

  const isConfigured = isSupabaseConfigured();

  if (isConfigured) {
    try {
      // Get original purchaser info from ticket
      const originalPurchaserName = ticket.original_purchaser_name || ticket.guest_name || null;
      const originalPurchaserEmail = ticket.original_purchaser_email || ticket.guest_email || null;

      // Get current holder info (from guest_name/guest_email)
      const currentHolderName = ticket.guest_name || null;
      const currentHolderEmail = ticket.guest_email || null;

      // Get transfer count
      const transferCount = ticket.transfer_count || 0;

      // Get transfer history
      const { data: transfers, error: transferError } = await supabase
        .from('ticket_transfers')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('transferred_at', { ascending: false });

      if (transferError) {
        console.error('Error fetching transfer history:', transferError);
      }

      const transferHistory: TransferHistory[] = (transfers || []).map((t: any) => ({
        id: t.id,
        transferred_from_name: t.transferred_from_name,
        transferred_from_email: t.transferred_from_email,
        transferred_to_name: t.transferred_to_name,
        transferred_to_email: t.transferred_to_email,
        transfer_reason: t.transfer_reason,
        transferred_at: t.transferred_at,
      }));

      const isTransferred = transferCount > 0;

      // Check if names match (case-insensitive, trimmed)
      const nameMatches = !originalPurchaserName || !currentHolderName || 
        originalPurchaserName.trim().toLowerCase() === currentHolderName.trim().toLowerCase();

      return {
        originalPurchaserName,
        originalPurchaserEmail,
        currentHolderName,
        currentHolderEmail,
        isTransferred,
        transferCount,
        transferHistory,
        nameMatches,
      };
    } catch (error: any) {
      console.error('getTicketTransferInfo error:', error);
      return {
        originalPurchaserName: ticket.guest_name || null,
        originalPurchaserEmail: ticket.guest_email || null,
        currentHolderName: ticket.guest_name || null,
        currentHolderEmail: ticket.guest_email || null,
        isTransferred: false,
        transferCount: 0,
        transferHistory: [],
        nameMatches: true,
      };
    }
  } else {
    // Local storage mode
    const originalPurchaserName = ticket.guest_name || null;
    const originalPurchaserEmail = ticket.guest_email || null;
    const currentHolderName = ticket.guest_name || null;
    const currentHolderEmail = ticket.guest_email || null;

    // Check metadata for transfer info
    const transferCount = ticket.metadata?.transfer_count || 0;
    const transferHistory = ticket.metadata?.transfer_history || [];

    const isTransferred = transferCount > 0;
    const nameMatches = true; // In local storage, assume matches unless metadata says otherwise

    return {
      originalPurchaserName,
      originalPurchaserEmail,
      currentHolderName,
      currentHolderEmail,
      isTransferred,
      transferCount,
      transferHistory,
      nameMatches,
    };
  }
};

/**
 * Create a ticket transfer record
 * @param ticketId - Ticket ID
 * @param fromName - Name of person transferring from
 * @param fromEmail - Email of person transferring from
 * @param toName - Name of person transferring to
 * @param toEmail - Email of person transferring to
 * @param reason - Optional reason for transfer
 * @param transferredBy - User ID of staff processing transfer
 * @returns Promise<{ success: boolean; error?: string }>
 */
export const createTicketTransfer = async (
  ticketId: string,
  fromName: string,
  fromEmail: string | null,
  toName: string,
  toEmail: string | null,
  reason?: string,
  transferredBy?: string
): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase is not configured',
    };
  }

  try {
    // Get ticket to update
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, guest_name, guest_email')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return {
        success: false,
        error: 'Ticket not found',
      };
    }

    // Create transfer record
    const { error: transferError } = await supabase
      .from('ticket_transfers')
      .insert({
        ticket_id: ticketId,
        transferred_from_name: fromName,
        transferred_from_email: fromEmail,
        transferred_to_name: toName,
        transferred_to_email: toEmail,
        transfer_reason: reason,
        transferred_by: transferredBy,
      });

    if (transferError) {
      console.error('Error creating transfer:', transferError);
      return {
        success: false,
        error: transferError.message,
      };
    }

    // Update ticket with new holder info
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        guest_name: toName,
        guest_email: toEmail,
      })
      .eq('id', ticketId);

    if (updateError) {
      console.error('Error updating ticket:', updateError);
      return {
        success: false,
        error: updateError.message,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('createTicketTransfer error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create transfer',
    };
  }
};

/**
 * Check if ticket holder name matches original purchaser
 * @param ticket - Ticket object
 * @returns Promise<{ matches: boolean; originalName?: string; currentName?: string }>
 */
export const checkNameMatch = async (
  ticket: any
): Promise<{ matches: boolean; originalName?: string; currentName?: string; isTransferred?: boolean }> => {
  const transferInfo = await getTicketTransferInfo(ticket);

  return {
    matches: transferInfo.nameMatches,
    originalName: transferInfo.originalPurchaserName || undefined,
    currentName: transferInfo.currentHolderName || undefined,
    isTransferred: transferInfo.isTransferred,
  };
};




