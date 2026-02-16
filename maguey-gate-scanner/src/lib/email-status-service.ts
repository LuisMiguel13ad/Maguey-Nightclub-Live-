import { supabase } from '@/integrations/supabase/client';

export interface EmailQueueStatus {
  id: string;
  email_type: 'ga_ticket' | 'vip_confirmation';
  status: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed';
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  recipient_email?: string;
  subject?: string;
  related_id?: string;
}

/**
 * Get email status for a ticket by order_id
 */
export async function getTicketEmailStatus(orderId: string): Promise<EmailQueueStatus | null> {
  const { data, error } = await supabase
    .from('email_queue')
    .select('id, email_type, status, attempt_count, last_error, created_at, updated_at')
    .eq('email_type', 'ga_ticket')
    .eq('related_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching ticket email status:', error);
    return null;
  }

  return data as EmailQueueStatus;
}

/**
 * Get email status for a VIP reservation
 */
export async function getReservationEmailStatus(reservationId: string): Promise<EmailQueueStatus | null> {
  const { data, error } = await supabase
    .from('email_queue')
    .select('id, email_type, status, attempt_count, last_error, created_at, updated_at')
    .eq('email_type', 'vip_confirmation')
    .eq('related_id', reservationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching reservation email status:', error);
    return null;
  }

  return data as EmailQueueStatus;
}

/**
 * Get all email statuses for display (recent emails with their status)
 */
export async function getRecentEmailStatuses(limit: number = 50): Promise<EmailQueueStatus[]> {
  const { data, error } = await supabase
    .from('email_queue')
    .select('id, email_type, status, attempt_count, last_error, created_at, updated_at, recipient_email, subject, related_id')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent email statuses:', error);
    return [];
  }

  return data as EmailQueueStatus[];
}

/**
 * Retry a failed email by resetting it to pending
 */
export async function retryFailedEmail(emailId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('email_queue')
    .update({
      status: 'pending',
      attempt_count: 0,
      next_retry_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', emailId)
    .eq('status', 'failed');  // Only retry if currently failed

  if (error) {
    console.error('Error retrying email:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get email status badge color (Tailwind classes)
 */
export function getEmailStatusColor(status: string): string {
  switch (status) {
    case 'delivered':
      return 'bg-green-100 text-green-800';
    case 'sent':
      return 'bg-blue-100 text-blue-800';
    case 'pending':
    case 'processing':
      return 'bg-yellow-100 text-yellow-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get human-readable status label
 */
export function getEmailStatusLabel(status: string): string {
  switch (status) {
    case 'delivered':
      return 'Delivered';
    case 'sent':
      return 'Sent';
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Sending...';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}
