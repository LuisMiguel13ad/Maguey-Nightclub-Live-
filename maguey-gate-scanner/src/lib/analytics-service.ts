import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

export interface TicketsSoldPerEvent {
  eventId: string;
  eventName: string;
  ticketsSold: number;
  ticketsScanned: number;
  revenue: number;
}

export interface DailyWeeklySales {
  date: string;
  ticketsSold: number;
  revenue: number;
  period: 'daily' | 'weekly';
}

export interface CheckInRate {
  eventId: string;
  eventName: string;
  totalTickets: number;
  scannedTickets: number;
  checkInRate: number; // percentage
}

/**
 * Get tickets sold per event
 */
export const getTicketsSoldPerEvent = async (
  startDate?: Date,
  endDate?: Date
): Promise<TicketsSoldPerEvent[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    // Get all events
    let eventsQuery = supabase
      .from('events')
      .select('id, name');

    if (startDate || endDate) {
      if (startDate) {
        eventsQuery = eventsQuery.gte('event_date', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        eventsQuery = eventsQuery.lte('event_date', endDate.toISOString().split('T')[0]);
      }
    }

    const { data: events, error: eventsError } = await eventsQuery;

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) return [];

    // Get tickets for each event
    const results = await Promise.all(
      events.map(async (event) => {
        let ticketsQuery = supabase
          .from('tickets')
          .select('id, status, scanned_at, price_paid, order_id')
          .eq('event_id', event.id);

        // Filter by date range if provided (based on purchase_date or created_at)
        if (startDate || endDate) {
          const start = startDate?.toISOString();
          const end = endDate?.toISOString();
          if (start) {
            ticketsQuery = ticketsQuery.gte('purchase_date', start);
          }
          if (end) {
            ticketsQuery = ticketsQuery.lte('purchase_date', end);
          }
        }

        const { data: tickets, error: ticketsError } = await ticketsQuery;

        if (ticketsError) {
          console.error(`Error fetching tickets for event ${event.name}:`, ticketsError);
          return {
            eventId: event.id,
            eventName: event.name,
            ticketsSold: 0,
            ticketsScanned: 0,
            revenue: 0,
          };
        }

        const ticketsSold = tickets?.length || 0;
        const ticketsScanned = tickets?.filter(t => t.scanned_at || t.status === 'scanned' || t.status === 'used').length || 0;
        
        // Calculate revenue from tickets with price_paid or from orders
        let revenue = 0;
        if (tickets && tickets.length > 0) {
          revenue = tickets.reduce((sum, ticket) => {
            const price = typeof ticket.price_paid === 'string' 
              ? parseFloat(ticket.price_paid) 
              : (typeof ticket.price_paid === 'number' ? ticket.price_paid : 0);
            return sum + (isNaN(price) ? 0 : price);
          }, 0);
        }

        return {
          eventId: event.id,
          eventName: event.name,
          ticketsSold,
          ticketsScanned,
          revenue,
        };
      })
    );

    return results;
  } catch (error) {
    console.error('Error getting tickets sold per event:', error);
    return [];
  }
};

/**
 * Get daily or weekly sales
 */
export const getDailyWeeklySales = async (
  period: 'daily' | 'weekly' = 'daily',
  startDate?: Date,
  endDate?: Date
): Promise<DailyWeeklySales[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    // Default to last 30 days if no dates provided
    const end = endDate || new Date();
    const start = startDate || new Date();
    start.setDate(start.getDate() - 30);

    let ticketsQuery = supabase
      .from('tickets')
      .select('purchase_date, created_at, price_paid, order_id')
      .gte('purchase_date', start.toISOString())
      .lte('purchase_date', end.toISOString())
      .order('purchase_date', { ascending: true });

    const { data: tickets, error: ticketsError } = await ticketsQuery;

    if (ticketsError) throw ticketsError;
    if (!tickets || tickets.length === 0) return [];

    // Group by date
    const salesByDate = new Map<string, { ticketsSold: number; revenue: number }>();

    tickets.forEach((ticket) => {
      const ticketDate = ticket.purchase_date || ticket.created_at;
      if (!ticketDate) return;

      const date = new Date(ticketDate);
      let key: string;

      if (period === 'weekly') {
        // Get start of week (Sunday)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        // Daily
        key = date.toISOString().split('T')[0];
      }

      const existing = salesByDate.get(key) || { ticketsSold: 0, revenue: 0 };
      const price = typeof ticket.price_paid === 'string'
        ? parseFloat(ticket.price_paid)
        : (typeof ticket.price_paid === 'number' ? ticket.price_paid : 0);

      salesByDate.set(key, {
        ticketsSold: existing.ticketsSold + 1,
        revenue: existing.revenue + (isNaN(price) ? 0 : price),
      });
    });

    // Convert to array and sort
    const results: DailyWeeklySales[] = Array.from(salesByDate.entries())
      .map(([date, data]) => ({
        date,
        ticketsSold: data.ticketsSold,
        revenue: data.revenue,
        period,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return results;
  } catch (error) {
    console.error('Error getting daily/weekly sales:', error);
    return [];
  }
};

/**
 * Get check-in rates per event
 */
export const getCheckInRates = async (
  startDate?: Date,
  endDate?: Date
): Promise<CheckInRate[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    // Get all events
    let eventsQuery = supabase
      .from('events')
      .select('id, name');

    if (startDate || endDate) {
      if (startDate) {
        eventsQuery = eventsQuery.gte('event_date', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        eventsQuery = eventsQuery.lte('event_date', endDate.toISOString().split('T')[0]);
      }
    }

    const { data: events, error: eventsError } = await eventsQuery;

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) return [];

    // Get check-in rates for each event
    const results = await Promise.all(
      events.map(async (event) => {
        const { data: tickets, error: ticketsError } = await supabase
          .from('tickets')
          .select('id, status, scanned_at')
          .eq('event_id', event.id);

        if (ticketsError) {
          console.error(`Error fetching tickets for event ${event.name}:`, ticketsError);
          return {
            eventId: event.id,
            eventName: event.name,
            totalTickets: 0,
            scannedTickets: 0,
            checkInRate: 0,
          };
        }

        const totalTickets = tickets?.length || 0;
        const scannedTickets = tickets?.filter(
          t => t.scanned_at || t.status === 'scanned' || t.status === 'used'
        ).length || 0;
        const checkInRate = totalTickets > 0 ? (scannedTickets / totalTickets) * 100 : 0;

        return {
          eventId: event.id,
          eventName: event.name,
          totalTickets,
          scannedTickets,
          checkInRate: Math.round(checkInRate * 100) / 100, // Round to 2 decimal places
        };
      })
    );

    return results;
  } catch (error) {
    console.error('Error getting check-in rates:', error);
    return [];
  }
};

