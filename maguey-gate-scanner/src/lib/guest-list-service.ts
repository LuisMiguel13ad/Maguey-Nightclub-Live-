/**
 * Guest List Service for Scanner App
 * 
 * Simplified service focused on check-in operations for door staff.
 */

import { supabase } from './supabase';
import { Result, ok, err } from './result';

export interface GuestSearchResult {
  id: string;
  guestName: string;
  plusOnes: number;
  notes?: string;
  status: 'pending' | 'checked_in';
  listType: 'vip' | 'comp' | 'reduced' | 'standard';
  listName: string;
  coverCharge: number;
  addedByName?: string;
  checkedInAt?: Date;
  actualPlusOnes?: number;
}

/**
 * Search for a guest by name across all lists for an event
 */
export async function searchGuests(
  eventId: string,
  searchTerm: string
): Promise<Result<GuestSearchResult[], Error>> {
  try {
    if (!searchTerm.trim()) {
      return ok([]);
    }

    const { data: results, error } = await supabase.rpc('search_guest_list', {
      p_event_id: eventId,
      p_search_term: searchTerm.trim(),
    });

    if (error) {
      return err(new Error(`Failed to search guests: ${error.message}`));
    }

    return ok(
      (results || []).map((row: any) => ({
        id: row.id,
        guestName: row.guest_name,
        plusOnes: row.plus_ones || 0,
        notes: row.notes,
        status: row.status,
        listType: row.list_type,
        listName: row.list_name,
        coverCharge: Number(row.cover_charge || 0),
        addedByName: row.added_by_name,
      }))
    );
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Check in a guest
 */
export async function checkInGuest(
  entryId: string,
  scannerId: string,
  actualPlusOnes?: number
): Promise<Result<GuestSearchResult, Error>> {
  try {
    const { data: entry, error } = await supabase.rpc('check_in_guest', {
      p_entry_id: entryId,
      p_checked_in_by: scannerId,
      p_actual_plus_ones: actualPlusOnes ?? null,
    });

    if (error) {
      return err(new Error(`Failed to check in guest: ${error.message}`));
    }

    // Get guest list for type and cover charge
    const { data: guestList } = await supabase
      .from('guest_lists')
      .select('list_type, cover_charge, name')
      .eq('id', entry.guest_list_id)
      .single();

    return ok({
      id: entry.id,
      guestName: entry.guest_name,
      plusOnes: entry.plus_ones || 0,
      notes: entry.notes,
      status: 'checked_in',
      listType: guestList?.list_type || 'standard',
      listName: guestList?.name || '',
      coverCharge: Number(guestList?.cover_charge || 0),
      addedByName: entry.added_by_name,
      checkedInAt: entry.checked_in_at ? new Date(entry.checked_in_at) : new Date(),
      actualPlusOnes: entry.actual_plus_ones,
    });
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Get recent check-ins for this event
 */
export async function getRecentCheckIns(
  eventId: string,
  limit: number = 10
): Promise<Result<GuestSearchResult[], Error>> {
  try {
    const { data: entries, error } = await supabase
      .from('guest_list_entries')
      .select(`
        id,
        guest_name,
        plus_ones,
        actual_plus_ones,
        notes,
        status,
        checked_in_at,
        added_by_name,
        guest_lists!inner(
          list_type,
          cover_charge,
          name,
          event_id
        )
      `)
      .eq('guest_lists.event_id', eventId)
      .eq('status', 'checked_in')
      .order('checked_in_at', { ascending: false })
      .limit(limit);

    if (error) {
      return err(new Error(`Failed to fetch recent check-ins: ${error.message}`));
    }

    return ok(
      (entries || []).map((entry: any) => ({
        id: entry.id,
        guestName: entry.guest_name,
        plusOnes: entry.plus_ones || 0,
        notes: entry.notes,
        status: 'checked_in',
        listType: entry.guest_lists?.list_type || 'standard',
        listName: entry.guest_lists?.name || '',
        coverCharge: Number(entry.guest_lists?.cover_charge || 0),
        addedByName: entry.added_by_name,
        checkedInAt: entry.checked_in_at ? new Date(entry.checked_in_at) : undefined,
        actualPlusOnes: entry.actual_plus_ones,
      }))
    );
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Subscribe to real-time guest list updates
 */
export function subscribeToGuestListUpdates(
  eventId: string,
  onUpdate: (entry: GuestSearchResult) => void
): () => void {
  // Subscribe to guest_list_entries changes for this event
  const channel = supabase
    .channel(`guest-list-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'guest_list_entries',
        filter: `guest_list_id=in.(SELECT id FROM guest_lists WHERE event_id=eq.${eventId})`,
      },
      async (payload) => {
        // Fetch the updated entry with list details
        const { data: entry } = await supabase
          .from('guest_list_entries')
          .select(`
            id,
            guest_name,
            plus_ones,
            actual_plus_ones,
            notes,
            status,
            checked_in_at,
            added_by_name,
            guest_lists!inner(
              list_type,
              cover_charge,
              name,
              event_id
            )
          `)
          .eq('id', payload.new.id)
          .single();

        if (entry) {
          onUpdate({
            id: entry.id,
            guestName: entry.guest_name,
            plusOnes: entry.plus_ones || 0,
            notes: entry.notes,
            status: entry.status,
            listType: entry.guest_lists?.list_type || 'standard',
            listName: entry.guest_lists?.name || '',
            coverCharge: Number(entry.guest_lists?.cover_charge || 0),
            addedByName: entry.added_by_name,
            checkedInAt: entry.checked_in_at ? new Date(entry.checked_in_at) : undefined,
            actualPlusOnes: entry.actual_plus_ones,
          });
        }
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get all guests for an event (for export)
 */
export async function getAllGuestsForEvent(
  eventId: string
): Promise<Result<GuestSearchResult[], Error>> {
  try {
    const { data: entries, error } = await supabase
      .from('guest_list_entries')
      .select(`
        id,
        guest_name,
        plus_ones,
        actual_plus_ones,
        notes,
        status,
        checked_in_at,
        added_by_name,
        guest_lists!inner(
          list_type,
          cover_charge,
          name,
          event_id
        )
      `)
      .eq('guest_lists.event_id', eventId)
      .order('guest_name', { ascending: true });

    if (error) {
      return err(new Error(`Failed to fetch guests: ${error.message}`));
    }

    return ok(
      (entries || []).map((entry: any) => ({
        id: entry.id,
        guestName: entry.guest_name,
        plusOnes: entry.plus_ones || 0,
        notes: entry.notes,
        status: entry.status,
        listType: entry.guest_lists?.list_type || 'standard',
        listName: entry.guest_lists?.name || '',
        coverCharge: Number(entry.guest_lists?.cover_charge || 0),
        addedByName: entry.added_by_name,
        checkedInAt: entry.checked_in_at ? new Date(entry.checked_in_at) : undefined,
        actualPlusOnes: entry.actual_plus_ones,
      }))
    );
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Export guest list to CSV
 */
export function exportGuestListToCSV(
  guests: GuestSearchResult[],
  eventName: string
): void {
  const headers = [
    'Guest Name',
    'Status',
    'List Type',
    'List Name',
    'Plus Ones',
    'Actual Plus Ones',
    'Cover Charge',
    'Added By',
    'Checked In At',
    'Notes',
  ];

  const rows = guests.map((guest) => [
    guest.guestName,
    guest.status,
    guest.listType,
    guest.listName,
    guest.plusOnes.toString(),
    guest.actualPlusOnes?.toString() || '',
    guest.coverCharge.toString(),
    guest.addedByName || '',
    guest.checkedInAt ? guest.checkedInAt.toLocaleString() : '',
    guest.notes || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `guest-list-${eventName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get guest list stats for an event
 */
export async function getGuestListStats(eventId: string): Promise<{
  total: number;
  checkedIn: number;
  pending: number;
  totalPlusOnes: number;
}> {
  const { data: entries, error } = await supabase
    .from('guest_list_entries')
    .select('status, plus_ones, guest_lists!inner(event_id)')
    .eq('guest_lists.event_id', eventId);

  if (error || !entries) {
    return { total: 0, checkedIn: 0, pending: 0, totalPlusOnes: 0 };
  }

  const total = entries.length;
  const checkedIn = entries.filter((e: any) => e.status === 'checked_in').length;
  const pending = entries.filter((e: any) => e.status === 'pending').length;
  const totalPlusOnes = entries.reduce((sum: number, e: any) => sum + (e.plus_ones || 0), 0);

  return { total, checkedIn, pending, totalPlusOnes };
}
