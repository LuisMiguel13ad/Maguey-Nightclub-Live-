// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, parseISO, startOfDay, subDays } from "date-fns";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { localStorageService } from "@/lib/localStorage";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { NavigationGrid } from "@/components/dashboard/NavigationGrid";
import { RecentPurchases } from "@/components/dashboard/RecentPurchases";
import { RevenueTrend } from "@/components/dashboard/RevenueTrend";
import { UpcomingEventsCard } from "@/components/dashboard/UpcomingEventsCard";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  Calendar,
  CalendarDays,
  Clock,
  DollarSign,
  DoorOpen,
  FileText,
  Globe,
  ArrowRight,
  Shield,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  UsersRound,
  Zap,
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface DailyPerformancePoint {
  date: Date;
  label: string;
  revenue: number;
  tickets: number;
}

interface UpcomingEventSummary {
  id: string;
  name: string;
  dateLabel: string;
  ticketsSold: number;
  capacity: number;
  percentSold: number;
  status: "on-track" | "monitor" | "sellout";
  location?: string | null;
}

interface InsightSummary {
  title: string;
  value: string;
  helper?: string;
  trendLabel?: string;
  trendValue?: string;
  positive?: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const resolveTicketDate = (ticket: { created_at?: string | null; purchase_date?: string | null }) => {
  return ticket.created_at || ticket.purchase_date || null;
};

const sumRange = (points: DailyPerformancePoint[], start: Date, end: Date) => {
  return points
    .filter((point) => point.date >= start && point.date < end)
    .reduce(
      (acc, point) => {
        acc.revenue += point.revenue;
        acc.tickets += point.tickets;
        return acc;
      },
      { revenue: 0, tickets: 0 },
    );
};

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const role = useRole();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayTickets: 0,
    weekRevenue: 0,
    weekTickets: 0,
    monthRevenue: 0,
    monthTickets: 0,
    totalRevenue: 0,
    totalTicketsSold: 0,
    totalTicketsScanned: 0,
    activeEvents: 0,
    conversionRate: 0,
    averageOrderValue: 0,
    ticketsPerOrder: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Array<{
    id: string;
    customer_email: string;
    customer_name: string | null;
    event_name: string;
    ticket_type: string;
    ticket_count: number;
    total: number;
    status: string;
    created_at: string;
    completed_at: string | null;
  }>>([]);
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformancePoint[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEventSummary[]>([]);
  const [insights, setInsights] = useState<InsightSummary[]>([]);
  const [trendDelta, setTrendDelta] = useState(0);
  const [weekOverWeek, setWeekOverWeek] = useState(0);
  const [ticketTypeDistribution, setTicketTypeDistribution] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [peakBuyingTimes, setPeakBuyingTimes] = useState<Array<{ hour: string; orders: number }>>([]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (role !== "owner") {
      navigate("/scanner");
    }
  }, [role, navigate, authLoading, user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (role !== "owner") {
      return;
    }

    const checkAuth = async () => {
      const isConfigured = isSupabaseConfigured();

      if (isConfigured) {
        try {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();
          if (error) throw error;

          if (!session) {
            const localUser = localStorageService.getUser();
            if (localUser && localUser.role === 'owner') {
              loadData();
              return;
            }
            navigate("/auth");
            return;
          }
        } catch (error: any) {
          console.error("[OwnerDashboard] Auth error:", error);
          const localUser = localStorageService.getUser();
          if (localUser && localUser.role === 'owner') {
            loadData();
            return;
          }
          navigate("/auth");
          return;
        }
      } else {
        const localUser = localStorageService.getUser();
        if (!localUser || localUser.role !== 'owner') {
          navigate("/auth");
          return;
        }
      }

      loadData();
    };

    checkAuth();
  }, [authLoading, navigate, role, user]);

  const loadData = async () => {
    setIsLoading(true);

    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = startOfDay(subDays(now, 6));
      const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const fourteenDaysAgo = startOfDay(subDays(now, 13));

      const { data: ticketsData, error: ticketsError } = await supabase
        .from<any>("tickets")
        .select("price, created_at, purchase_date, scanned_at, event_name");
      if (ticketsError) throw ticketsError;

      const { data: ordersData, error: ordersError } = await supabase
        .from<any>("orders")
        .select("id, total, created_at, status, purchaser_email, purchaser_name, event_id, events(name)");
      if (ordersError) throw ordersError;

      // Fetch tickets with ticket type information for distribution chart
      const { data: ticketsWithTypes, error: ticketsTypesError } = await supabase
        .from("tickets")
        .select(`
          ticket_type_id,
          ticket_types (
            name,
            category
          )
        `);
      if (ticketsTypesError) console.warn("Error fetching ticket types:", ticketsTypesError);

      // Calculate ticket type distribution
      const typeCounts = new Map<string, number>();
      (ticketsWithTypes || []).forEach((ticket: any) => {
        const typeName = ticket.ticket_types?.name || "Unknown";
        typeCounts.set(typeName, (typeCounts.get(typeName) || 0) + 1);
      });

      const colors = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
      const distribution = Array.from(typeCounts.entries())
        .map(([name, value], index) => ({
          name,
          value,
          color: colors[index % colors.length],
        }))
        .sort((a, b) => b.value - a.value);

      setTicketTypeDistribution(distribution);

      // Calculate peak buying times by hour
      const hourlyOrders = new Map<number, number>();
      (ordersData || []).forEach((order: any) => {
        if (!order.created_at) return;
        const orderDate = parseISO(order.created_at);
        const hour = orderDate.getHours();
        hourlyOrders.set(hour, (hourlyOrders.get(hour) || 0) + 1);
      });

      const peakTimes = Array.from({ length: 24 }, (_, hour) => ({
        hour: `${hour}:00`,
        orders: hourlyOrders.get(hour) || 0,
      }));

      setPeakBuyingTimes(peakTimes);

      const { data: eventsData, error: eventsError } = await supabase
        .from<any>("events")
        .select("id, name, event_date, venue_capacity, ticket_types, metadata")
        .eq("is_active", true)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true });
      if (eventsError) throw eventsError;

      const parsePrice = (value: number | string | null | undefined) => {
        if (value === null || value === undefined) return 0;
        const parsed = typeof value === "string" ? parseFloat(value) : value;
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const revenueTickets = (ticketsData || []).filter((ticket: any) => parsePrice(ticket.price) > 0);

      const ticketsByEvent = new Map<string, number>();
      const dailyMap = new Map<string, DailyPerformancePoint>();

      revenueTickets.forEach((ticket) => {
        const ticketDateRaw = resolveTicketDate(ticket);
        if (!ticketDateRaw) return;
        const ticketDate = parseISO(ticketDateRaw);
        const dateKey = format(startOfDay(ticketDate), "yyyy-MM-dd");
        const existing = dailyMap.get(dateKey) || {
          date: startOfDay(ticketDate),
          label: format(ticketDate, "MMM d"),
          revenue: 0,
          tickets: 0,
        };
        existing.revenue += parsePrice((ticket as any).price);
        existing.tickets += 1;
        dailyMap.set(dateKey, existing);

        if (ticket.event_name) {
          ticketsByEvent.set(ticket.event_name, (ticketsByEvent.get(ticket.event_name) || 0) + 1);
        }
      });

      const completedOrders = (ordersData || []).filter((order) => order.status === "completed");
      const totalRevenue = revenueTickets.reduce((sum, ticket) => sum + parsePrice(ticket.price), 0);
      const todayRevenueTickets = revenueTickets.filter((ticket) => {
        const ticketDate = resolveTicketDate(ticket);
        if (!ticketDate) return false;
        return parseISO(ticketDate) >= todayStart;
      });
      const weekRevenueTickets = revenueTickets.filter((ticket) => {
        const ticketDate = resolveTicketDate(ticket);
        if (!ticketDate) return false;
        return parseISO(ticketDate) >= weekStart;
      });
      const monthRevenueTickets = revenueTickets.filter((ticket) => {
        const ticketDate = resolveTicketDate(ticket);
        if (!ticketDate) return false;
        return parseISO(ticketDate) >= monthStart;
      });

      // ticketsData represents individual tickets; use revenueTickets length for sold count
      const totalTicketsSold = revenueTickets.length;
      const totalTicketsScanned = (ticketsData || []).filter((ticket) => ticket.scanned_at !== null).length;
      const conversionRate = totalTicketsSold > 0 ? (totalTicketsScanned / totalTicketsSold) * 100 : 0;
      const averageOrderValue = completedOrders.length ? totalRevenue / completedOrders.length : 0;
      const ticketsPerOrder = completedOrders.length ? totalTicketsSold / completedOrders.length : 0;

      const fourteenDayPoints: DailyPerformancePoint[] = [];
      for (let i = 0; i < 14; i += 1) {
        const currentDate = startOfDay(addDays(fourteenDaysAgo, i));
        const key = format(currentDate, "yyyy-MM-dd");
        const point = dailyMap.get(key) || {
          date: currentDate,
          label: format(currentDate, "MMM d"),
          revenue: 0,
          tickets: 0,
        };
        fourteenDayPoints.push(point);
      }

      const lastSevenStart = startOfDay(subDays(now, 6));
      const previousSevenStart = startOfDay(subDays(now, 13));
      const previousSevenEnd = startOfDay(subDays(now, 6));

      const lastSeven = sumRange(fourteenDayPoints, lastSevenStart, startOfDay(addDays(now, 1)));
      const previousSeven = sumRange(fourteenDayPoints, previousSevenStart, previousSevenEnd);

      const revenueTrendDelta = previousSeven.revenue > 0
        ? ((lastSeven.revenue - previousSeven.revenue) / previousSeven.revenue) * 100
        : 0;

      const upcomingSummaries: UpcomingEventSummary[] = (eventsData || []).slice(0, 4).map((event) => {
        const eventDate = parseISO(event.event_date as string);
        const ticketsSold = ticketsByEvent.get(event.name) || 0;
        const capacityFromTiers = Array.isArray(event.ticket_types)
          ? event.ticket_types.reduce((sum: number, tier: { capacity?: number }) => sum + (tier?.capacity || 0), 0)
          : 0;
        const capacity = event.venue_capacity || capacityFromTiers;
        const percentSold = capacity > 0 ? Math.min((ticketsSold / capacity) * 100, 100) : 0;
        let status: UpcomingEventSummary["status"] = "on-track";
        if (percentSold >= 85) status = "sellout";
        else if (percentSold >= 60) status = "monitor";

        return {
          id: event.id,
          name: event.name,
          dateLabel: format(eventDate, "EEE, MMM d • h:mm a"),
          ticketsSold,
          capacity,
          percentSold,
          status,
          location: event.metadata?.location || null,
        };
      });

      const topEventEntry = Array.from(ticketsByEvent.entries()).sort((a, b) => b[1] - a[1])[0];
      const topEventName = topEventEntry?.[0] || "No event data";
      const topEventTickets = topEventEntry?.[1] || 0;

      setStats({
        todayRevenue: todayRevenueTickets.reduce((sum, ticket) => sum + parsePrice(ticket.price), 0),
        todayTickets: todayRevenueTickets.length,
        weekRevenue: weekRevenueTickets.reduce((sum, ticket) => sum + parsePrice(ticket.price), 0),
        weekTickets: weekRevenueTickets.length,
        monthRevenue: monthRevenueTickets.reduce((sum, ticket) => sum + parsePrice(ticket.price), 0),
        monthTickets: monthRevenueTickets.length,
        totalRevenue,
        totalTicketsSold,
        totalTicketsScanned,
        activeEvents: eventsData?.length || 0,
        conversionRate,
        averageOrderValue,
        ticketsPerOrder,
      });
      setDailyPerformance(fourteenDayPoints);
      setTrendDelta(revenueTrendDelta);
      setWeekOverWeek(revenueTrendDelta);
      setUpcomingEvents(upcomingSummaries);
      // Transform orders to match RecentPurchases component interface
      // Note: orders.total is stored in cents (like purchase site), so divide by 100 for display
      const transformedOrders = (ordersData || []).slice(0, 10).map((order: any) => ({
        id: order.id,
        customer_email: order.purchaser_email || '',
        customer_name: order.purchaser_name || null,
        event_name: (order.events as any)?.name || 'Unknown Event',
        ticket_type: 'General', // Default since ticket_type is not in orders table
        ticket_count: 0, // ticket_count not stored on orders; display placeholder
        total: Number(order.total || 0) / 100, // Convert from cents to dollars
        status: order.status || 'pending',
        created_at: order.created_at,
        completed_at: order.created_at, // fallback to created_at since completed_at is not present
      }));
      setRecentOrders(transformedOrders);
      setInsights([
        {
          title: "Average order value",
          value: currencyFormatter.format(averageOrderValue || 0),
          helper: "Per completed order",
          trendLabel: "Orders processed",
          trendValue: `${completedOrders.length.toLocaleString()}`,
          positive: true,
        },
        {
          title: "Tickets per order",
          value: ticketsPerOrder ? ticketsPerOrder.toFixed(1) : "0.0",
          helper: "Avg. quantity per purchase",
          trendLabel: "Completed tickets",
          trendValue: `${totalTicketsSold.toLocaleString()}`,
          positive: true,
        },
        {
          title: "Top performing event",
          value: topEventName,
          helper: `${topEventTickets.toLocaleString()} tickets sold`,
          positive: true,
        },
      ]);
    } catch (error: any) {
      console.error("Error loading dashboard data:", error);
      toast({
        variant: "destructive",
        title: "Error loading data",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const ownerName = useMemo(() => {
    if (!user) return "Owner";
    return (
      user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Owner"
    );
  }, [user]);

  const navigationItems = [
    {
      title: "Site Management",
      description: "Manage all three websites from one place",
      icon: Globe,
      path: "/sites",
      size: "large" as const,
      color: "indigo",
      bg: "bg-gradient-to-br from-indigo-50 to-indigo-100/50",
      iconBg: "bg-indigo-100",
    },
    {
      title: "Events",
      description: "Manage upcoming events and ticket types",
      icon: Calendar,
      path: "/events",
      size: "large" as const,
      color: "blue",
      bg: "bg-gradient-to-br from-blue-50 to-blue-100/50",
      iconBg: "bg-blue-100",
    },
    {
      title: "Analytics",
      description: "Detailed reports and performance metrics",
      icon: BarChart3,
      path: "/analytics",
      size: "large" as const,
      color: "purple",
      bg: "bg-gradient-to-br from-purple-50 to-purple-100/50",
      iconBg: "bg-purple-100",
    },
    {
      title: "Team Management",
      description: "Manage staff accounts and permissions",
      icon: Users,
      path: "/team",
      size: "large" as const,
      color: "green",
      bg: "bg-gradient-to-br from-green-50 to-green-100/50",
      iconBg: "bg-green-100",
    },
    {
      title: "Customers",
      description: "View and manage customer database",
      icon: UsersRound,
      path: "/customers",
      size: "large" as const,
      color: "blue",
      bg: "bg-gradient-to-br from-blue-50 to-blue-100/50",
      iconBg: "bg-blue-100",
    },
    {
      title: "Devices",
      description: "Manage scanner devices",
      icon: Smartphone,
      path: "/devices",
      size: "medium" as const,
    },
    {
      title: "Security",
      description: "Security settings and policies",
      icon: Shield,
      path: "/security",
      size: "medium" as const,
    },
    {
      title: "Door Counters",
      description: "Manage entry counters",
      icon: DoorOpen,
      path: "/door-counters",
      size: "medium" as const,
    },
    {
      title: "Audit Log",
      description: "View activity logs",
      icon: FileText,
      path: "/audit-log",
      size: "small" as const,
    },
    {
      title: "Notifications",
      description: "Alert preferences",
      icon: CalendarDays,
      path: "/notifications/preferences",
      size: "small" as const,
    },
    {
      title: "Scheduling",
      description: "Staff scheduling",
      icon: Clock,
      path: "/staff-scheduling",
      size: "small" as const,
    },
  ];

  const nextEvent = upcomingEvents[0] ?? null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712] text-slate-300">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin mx-auto" />
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Preparing dashboard</p>
        </div>
      </div>
    );
  }

  const headerActions = (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
      <Button
        variant="outline"
        className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
        onClick={() => navigate("/scanner")}
      >
        <Zap className="mr-2 h-4 w-4" />
        Live Scanner
      </Button>
      <Button
        className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 text-white shadow-lg shadow-indigo-900/40 sm:w-auto"
        onClick={() => navigate("/events?new=true")}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Create Event
      </Button>
    </div>
  );

  const heroSection = (
    <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] p-6 shadow-[0_45px_90px_rgba(3,7,23,0.7)] sm:p-8 xl:col-span-2">
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.4em] text-indigo-200/80">
                <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-indigo-100">
                  Owner Pulse
                </span>
                <span>{format(new Date(), "PPPP")}</span>
              </div>
              <div className="mt-6 space-y-4">
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">Stay ahead of every ticket, table, and trend</h2>
                <p className="text-slate-300">
                  Monitor live performance, unlock insights, and launch new experiences without leaving this control center.
                </p>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Week Revenue</p>
                  <p className="mt-2 text-2xl font-semibold">{currencyFormatter.format(stats.weekRevenue)}</p>
                  <p className="text-xs text-emerald-300 mt-1">
                    {weekOverWeek >= 0 ? "+" : ""}
                    {weekOverWeek.toFixed(1)}% vs last week
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Total Tickets</p>
                  <p className="mt-2 text-2xl font-semibold">{stats.totalTicketsSold.toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-1">Lifetime sold</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Active Events</p>
                  <p className="mt-2 text-2xl font-semibold">{stats.activeEvents}</p>
                  <p className="text-xs text-slate-400 mt-1">On sale now</p>
                </div>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="w-full justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 sm:flex-1"
                  onClick={() => navigate("/analytics")}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View analytics
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-center rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10 sm:flex-1"
                  onClick={() => navigate("/events")}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Manage events
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_25px_60px_rgba(5,9,21,0.65)] sm:p-6">
              {nextEvent ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Next event</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{nextEvent.name}</h3>
                    <p className="text-sm text-slate-400">{nextEvent.dateLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0c1127] p-4">
                    <p className="text-xs text-slate-400">Capacity</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {nextEvent.ticketsSold} / {nextEvent.capacity}
                    </p>
                    <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                        style={{ width: `${nextEvent.percentSold}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {nextEvent.percentSold.toFixed(0)}% sold •{" "}
                      {nextEvent.status === "sellout"
                        ? "Selling out fast"
                        : nextEvent.status === "monitor"
                          ? "Monitor pace"
                          : "On track"}
                    </p>
                  </div>
                  <Button
                    className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 text-white"
                    onClick={() => navigate("/events")}
                  >
                    Go to events
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-slate-400">No active events yet.</p>
                  <Button
                    className="rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 text-white"
                    onClick={() => navigate("/events?new=true")}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Create first event
                  </Button>
                </div>
              )}
            </div>
    </section>
  );

  return (
    <OwnerPortalLayout
      subtitle={`${getGreeting()}, ${ownerName}`}
      title="Control every venue moment"
      description={format(new Date(), "EEEE, MMMM d, yyyy")}
      actions={headerActions}
      hero={heroSection}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-3xl border border-white/5 bg-[#050b1a]/90 text-white shadow-lg shadow-black/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Total Revenue</CardTitle>
                <div className="h-10 w-10 rounded-2xl bg-white/5 text-indigo-300 flex items-center justify-center">
                  <DollarSign className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{currencyFormatter.format(stats.totalRevenue)}</div>
                <p className="text-xs text-slate-500 mt-2">
                  {stats.totalTicketsSold.toLocaleString()} tickets sold lifetime
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-white/5 bg-[#050b1a]/90 text-white shadow-lg shadow-black/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Revenue Today</CardTitle>
                <div className="h-10 w-10 rounded-2xl bg-white/5 text-emerald-300 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{currencyFormatter.format(stats.todayRevenue)}</div>
                <p className="text-xs text-slate-500 mt-2">
                  {stats.todayTickets.toLocaleString()} tickets sold today
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-white/5 bg-[#050b1a]/90 text-white shadow-lg shadow-black/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Weekly Revenue</CardTitle>
                <div className="h-10 w-10 rounded-2xl bg-white/5 text-sky-300 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{currencyFormatter.format(stats.weekRevenue)}</div>
                <p className="text-xs text-slate-500 mt-2">
                  {weekOverWeek >= 0 ? "+" : ""}
                  {weekOverWeek.toFixed(1)}% from last week
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-white/5 bg-[#050b1a]/90 text-white shadow-lg shadow-black/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Conversion Rate</CardTitle>
                <div className="h-10 w-10 rounded-2xl bg-white/5 text-purple-300 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{stats.conversionRate.toFixed(1)}%</div>
                <p className="text-xs text-slate-500 mt-2">
                  {stats.totalTicketsScanned.toLocaleString()} checked in
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-8 lg:grid-cols-2 xl:grid-cols-7">
            <div className="space-y-8 lg:col-span-2 xl:col-span-4">
              <div className="rounded-3xl border border-white/5 bg-[#050b1a]/80 p-3 sm:p-4">
                <RevenueTrend
                  data={dailyPerformance.map((point) => ({
                    date: format(point.date, "yyyy-MM-dd"),
                    label: point.label,
                    revenue: point.revenue,
                    tickets: point.tickets,
                  }))}
                  trendDelta={trendDelta}
                  caption="Revenue performance over the last 14 days"
                  revenueLabel="Revenue (7-day)"
                  revenueTotal={currencyFormatter.format(stats.weekRevenue)}
                  ticketsLabel="Tickets"
                  ticketsTotal={stats.weekTickets.toLocaleString()}
                />
              </div>

              <Card className="rounded-3xl border border-white/5 bg-[#050b1a]/80 text-white shadow-lg shadow-black/40">
                <CardHeader>
                  <CardTitle>Ticket Sales Distribution</CardTitle>
                  <CardDescription className="text-slate-400">Breakdown by ticket type</CardDescription>
                </CardHeader>
                <CardContent className="pl-0">
                  {ticketTypeDistribution.length > 0 ? (
                    <ChartContainer
                      config={{
                        sales: { label: "Sales" },
                      }}
                      className="h-[300px] w-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={ticketTypeDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {ticketTypeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-slate-500">No data available</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8 lg:col-span-2 xl:col-span-3">
              <Card className="rounded-3xl border border-white/5 bg-[#050b1a]/80 text-white shadow-lg shadow-black/40">
                <CardHeader>
                  <CardTitle>Operational Insights</CardTitle>
                  <CardDescription className="text-slate-400">Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.map((item) => (
                    <div key={item.title} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium leading-none text-white">{item.title}</p>
                        <p className="text-xs text-slate-400">{item.helper}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold">{item.value}</span>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-white/10 bg-[#0e1431] p-4">
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-indigo-500/20 p-3 text-indigo-200">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none text-white">Scan Status</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{stats.totalTicketsScanned} scanned</span>
                          <span>•</span>
                          <span>{Math.max(stats.totalTicketsSold - stats.totalTicketsScanned, 0)} pending</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-3xl border border-white/5 bg-[#050b1a]/80 p-2">
                <UpcomingEventsCard events={upcomingEvents} onManageEvents={() => navigate("/events")} />
              </div>
            </div>
          </section>

          <section className="grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl border border-white/5 bg-[#050b1a]/80 p-2 sm:p-3">
              <RecentPurchases orders={recentOrders} currencyFormatter={currencyFormatter} />
            </div>

            <Card className="rounded-3xl border border-white/5 bg-[#050b1a]/80 text-white shadow-lg shadow-black/40">
              <CardHeader>
                <CardTitle>Peak Buying Hours</CardTitle>
                <CardDescription className="text-slate-400">When your customers are purchasing</CardDescription>
              </CardHeader>
              <CardContent>
                {peakBuyingTimes.length > 0 ? (
                  <ChartContainer
                    config={{
                      orders: { label: "Orders", theme: { light: "#6366f1", dark: "#818cf8" } },
                    }}
                    className="h-[300px] w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={peakBuyingTimes}>
                        <XAxis
                          dataKey="hour"
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                          tickFormatter={(value) => value.split(":")[0]}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-500">No data available</div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="rounded-3xl border border-white/5 bg-[#050b1a]/80 p-6 shadow-lg shadow-black/30">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-white">Administration</h2>
                <p className="text-sm text-slate-400">Manage your venue and settings</p>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 text-indigo-200 hover:text-white" onClick={() => navigate("/sites")}>
                View All Sites <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <NavigationGrid items={navigationItems} />
          </section>
    </OwnerPortalLayout>
  );
};

export default OwnerDashboard;

