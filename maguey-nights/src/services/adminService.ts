import { supabase } from '@/lib/supabase';

export interface Order {
  id: string;
  purchaser_email: string;
  purchaser_name: string | null;
  event_id: string;
  subtotal: number;
  fees_total: number;
  total: number;
  status: string;
  payment_provider: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
  events?: {
    name: string;
    event_date: string;
    event_time: string | null;
    venue_name: string | null;
  };
  tickets?: Array<{
    id: string;
    attendee_name: string;
    ticket_type: string | null;
    status: string;
    is_used: boolean;
  }>;
}

export interface EventStats {
  totalOrders: number;
  totalRevenue: number;
  totalTickets: number;
  averageOrderValue: number;
  topEvents: Array<{
    event: string;
    orders: number;
    revenue: number;
  }>;
}

/**
 * Fetch all orders with related event and ticket data
 */
export async function fetchOrders(filters?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<Order[]> {
  try {
    let query = supabase
      .from('orders')
      .select(`
        *,
        events (
          name,
          event_date,
          event_time,
          venue_name
        ),
        tickets (
          id,
          attendee_name,
          ticket_type,
          status,
          is_used
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }

    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    if (filters?.search) {
      query = query.or(
        `purchaser_email.ilike.%${filters.search}%,purchaser_name.ilike.%${filters.search}%,payment_reference.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchOrders:', error);
    throw error;
  }
}

/**
 * Fetch order by ID
 */
export async function fetchOrderById(orderId: string): Promise<Order | null> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        events (
          name,
          event_date,
          event_time,
          venue_name
        ),
        tickets (
          id,
          attendee_name,
          ticket_type,
          status,
          is_used
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in fetchOrderById:', error);
    return null;
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    return false;
  }
}

/**
 * Calculate event statistics
 */
export async function fetchStats(): Promise<EventStats> {
  try {
    // Fetch all orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('total, status, event_id, events(name)');

    if (ordersError) {
      console.error('Error fetching orders for stats:', ordersError);
      throw ordersError;
    }

    // Fetch all tickets
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, order_id');

    if (ticketsError) {
      console.error('Error fetching tickets for stats:', ticketsError);
      throw ticketsError;
    }

    // Calculate statistics
    const paidOrders = orders?.filter(o => o.status === 'paid') || [];
    const totalOrders = paidOrders.length;
    const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const totalTickets = tickets?.length || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate top events
    const eventMap = new Map<string, { orders: number; revenue: number }>();
    
    paidOrders.forEach(order => {
      const eventName = (order.events as any)?.name || 'Unknown Event';
      const current = eventMap.get(eventName) || { orders: 0, revenue: 0 };
      eventMap.set(eventName, {
        orders: current.orders + 1,
        revenue: current.revenue + Number(order.total || 0)
      });
    });

    const topEvents = Array.from(eventMap.entries())
      .map(([event, stats]) => ({
        event,
        orders: stats.orders,
        revenue: stats.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalOrders,
      totalRevenue,
      totalTickets,
      averageOrderValue,
      topEvents
    };
  } catch (error) {
    console.error('Error in fetchStats:', error);
    // Return default stats on error
    return {
      totalOrders: 0,
      totalRevenue: 0,
      totalTickets: 0,
      averageOrderValue: 0,
      topEvents: []
    };
  }
}

/**
 * Get orders count by status
 */
export async function getOrdersByStatus(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('status');

    if (error) {
      console.error('Error fetching orders by status:', error);
      return {};
    }

    const statusCounts: Record<string, number> = {};
    data?.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    return statusCounts;
  } catch (error) {
    console.error('Error in getOrdersByStatus:', error);
    return {};
  }
}

