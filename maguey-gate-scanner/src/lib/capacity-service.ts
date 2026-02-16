import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { localStorageService } from '@/lib/localStorage';

export interface CapacityStatus {
  eventName: string;
  totalCapacity: number;
  currentCount: number;
  available: number;
  percentageFull: number;
  isAtCapacity: boolean;
  isNearCapacity: boolean; // 90% or more
  ticketTypeCapacity?: TicketTypeCapacity[];
}

export interface TicketTypeCapacity {
  ticketType: string;
  capacity: number;
  currentCount: number;
  available: number;
  percentageFull: number;
  isAtCapacity: boolean;
  isNearCapacity: boolean;
}

/**
 * Get capacity status for an event
 * @param eventName - Name of the event
 * @returns Promise<CapacityStatus | null>
 */
export const getEventCapacity = async (eventName: string): Promise<CapacityStatus | null> => {
  if (!eventName) return null;

  const isConfigured = isSupabaseConfigured();

  if (isConfigured) {
    try {
      // Get event details with capacity
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('venue_capacity, ticket_types')
        .eq('name', eventName)
        .eq('is_active', true)
        .maybeSingle();

      if (eventError) {
        console.error('Error fetching event:', eventError);
        return null;
      }

      if (!eventData) {
        // Event not found - return default capacity
        return {
          eventName,
          totalCapacity: 1000, // Default fallback
          currentCount: 0,
          available: 1000,
          percentageFull: 0,
          isAtCapacity: false,
          isNearCapacity: false,
        };
      }

      const totalCapacity = eventData.venue_capacity || 1000;
      const ticketTypes = (eventData.ticket_types as any[]) || [];

      // Count scanned tickets for this event
      // Check both status field and is_used field for compatibility
      const { data: scannedTickets, error: scanError } = await supabase
        .from('tickets')
        .select('ticket_type, status, is_used, scanned_at')
        .eq('event_name', eventName)
        .or('status.eq.scanned,status.eq.used,is_used.eq.true');

      if (scanError) {
        console.error('Error counting scanned tickets:', scanError);
      }

      const currentCount = scannedTickets?.length || 0;
      const available = Math.max(0, totalCapacity - currentCount);
      const percentageFull = totalCapacity > 0 ? (currentCount / totalCapacity) * 100 : 0;
      const isAtCapacity = currentCount >= totalCapacity;
      const isNearCapacity = percentageFull >= 90;

      // Calculate capacity by ticket type
      const ticketTypeCapacity: TicketTypeCapacity[] = ticketTypes.map((type: any) => {
        const typeName = type.name || 'Unknown';
        const typeCapacity = type.capacity || 0;
        
        // Count scanned tickets of this type
        // Match ticket_type field (case-insensitive for flexibility)
        const typeScanned = scannedTickets?.filter(
          (t: any) => (t.ticket_type || '').toLowerCase() === typeName.toLowerCase()
        ).length || 0;

        const typeAvailable = Math.max(0, typeCapacity - typeScanned);
        const typePercentageFull = typeCapacity > 0 ? (typeScanned / typeCapacity) * 100 : 0;

        return {
          ticketType: typeName,
          capacity: typeCapacity,
          currentCount: typeScanned,
          available: typeAvailable,
          percentageFull: typePercentageFull,
          isAtCapacity: typeScanned >= typeCapacity,
          isNearCapacity: typePercentageFull >= 90,
        };
      });

      return {
        eventName,
        totalCapacity,
        currentCount,
        available,
        percentageFull,
        isAtCapacity,
        isNearCapacity,
        ticketTypeCapacity: ticketTypeCapacity.length > 0 ? ticketTypeCapacity : undefined,
      };
    } catch (error: any) {
      console.error('getEventCapacity error:', error);
      return null;
    }
  } else {
    // Local storage mode
    const tickets = localStorageService.getTickets();
    const eventTickets = tickets.filter(t => t.event_name === eventName);
    const scannedTickets = eventTickets.filter(t => t.is_used || t.status === 'scanned');

    // Default capacity for local storage
    const totalCapacity = 500;
    const currentCount = scannedTickets.length;
    const available = Math.max(0, totalCapacity - currentCount);
    const percentageFull = (currentCount / totalCapacity) * 100;
    const isAtCapacity = currentCount >= totalCapacity;
    const isNearCapacity = percentageFull >= 90;

    // Group by ticket type
    const ticketTypeMap = new Map<string, number>();
    scannedTickets.forEach(t => {
      const type = t.ticket_type || 'General Admission';
      ticketTypeMap.set(type, (ticketTypeMap.get(type) || 0) + 1);
    });

    const ticketTypeCapacity: TicketTypeCapacity[] = Array.from(ticketTypeMap.entries()).map(([type, count]) => {
      // Default capacity per type in local storage
      const typeCapacity = type === 'VIP' ? 100 : 400;
      return {
        ticketType: type,
        capacity: typeCapacity,
        currentCount: count,
        available: Math.max(0, typeCapacity - count),
        percentageFull: (count / typeCapacity) * 100,
        isAtCapacity: count >= typeCapacity,
        isNearCapacity: (count / typeCapacity) * 100 >= 90,
      };
    });

    return {
      eventName,
      totalCapacity,
      currentCount,
      available,
      percentageFull,
      isAtCapacity,
      isNearCapacity,
      ticketTypeCapacity: ticketTypeCapacity.length > 0 ? ticketTypeCapacity : undefined,
    };
  }
};

/**
 * Check if a ticket can be scanned based on capacity
 * @param eventName - Name of the event
 * @param ticketType - Type of ticket (VIP, General Admission, etc.)
 * @returns Promise<{ allowed: boolean; reason?: string }>
 */
export const checkCapacityBeforeScan = async (
  eventName: string,
  ticketType?: string
): Promise<{ allowed: boolean; reason?: string }> => {
  const capacity = await getEventCapacity(eventName);
  
  if (!capacity) {
    // If we can't get capacity, allow scan (fail open)
    return { allowed: true };
  }

  // Check overall capacity
  if (capacity.isAtCapacity) {
    return {
      allowed: false,
      reason: `Venue is at full capacity (${capacity.currentCount}/${capacity.totalCapacity}). Entry denied.`,
    };
  }

  // Check ticket type capacity if specified
  if (ticketType && capacity.ticketTypeCapacity) {
    const typeCapacity = capacity.ticketTypeCapacity.find(
      (t) => t.ticketType === ticketType
    );

    if (typeCapacity && typeCapacity.isAtCapacity) {
      return {
        allowed: false,
        reason: `${ticketType} tickets are at full capacity (${typeCapacity.currentCount}/${typeCapacity.capacity}). Entry denied.`,
      };
    }
  }

  return { allowed: true };
};

