import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function getEdgeFunctionUrl(functionName: string): string {
  const base = import.meta.env.DEV ? '' : SUPABASE_URL;
  return `${base}/functions/v1/${functionName}`;
}

export interface TicketTransfer {
  id: string;
  ticket_id: string;
  to_email: string;
  to_name: string;
  event_name: string | null;
  ticket_type_name: string | null;
  transferred_at: string;
}

/**
 * Transfer a ticket to a new holder via the transfer-ticket Edge Function.
 * Generates a new QR code server-side and invalidates the old one.
 */
export async function transferTicket(
  ticketId: string,
  currentHolderEmail: string,
  newHolderEmail: string,
  newHolderName: string
): Promise<{ success: boolean; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'Service configuration missing' };
  }

  let response: Response;
  try {
    response = await fetch(getEdgeFunctionUrl('transfer-ticket'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ ticketId, currentHolderEmail, newHolderEmail, newHolderName }),
    });
  } catch {
    return { success: false, error: 'Network error — please check your connection' };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { success: false, error: data.error || 'Transfer failed' };
  }

  return { success: true };
}

/**
 * Fetch tickets this user has transferred to others.
 * Used in Account.tsx "Transferred Tickets" section.
 * RLS ensures only transfers where from_email = current user's JWT email are returned.
 */
export async function getSentTransfers(userEmail: string): Promise<TicketTransfer[]> {
  const { data, error } = await supabase
    .from('ticket_transfers')
    .select('id, ticket_id, to_email, to_name, event_name, ticket_type_name, transferred_at')
    .eq('from_email', userEmail)
    .order('transferred_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch sent transfers:', error);
    return [];
  }

  return data || [];
}
