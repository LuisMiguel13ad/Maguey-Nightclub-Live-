import { supabase } from './supabase';

export interface WaitlistEntry {
  id: string;
  event_name: string;
  ticket_type: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  quantity: number;
  status: 'waiting' | 'notified' | 'converted' | 'cancelled';
  created_at: string;
  notified_at?: string;
  converted_at?: string;
  metadata?: Record<string, unknown>;
}

export interface WaitlistFormData {
  eventName: string;
  ticketType: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  quantity: number;
}

/**
 * Add a customer to the waitlist
 */
export async function addToWaitlist(data: WaitlistFormData): Promise<WaitlistEntry> {
  const { data: entry, error } = await supabase
    .from('waitlist')
    .insert({
      event_name: data.eventName,
      ticket_type: data.ticketType,
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone || null,
      quantity: data.quantity,
      status: 'waiting',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add to waitlist: ${error.message}`);
  }

  return entry;
}

/**
 * Check if email is already on waitlist for an event
 */
export async function isOnWaitlist(eventName: string, email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('waitlist')
    .select('id')
    .eq('event_name', eventName)
    .eq('customer_email', email)
    .eq('status', 'waiting')
    .maybeSingle();

  if (error) {
    console.error('Error checking waitlist:', error);
    return false;
  }

  return !!data;
}

/**
 * Get waitlist entries for an event
 */
export async function getWaitlistEntries(eventName: string): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase
    .from('waitlist')
    .select('*')
    .eq('event_name', eventName)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch waitlist: ${error.message}`);
  }

  return data || [];
}

/**
 * Get waitlist position for a customer
 * Returns the position number (1-based) in the queue for their ticket type
 */
export async function getWaitlistPosition(
  eventName: string,
  ticketType: string,
  email: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('waitlist')
    .select('id, created_at')
    .eq('event_name', eventName)
    .eq('ticket_type', ticketType)
    .in('status', ['waiting', 'notified'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error getting waitlist position:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Find the position of this email
  const position = data.findIndex(entry => {
    // We need to get the email, but we only selected id and created_at
    // So we'll need to refetch or modify the query
    return false; // Will fix this
  });

  // Better approach: get all entries with email, then find position
  const { data: allEntries, error: allError } = await supabase
    .from('waitlist')
    .select('customer_email, created_at')
    .eq('event_name', eventName)
    .eq('ticket_type', ticketType)
    .in('status', ['waiting', 'notified'])
    .order('created_at', { ascending: true });

  if (allError || !allEntries) {
    return null;
  }

  const emailPosition = allEntries.findIndex(entry => entry.customer_email === email);
  return emailPosition >= 0 ? emailPosition + 1 : null; // 1-based position
}

/**
 * Auto-convert waitlist entry when customer purchases tickets
 * Checks if purchaser email matches any waitlist entry for the event
 */
export async function autoConvertWaitlistEntry(
  eventName: string,
  purchaserEmail: string
): Promise<WaitlistEntry | null> {
  // Find waitlist entries for this event and email that are waiting or notified
  const { data: entries, error } = await supabase
    .from('waitlist')
    .select('*')
    .eq('event_name', eventName)
    .eq('customer_email', purchaserEmail)
    .in('status', ['waiting', 'notified'])
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Error finding waitlist entry:', error);
    return null;
  }

  if (!entries || entries.length === 0) {
    return null; // No matching waitlist entry
  }

  const entry = entries[0];

  // Update status to converted
  const { data: updated, error: updateError } = await supabase
    .from('waitlist')
    .update({
      status: 'converted',
      converted_at: new Date().toISOString(),
    })
    .eq('id', entry.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error converting waitlist entry:', updateError);
    return null;
  }

  return updated;
}

