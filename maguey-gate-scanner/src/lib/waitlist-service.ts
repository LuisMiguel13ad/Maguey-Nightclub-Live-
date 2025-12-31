import { supabase } from "@/integrations/supabase/client";

export interface WaitlistEntry {
  id: string;
  event_name: string;
  ticket_type: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  quantity: number;
  status: "waiting" | "notified" | "converted" | "cancelled";
  created_at: string;
  notified_at?: string;
  converted_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Get all waitlist entries
 */
export async function getAllWaitlistEntries(): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching all waitlist entries:", error);
    return [];
  }
  return data || [];
}

/**
 * Update the status of a waitlist entry
 */
export async function updateWaitlistEntryStatus(
  id: string,
  status: WaitlistEntry["status"]
): Promise<WaitlistEntry> {
  const updateData: Partial<WaitlistEntry> = { status };
  if (status === "notified") {
    updateData.notified_at = new Date().toISOString();
  } else if (status === "converted") {
    updateData.converted_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("waitlist")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update waitlist entry status: ${error.message}`);
  }
  return data;
}

/**
 * Check ticket availability for a specific ticket type
 */
async function checkTicketTypeAvailability(
  eventId: string,
  ticketTypeName: string
): Promise<{ available: number; total: number; sold: number } | null> {
  // Get ticket type by name
  const { data: ticketType, error: ttError } = await supabase
    .from("ticket_types")
    .select("id, total_inventory")
    .eq("event_id", eventId)
    .eq("name", ticketTypeName)
    .maybeSingle();

  if (ttError || !ticketType) {
    return null;
  }

  const totalInventory = ticketType.total_inventory ?? 0;

  // Count sold tickets
  const { count: soldCount, error: countError } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("ticket_type_id", ticketType.id)
    .in("status", ["issued", "used", "scanned"]);

  if (countError) {
    console.error("Error counting tickets:", countError);
    return null;
  }

  const sold = soldCount || 0;
  const available = Math.max(0, totalInventory - sold);

  return { available, total: totalInventory, sold };
}

/**
 * Auto-detect ticket availability and notify waitlist customers
 * Checks all events with waitlist entries and notifies customers when tickets become available
 */
export async function autoDetectAndNotifyWaitlist(): Promise<{
  notified: number;
  events: string[];
  errors: string[];
}> {
  const results = {
    notified: 0,
    events: [] as string[],
    errors: [] as string[],
  };

  try {
    // Get all unique events with waitlist entries that are waiting
    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from("waitlist")
      .select("event_name, ticket_type")
      .eq("status", "waiting")
      .order("created_at", { ascending: true });

    if (waitlistError) {
      results.errors.push(`Failed to fetch waitlist entries: ${waitlistError.message}`);
      return results;
    }

    if (!waitlistEntries || waitlistEntries.length === 0) {
      return results; // No waitlist entries
    }

    // Get unique event names
    const uniqueEvents = Array.from(
      new Set(waitlistEntries.map((e) => e.event_name))
    );

    // Process each event
    for (const eventName of uniqueEvents) {
      try {
        // Get event by name
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("id, name")
          .eq("name", eventName)
          .maybeSingle();

        if (eventError || !event) {
          results.errors.push(`Event "${eventName}" not found`);
          continue;
        }

        // Get waitlist entries for this event, grouped by ticket type
        const eventWaitlist = waitlistEntries.filter(
          (e) => e.event_name === eventName
        );
        const ticketTypes = Array.from(
          new Set(eventWaitlist.map((e) => e.ticket_type))
        );

        let eventNotified = false;

        // Check each ticket type
        for (const ticketTypeName of ticketTypes) {
          const availability = await checkTicketTypeAvailability(
            event.id,
            ticketTypeName
          );

          if (!availability || availability.available <= 0) {
            continue; // No tickets available for this type
          }

          // Get waiting customers for this ticket type, ordered by created_at
          const { data: customers, error: customersError } = await supabase
            .from("waitlist")
            .select("*")
            .eq("event_name", eventName)
            .eq("ticket_type", ticketTypeName)
            .eq("status", "waiting")
            .order("created_at", { ascending: true })
            .limit(availability.available); // Only notify up to available tickets

          if (customersError || !customers || customers.length === 0) {
            continue;
          }

          // Notify customers (up to available quantity)
          let remainingTickets = availability.available;
          for (const customer of customers) {
            if (remainingTickets <= 0) break;
            if (customer.quantity > remainingTickets) continue; // Skip if they want more than available

            try {
              await updateWaitlistEntryStatus(customer.id, "notified");
              remainingTickets -= customer.quantity;
              results.notified++;
              eventNotified = true;
            } catch (error: any) {
              results.errors.push(
                `Failed to notify ${customer.customer_email}: ${error.message}`
              );
            }
          }
        }

        if (eventNotified) {
          results.events.push(eventName);
        }
      } catch (error: any) {
        results.errors.push(`Error processing event "${eventName}": ${error.message}`);
      }
    }
  } catch (error: any) {
    results.errors.push(`Auto-detection failed: ${error.message}`);
  }

  return results;
}

/**
 * Check and notify waitlist for a specific event
 */
export async function checkAndNotifyEventWaitlist(
  eventName: string
): Promise<{ notified: number; errors: string[] }> {
  const results = {
    notified: 0,
    errors: [] as string[],
  };

  try {
    // Get event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name")
      .eq("name", eventName)
      .maybeSingle();

    if (eventError || !event) {
      results.errors.push(`Event "${eventName}" not found`);
      return results;
    }

    // Get waitlist entries for this event
    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from("waitlist")
      .select("*")
      .eq("event_name", eventName)
      .eq("status", "waiting")
      .order("created_at", { ascending: true });

    if (waitlistError) {
      results.errors.push(`Failed to fetch waitlist: ${waitlistError.message}`);
      return results;
    }

    if (!waitlistEntries || waitlistEntries.length === 0) {
      return results; // No waitlist entries
    }

    // Group by ticket type
    const ticketTypes = Array.from(
      new Set(waitlistEntries.map((e) => e.ticket_type))
    );

    // Check each ticket type
    for (const ticketTypeName of ticketTypes) {
      const availability = await checkTicketTypeAvailability(
        event.id,
        ticketTypeName
      );

      if (!availability || availability.available <= 0) {
        continue; // No tickets available
      }

      // Get waiting customers for this ticket type
      const customers = waitlistEntries.filter(
        (e) => e.ticket_type === ticketTypeName
      );

      // Notify customers (up to available quantity)
      let remainingTickets = availability.available;
      for (const customer of customers) {
        if (remainingTickets <= 0) break;
        if (customer.quantity > remainingTickets) continue;

        try {
          await updateWaitlistEntryStatus(customer.id, "notified");
          remainingTickets -= customer.quantity;
          results.notified++;
        } catch (error: any) {
          results.errors.push(
            `Failed to notify ${customer.customer_email}: ${error.message}`
          );
        }
      }
    }
  } catch (error: any) {
    results.errors.push(`Error checking waitlist: ${error.message}`);
  }

  return results;
}

