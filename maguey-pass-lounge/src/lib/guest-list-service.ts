/**
 * Guest List Management Service
 * 
 * Handles guest list creation, guest entry management, and check-in operations.
 */

import { supabase } from './supabase';
import { Result, ok, err } from './result';

export interface GuestListEntry {
  id: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  plusOnes: number;
  notes?: string;
  status: 'pending' | 'checked_in' | 'no_show' | 'cancelled';
  checkedInAt?: Date;
  checkedInBy?: string;
  actualPlusOnes?: number;
  addedByName?: string;
  listType: 'vip' | 'comp' | 'reduced' | 'standard';
  coverCharge: number;
  listName?: string;
  guestListId: string;
}

export interface GuestList {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  listType: 'vip' | 'comp' | 'reduced' | 'standard';
  maxGuests?: number;
  closesAt?: Date;
  coverCharge: number;
  isActive: boolean;
  totalGuests: number;
  totalPlusOnes: number;
  checkedInCount: number;
  totalArrived: number;
  eventTitle?: string;
  eventDate?: Date;
}

/**
 * Create a new guest list for an event
 */
export async function createGuestList(
  eventId: string,
  data: {
    name: string;
    description?: string;
    listType: 'vip' | 'comp' | 'reduced' | 'standard';
    maxGuests?: number;
    closesAt?: Date;
    coverCharge?: number;
  }
): Promise<Result<GuestList, Error>> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return err(new Error('User not authenticated'));
    }

    const { data: guestList, error } = await supabase
      .from('guest_lists')
      .insert({
        event_id: eventId,
        name: data.name,
        description: data.description,
        list_type: data.listType,
        max_guests: data.maxGuests,
        closes_at: data.closesAt?.toISOString(),
        cover_charge: data.coverCharge ?? 0,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (error) {
      return err(new Error(`Failed to create guest list: ${error.message}`));
    }

    // Fetch with summary data
    const { data: summary } = await supabase
      .from('guest_list_summary')
      .select('*')
      .eq('id', guestList.id)
      .single();

    return ok(mapGuestListFromDb(guestList, summary));
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Add a guest to a list
 */
export async function addGuest(
  guestListId: string,
  data: {
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    plusOnes?: number;
    notes?: string;
    addedByName?: string;
    source?: string;
  }
): Promise<Result<GuestListEntry, Error>> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return err(new Error('User not authenticated'));
    }

    // Get guest list to include list type and cover charge
    const { data: guestList, error: listError } = await supabase
      .from('guest_lists')
      .select('list_type, cover_charge')
      .eq('id', guestListId)
      .single();

    if (listError) {
      return err(new Error(`Guest list not found: ${listError.message}`));
    }

    const { data: entry, error } = await supabase
      .from('guest_list_entries')
      .insert({
        guest_list_id: guestListId,
        guest_name: data.guestName.trim(),
        guest_email: data.guestEmail?.trim() || null,
        guest_phone: data.guestPhone?.trim() || null,
        plus_ones: data.plusOnes ?? 0,
        notes: data.notes?.trim() || null,
        added_by: userData.user.id,
        added_by_name: data.addedByName || userData.user.email || 'Unknown',
        source: data.source || 'admin',
      })
      .select()
      .single();

    if (error) {
      // Check for duplicate error
      if (error.code === '23505') {
        return err(new Error('Guest already exists on this list'));
      }
      return err(new Error(`Failed to add guest: ${error.message}`));
    }

    return ok(mapGuestEntryFromDb(entry, guestList.list_type, guestList.cover_charge));
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Bulk add guests (CSV import or pasted names)
 */
export async function addGuestsBulk(
  guestListId: string,
  guests: Array<{
    guestName: string;
    plusOnes?: number;
    notes?: string;
  }>,
  addedByName: string
): Promise<Result<{ added: number; duplicates: number }, Error>> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return err(new Error('User not authenticated'));
    }

    // Get guest list
    const { data: guestList } = await supabase
      .from('guest_lists')
      .select('list_type, cover_charge')
      .eq('id', guestListId)
      .single();

    if (!guestList) {
      return err(new Error('Guest list not found'));
    }

    let added = 0;
    let duplicates = 0;

    // Insert guests one by one to handle duplicates gracefully
    for (const guest of guests) {
      const { error } = await supabase
        .from('guest_list_entries')
        .insert({
          guest_list_id: guestListId,
          guest_name: guest.guestName.trim(),
          plus_ones: guest.plusOnes ?? 0,
          notes: guest.notes?.trim() || null,
          added_by: userData.user.id,
          added_by_name: addedByName,
          source: 'bulk_import',
        });

      if (error) {
        if (error.code === '23505') {
          duplicates++;
        } else {
          // Log error but continue
          console.error('Error adding guest:', error);
        }
      } else {
        added++;
      }
    }

    return ok({ added, duplicates });
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Get all guest lists for an event
 */
export async function getEventGuestLists(
  eventId: string
): Promise<Result<GuestList[], Error>> {
  try {
    const { data: lists, error } = await supabase
      .from('guest_list_summary')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      return err(new Error(`Failed to fetch guest lists: ${error.message}`));
    }

    return ok((lists || []).map(mapGuestListFromSummary));
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Get guests on a specific list
 */
export async function getGuestListEntries(
  guestListId: string,
  options?: {
    status?: 'pending' | 'checked_in' | 'no_show' | 'cancelled';
    search?: string;
  }
): Promise<Result<GuestListEntry[], Error>> {
  try {
    // Get guest list for type and cover charge
    const { data: guestList } = await supabase
      .from('guest_lists')
      .select('list_type, cover_charge, name')
      .eq('id', guestListId)
      .single();

    if (!guestList) {
      return err(new Error('Guest list not found'));
    }

    let query = supabase
      .from('guest_list_entries')
      .select('*')
      .eq('guest_list_id', guestListId)
      .order('guest_name', { ascending: true });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.search) {
      query = query.ilike('guest_name', `%${options.search}%`);
    }

    const { data: entries, error } = await query;

    if (error) {
      return err(new Error(`Failed to fetch guest entries: ${error.message}`));
    }

    return ok(
      (entries || []).map((entry) =>
        mapGuestEntryFromDb(entry, guestList.list_type, guestList.cover_charge, guestList.name)
      )
    );
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Search across all lists for an event (for door staff)
 */
export async function searchEventGuests(
  eventId: string,
  searchTerm: string
): Promise<Result<GuestListEntry[], Error>> {
  try {
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
        plusOnes: row.plus_ones,
        notes: row.notes,
        status: row.status,
        listType: row.list_type,
        coverCharge: Number(row.cover_charge),
        addedByName: row.added_by_name,
        listName: row.list_name,
        guestListId: '', // Not returned by function
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
  checkedInBy: string,
  actualPlusOnes?: number
): Promise<Result<GuestListEntry, Error>> {
  try {
    const { data: entry, error } = await supabase.rpc('check_in_guest', {
      p_entry_id: entryId,
      p_checked_in_by: checkedInBy,
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

    return ok(
      mapGuestEntryFromDb(
        entry,
        guestList?.list_type || 'standard',
        Number(guestList?.cover_charge) || 0,
        guestList?.name
      )
    );
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Remove a guest from list (mark as cancelled)
 */
export async function removeGuest(entryId: string): Promise<Result<void, Error>> {
  try {
    const { error } = await supabase
      .from('guest_list_entries')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', entryId);

    if (error) {
      return err(new Error(`Failed to remove guest: ${error.message}`));
    }

    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Get guest list stats for an event
 */
export async function getGuestListStats(
  eventId: string
): Promise<
  Result<
    {
      totalLists: number;
      totalGuests: number;
      totalPlusOnes: number;
      checkedIn: number;
      pending: number;
      byListType: Record<string, { count: number; checkedIn: number }>;
    },
    Error
  >
> {
  try {
    const { data: entries, error } = await supabase
      .from('guest_list_entries')
      .select('status, plus_ones, actual_plus_ones, guest_lists!inner(list_type, event_id)')
      .eq('guest_lists.event_id', eventId)
      .neq('status', 'cancelled');

    if (error) {
      return err(new Error(`Failed to fetch stats: ${error.message}`));
    }

    const { data: lists } = await supabase
      .from('guest_lists')
      .select('id')
      .eq('event_id', eventId);

    const stats = {
      totalLists: lists?.length || 0,
      totalGuests: entries?.length || 0,
      totalPlusOnes: entries?.reduce((sum, e) => sum + (e.plus_ones || 0), 0) || 0,
      checkedIn: entries?.filter((e) => e.status === 'checked_in').length || 0,
      pending: entries?.filter((e) => e.status === 'pending').length || 0,
      byListType: {} as Record<string, { count: number; checkedIn: number }>,
    };

    // Group by list type
    entries?.forEach((entry: any) => {
      const listType = entry.guest_lists?.list_type || 'standard';
      if (!stats.byListType[listType]) {
        stats.byListType[listType] = { count: 0, checkedIn: 0 };
      }
      stats.byListType[listType].count++;
      if (entry.status === 'checked_in') {
        stats.byListType[listType].checkedIn++;
      }
    });

    return ok(stats);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

// Helper functions to map database rows to TypeScript interfaces

function mapGuestListFromDb(row: any, summary?: any): GuestList {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    description: row.description,
    listType: row.list_type,
    maxGuests: row.max_guests,
    closesAt: row.closes_at ? new Date(row.closes_at) : undefined,
    coverCharge: Number(row.cover_charge || 0),
    isActive: row.is_active,
    totalGuests: summary?.total_guests || 0,
    totalPlusOnes: summary?.total_plus_ones || 0,
    checkedInCount: summary?.checked_in_count || 0,
    totalArrived: summary?.total_arrived || 0,
    eventTitle: summary?.event_title,
    eventDate: summary?.event_date ? new Date(summary.event_date) : undefined,
  };
}

function mapGuestListFromSummary(row: any): GuestList {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    listType: row.list_type,
    maxGuests: row.max_guests,
    closesAt: row.closes_at ? new Date(row.closes_at) : undefined,
    coverCharge: Number(row.cover_charge || 0),
    isActive: row.is_active,
    totalGuests: row.total_guests || 0,
    totalPlusOnes: row.total_plus_ones || 0,
    checkedInCount: row.checked_in_count || 0,
    totalArrived: row.total_arrived || 0,
    eventTitle: row.event_title,
    eventDate: row.event_date ? new Date(row.event_date) : undefined,
  };
}

function mapGuestEntryFromDb(
  row: any,
  listType: string,
  coverCharge: number,
  listName?: string
): GuestListEntry {
  return {
    id: row.id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    plusOnes: row.plus_ones || 0,
    notes: row.notes,
    status: row.status,
    checkedInAt: row.checked_in_at ? new Date(row.checked_in_at) : undefined,
    checkedInBy: row.checked_in_by,
    actualPlusOnes: row.actual_plus_ones,
    addedByName: row.added_by_name,
    listType: listType as any,
    coverCharge: Number(coverCharge),
    listName,
    guestListId: row.guest_list_id,
  };
}
