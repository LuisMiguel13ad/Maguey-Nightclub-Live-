import { supabase } from './supabase';

export type ReEntryMode = 'single' | 'reentry' | 'exit_tracking';

export interface ScanHistoryEntry {
  id: string;
  ticket_id: string;
  user_id: string | null;
  scan_type: 'entry' | 'exit';
  scanned_at: string;
  scanned_by: string | null;
  device_id: string | null;
  notes: string | null;
}

export interface TicketReEntryStatus {
  currentStatus: 'inside' | 'outside' | 'left';
  entryCount: number;
  exitCount: number;
  lastEntryAt: string | null;
  lastExitAt: string | null;
  scanHistory: ScanHistoryEntry[];
}

/**
 * Get re-entry mode for an event (defaults to 'single' if not set)
 */
export const getReEntryMode = async (eventId?: string): Promise<ReEntryMode> => {
  // For now, we'll use a default mode. In the future, this could be stored per-event
  // Check localStorage for user preference
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('scanner_reentry_mode');
    if (stored && ['single', 'reentry', 'exit_tracking'].includes(stored)) {
      return stored as ReEntryMode;
    }
  }
  
  return 'single'; // Default to single entry
};

/**
 * Set re-entry mode
 */
export const setReEntryMode = (mode: ReEntryMode): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('scanner_reentry_mode', mode);
  }
};

/**
 * Log a scan to scan_history table
 */
export const logScanHistory = async (
  ticketId: string,
  scanType: 'entry' | 'exit',
  scannedBy?: string,
  deviceId?: string,
  notes?: string
): Promise<ScanHistoryEntry | null> => {
  try {
    const { data, error } = await supabase
      .from('scan_history')
      .insert({
        ticket_id: ticketId,
        scan_type: scanType,
        scanned_at: new Date().toISOString(),
        scanned_by: scannedBy || null,
        device_id: deviceId || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[re-entry] Failed to log scan history:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[re-entry] Error logging scan history:', error);
    return null;
  }
};

/**
 * Get scan history for a ticket
 */
export const getTicketScanHistory = async (ticketId: string): Promise<ScanHistoryEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('scan_history')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('scanned_at', { ascending: false });

    if (error) {
      console.error('[re-entry] Failed to get scan history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[re-entry] Error getting scan history:', error);
    return [];
  }
};

/**
 * Get re-entry status for a ticket
 */
export const getTicketReEntryStatus = async (ticketId: string): Promise<TicketReEntryStatus> => {
  try {
    // Get ticket current status
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('current_status, entry_count, exit_count, last_entry_at, last_exit_at')
      .eq('id', ticketId)
      .maybeSingle();

    if (ticketError) {
      console.error('[re-entry] Failed to get ticket status:', ticketError);
    }

    // Get scan history
    const scanHistory = await getTicketScanHistory(ticketId);

    return {
      currentStatus: (ticket?.current_status as 'inside' | 'outside' | 'left') || 'outside',
      entryCount: ticket?.entry_count || 0,
      exitCount: ticket?.exit_count || 0,
      lastEntryAt: ticket?.last_entry_at || null,
      lastExitAt: ticket?.last_exit_at || null,
      scanHistory,
    };
  } catch (error) {
    console.error('[re-entry] Error getting re-entry status:', error);
    return {
      currentStatus: 'outside',
      entryCount: 0,
      exitCount: 0,
      lastEntryAt: null,
      lastExitAt: null,
      scanHistory: [],
    };
  }
};

/**
 * Update ticket status for re-entry
 */
export const updateTicketReEntryStatus = async (
  ticketId: string,
  scanType: 'entry' | 'exit',
  scannedBy?: string,
  deviceId?: string
): Promise<boolean> => {
  try {
    const now = new Date().toISOString();
    
    // Get current ticket status
    const { data: ticket, error: fetchError } = await supabase
      .from('tickets')
      .select('current_status, entry_count, exit_count')
      .eq('id', ticketId)
      .maybeSingle();

    if (fetchError || !ticket) {
      console.error('[re-entry] Failed to fetch ticket:', fetchError);
      return false;
    }

    const currentStatus = (ticket.current_status as 'inside' | 'outside' | 'left') || 'outside';
    const entryCount = ticket.entry_count || 0;
    const exitCount = ticket.exit_count || 0;

    let newStatus: 'inside' | 'outside' | 'left';
    let newEntryCount = entryCount;
    let newExitCount = exitCount;
    let lastEntryAt = ticket.last_entry_at;
    let lastExitAt = ticket.last_exit_at;

    if (scanType === 'entry') {
      newStatus = 'inside';
      newEntryCount = entryCount + 1;
      lastEntryAt = now;
    } else {
      // exit
      if (currentStatus === 'inside') {
        newStatus = 'outside';
        newExitCount = exitCount + 1;
        lastExitAt = now;
      } else {
        // Already outside, don't change
        newStatus = currentStatus;
      }
    }

    // Update ticket
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        current_status: newStatus,
        entry_count: newEntryCount,
        exit_count: newExitCount,
        last_entry_at: lastEntryAt,
        last_exit_at: lastExitAt,
        scanned_at: scanType === 'entry' ? now : ticket.scanned_at, // Only update scanned_at on first entry
      })
      .eq('id', ticketId);

    if (updateError) {
      console.error('[re-entry] Failed to update ticket status:', updateError);
      return false;
    }

    // Log to scan history
    await logScanHistory(ticketId, scanType, scannedBy, deviceId);

    return true;
  } catch (error) {
    console.error('[re-entry] Error updating ticket status:', error);
    return false;
  }
};

/**
 * Get count of tickets currently inside venue
 */
export const getCurrentlyInsideCount = async (eventId?: string): Promise<number> => {
  try {
    let query = supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('current_status', 'inside');

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    const { count, error } = await query;

    if (error) {
      console.error('[re-entry] Failed to get inside count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[re-entry] Error getting inside count:', error);
    return 0;
  }
};

/**
 * Check if re-entry is allowed for a ticket
 */
export const isReEntryAllowed = async (
  ticketId: string,
  mode: ReEntryMode
): Promise<boolean> => {
  if (mode === 'single') {
    return false; // Single entry mode - no re-entry
  }

  // For reentry and exit_tracking modes, re-entry is allowed
  // Additional checks could be added here (e.g., max re-entries, time limits)
  return true;
};

/**
 * Determine scan type based on current status and mode
 */
export const determineScanType = async (
  ticketId: string,
  mode: ReEntryMode
): Promise<'entry' | 'exit'> => {
  if (mode === 'single') {
    return 'entry'; // Single entry mode always uses entry
  }

  // Get current status
  const { data: ticket } = await supabase
    .from('tickets')
    .select('current_status')
    .eq('id', ticketId)
    .maybeSingle();

  const currentStatus = (ticket?.current_status as 'inside' | 'outside' | 'left') || 'outside';

  // If inside, next scan is exit; if outside, next scan is entry
  return currentStatus === 'inside' ? 'exit' : 'entry';
};

