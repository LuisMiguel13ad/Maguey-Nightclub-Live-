/**
 * ID Verification Service
 * Handles ID verification logic for legal compliance
 */

import { supabase } from '@/integrations/supabase/client';

export type VerificationType = '18+' | '21+' | 'custom' | 'none';

export interface IDVerification {
  id: string;
  ticket_id: string;
  verification_type: VerificationType;
  verified_by: string | null;
  verified_at: string;
  id_number: string | null;
  photo_url: string | null;
  notes: string | null;
  is_verified: boolean;
  skipped: boolean;
  created_at: string;
}

export interface IDVerificationInput {
  ticketId: string;
  verificationType: VerificationType;
  verifiedBy?: string;
  idNumber?: string;
  photoUrl?: string;
  notes?: string;
  isVerified?: boolean;
  skipped?: boolean;
}

/**
 * Check if a ticket type requires ID verification
 * @param ticketTypeId - The ticket type ID to check
 * @returns Promise<boolean> - true if ID verification is required
 */
export async function requiresIDVerification(ticketTypeId: string | null | undefined): Promise<boolean> {
  if (!ticketTypeId) return false;

  try {
    const { data, error } = await supabase
      .from('ticket_types')
      .select('id_verification_required')
      .eq('id', ticketTypeId)
      .maybeSingle();

    if (error || !data) {
      // If ticket_types table doesn't exist or column doesn't exist, check metadata
      // Fallback: check if ticket type name suggests ID requirement
      return false;
    }

    return data.id_verification_required === true;
  } catch (error) {
    console.error('Error checking ID verification requirement:', error);
    return false;
  }
}

/**
 * Check if a ticket requires ID verification based on ticket object
 * @param ticket - Ticket object with ticket_type_id or ticket_type
 * @returns Promise<boolean> - true if ID verification is required
 */
export async function checkIDVerificationRequired(ticket: any): Promise<boolean> {
  if (!ticket) return false;

  // First try to check by ticket_type_id
  if (ticket.ticket_type_id) {
    return await requiresIDVerification(ticket.ticket_type_id);
  }

  // Fallback: check by ticket type name
  const ticketTypeName = ticket.ticket_types?.name || ticket.ticket_type;
  return checkIDRequirementByName(ticketTypeName);
}

/**
 * Check if a ticket requires ID verification based on ticket type name
 * Fallback method when ticket_types table is not available
 * @param ticketTypeName - The ticket type name
 * @returns boolean - true if likely requires ID verification
 */
export function checkIDRequirementByName(ticketTypeName: string | null | undefined): boolean {
  if (!ticketTypeName) return false;
  
  const name = ticketTypeName.toLowerCase();
  // Common patterns that suggest ID requirement
  return name.includes('21+') || 
         name.includes('18+') || 
         name.includes('alcohol') ||
         name.includes('bar') ||
         name.includes('drink');
}

/**
 * Create an ID verification record
 * @param input - Verification input data
 * @returns Promise<IDVerification> - Created verification record
 */
export async function createIDVerification(input: IDVerificationInput): Promise<IDVerification> {
  const { data: { user } } = await supabase.auth.getUser();
  const verifiedBy = input.verifiedBy || user?.id || null;

  const verificationData: any = {
    ticket_id: input.ticketId,
    verification_type: input.verificationType,
    verified_by: verifiedBy,
    id_number: input.idNumber || null,
    photo_url: input.photoUrl || null,
    notes: input.notes || null,
    is_verified: input.isVerified !== undefined ? input.isVerified : true,
    skipped: input.skipped || false,
  };

  const { data, error } = await supabase
    .from('id_verifications')
    .insert(verificationData)
    .select()
    .single();

  if (error) {
    console.error('Error creating ID verification:', error);
    throw new Error(`Failed to create ID verification: ${error.message}`);
  }

  // Update ticket with verification status
  await updateTicketVerificationStatus(
    input.ticketId,
    verificationData.is_verified,
    verificationData.verification_type,
    verifiedBy
  );

  return data as IDVerification;
}

/**
 * Update ticket verification status
 * @param ticketId - Ticket ID
 * @param isVerified - Whether ID was verified
 * @param verificationType - Type of verification
 * @param verifiedBy - User ID who verified
 */
async function updateTicketVerificationStatus(
  ticketId: string,
  isVerified: boolean,
  verificationType: VerificationType,
  verifiedBy: string | null
): Promise<void> {
  const updateData: any = {
    id_verified: isVerified,
    id_verified_at: isVerified ? new Date().toISOString() : null,
    id_verified_by: isVerified ? verifiedBy : null,
    id_verification_type: verificationType,
  };

  const { error } = await supabase
    .from('tickets')
    .update(updateData)
    .eq('id', ticketId);

  if (error) {
    console.error('Error updating ticket verification status:', error);
    // Don't throw - verification record was created successfully
  }
}

/**
 * Skip ID verification with notes
 * @param ticketId - Ticket ID
 * @param notes - Reason for skipping
 * @param verifiedBy - User ID who skipped
 * @returns Promise<IDVerification> - Created verification record
 */
export async function skipIDVerification(
  ticketId: string,
  notes: string,
  verifiedBy?: string
): Promise<IDVerification> {
  return createIDVerification({
    ticketId,
    verificationType: 'none',
    verifiedBy,
    notes,
    isVerified: false,
    skipped: true,
  });
}

/**
 * Get verification history for a ticket
 * @param ticketId - Ticket ID
 * @returns Promise<IDVerification[]> - Verification history
 */
export async function getTicketVerificationHistory(ticketId: string): Promise<IDVerification[]> {
  const { data, error } = await supabase
    .from('id_verifications')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('verified_at', { ascending: false });

  if (error) {
    console.error('Error fetching verification history:', error);
    return [];
  }

  return (data || []) as IDVerification[];
}

/**
 * Get ID verification statistics for dashboard
 * @param eventId - Optional event ID to filter
 * @returns Promise with verification stats
 */
export async function getIDVerificationStats(eventId?: string) {
  let query = supabase
    .from('tickets')
    .select('id_verified, id_verification_type');

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching ID verification stats:', error);
    return {
      total: 0,
      verified: 0,
      notVerified: 0,
      skipped: 0,
      complianceRate: 0,
    };
  }

  const tickets = data || [];
  const total = tickets.length;
  const verified = tickets.filter(t => t.id_verified === true).length;
  const notVerified = tickets.filter(t => t.id_verified === false || t.id_verified === null).length;
  
  // Count skipped verifications
  const { data: skippedData } = await supabase
    .from('id_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('skipped', true);
  
  const skipped = skippedData?.length || 0;

  return {
    total,
    verified,
    notVerified,
    skipped,
    complianceRate: total > 0 ? (verified / total) * 100 : 0,
  };
}

/**
 * Check if ticket is already verified
 * @param ticketId - Ticket ID
 * @returns Promise<boolean> - true if verified
 */
export async function isTicketVerified(ticketId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('tickets')
    .select('id_verified')
    .eq('id', ticketId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return data.id_verified === true;
}

