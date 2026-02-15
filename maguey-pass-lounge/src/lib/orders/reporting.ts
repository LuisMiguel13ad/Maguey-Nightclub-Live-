import { supabase } from "../supabase";
import type {
  DashboardStats,
  OrderSummary,
  OrderReportRow,
  SummaryRange,
  SupabaseTypedClient,
} from "./types";

export async function getDashboardStats(
  client: SupabaseTypedClient = supabase
): Promise<DashboardStats> {
  const [eventsRes, ordersRes, ticketsRes] = await Promise.all([
    client.from("events").select("id", { count: "exact", head: true }),
    client
      .from("orders")
      .select("total, status", { count: "exact" }),
    client
      .from("tickets")
      .select("status"),
  ]);

  if (eventsRes.error) {
    throw eventsRes.error;
  }
  if (ordersRes.error) {
    throw ordersRes.error;
  }
  if (ticketsRes.error) {
    throw ticketsRes.error;
  }

  const totalRevenue =
    ordersRes.data?.reduce((sum, order) => {
      const value = Number((order as any).total ?? 0);
      return sum + value;
    }, 0) ?? 0;

  const ticketsIssued = ticketsRes.data?.length ?? 0;
  const ticketsScanned =
    ticketsRes.data?.filter((ticket) => ticket.status === "scanned")
      .length ?? 0;

  return {
    totalEvents: eventsRes.count ?? 0,
    totalOrders: ordersRes.count ?? 0,
    totalRevenue,
    ticketsIssued,
    ticketsScanned,
  };
}

export async function getOrderSummary(
  range?: SummaryRange
): Promise<OrderSummary> {
  const filters = (query: any) => {
    if (range?.start) query = query.gte("created_at", range.start);
    if (range?.end) query = query.lte("created_at", range.end);
    return query;
  };

  const [ordersRes, ticketsRes] = await Promise.all([
    filters(
      supabase
        .from("orders")
        .select("id,total,created_at", { count: "exact" })
    ),
    supabase.from("tickets").select("status"),
  ]);

  if (ordersRes.error) {
    console.error("getOrderSummary orders error:", ordersRes.error);
  }
  if (ticketsRes.error) {
    console.error("getOrderSummary tickets error:", ticketsRes.error);
  }

  const orders = ordersRes.data ?? [];
  const tickets = ticketsRes.data ?? [];

  const totalRevenue = orders.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const ticketsIssued = tickets.length;
  const ticketsScanned = tickets.filter((t) => t.status === "scanned").length;

  return {
    totalOrders: ordersRes.count ?? 0,
    totalRevenue,
    totalTicketsIssued: ticketsIssued,
    totalTicketsScanned: ticketsScanned,
  };
}

export async function getOrderReportRows(
  range?: SummaryRange
): Promise<OrderReportRow[]> {
  let query = supabase
    .from("orders")
    .select("id, purchaser_name, purchaser_email, total, status, created_at, tickets(id)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(100);

  if (range?.start) query = query.gte("created_at", range.start);
  if (range?.end) query = query.lte("created_at", range.end);

  const { data, error } = await query;
  if (error) {
    console.error("getOrderReportRows error:", error);
    return [];
  }

  return (
    data?.map((row) => ({
      orderId: row.id,
      purchaserName: row.purchaser_name,
      purchaserEmail: row.purchaser_email,
      total: row.total ?? 0,
      status: row.status ?? "unknown",
      created_at: row.created_at,
      ticketCount: row.tickets?.length ?? 0,
    })) ?? []
  );
}
