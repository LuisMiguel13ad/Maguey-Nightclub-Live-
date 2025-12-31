/**
 * Event Duplicate Prevention Utility
 * 
 * This utility prevents duplicate events from being created by checking
 * for existing events with the same name and date before insertion.
 */

import { supabase } from "@/integrations/supabase/client";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingEventId?: string;
  existingEventName?: string;
  existingEventDate?: string;
}

/**
 * Check if an event with the same name and date already exists
 * @param eventName - The name of the event to check
 * @param eventDate - The date of the event (YYYY-MM-DD format)
 * @param excludeEventId - Optional event ID to exclude from check (useful when updating)
 * @returns DuplicateCheckResult with duplicate status and existing event info
 */
export async function checkForDuplicateEvent(
  eventName: string,
  eventDate: string,
  excludeEventId?: string
): Promise<DuplicateCheckResult> {
  try {
    let query = supabase
      .from("events")
      .select("id, name, event_date")
      .ilike("name", `%${eventName.trim()}%`)
      .eq("event_date", eventDate);

    // Exclude current event if updating
    if (excludeEventId) {
      query = query.neq("id", excludeEventId);
    }

    const { data: existingEvents, error } = await query;

    if (error) {
      console.warn("Error checking for duplicate events:", error);
      // Return no duplicate if check fails - better to allow than block incorrectly
      return { isDuplicate: false };
    }

    if (existingEvents && existingEvents.length > 0) {
      const duplicate = existingEvents[0];
      return {
        isDuplicate: true,
        existingEventId: duplicate.id,
        existingEventName: duplicate.name,
        existingEventDate: duplicate.event_date,
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error("Error in duplicate check:", error);
    // Return no duplicate on error - better to allow than block incorrectly
    return { isDuplicate: false };
  }
}

/**
 * Get a user-friendly error message for duplicate events
 * @param result - The DuplicateCheckResult from checkForDuplicateEvent
 * @returns A formatted error message string
 */
export function getDuplicateErrorMessage(result: DuplicateCheckResult): string {
  if (!result.isDuplicate) {
    return "";
  }

  return `Duplicate event detected! An event with the name "${result.existingEventName}" and date ${result.existingEventDate} already exists (ID: ${result.existingEventId}). Please edit the existing event instead of creating a duplicate.`;
}

