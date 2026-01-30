// @ts-nocheck
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, parseISO, startOfDay, subDays } from "date-fns";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { localStorageService } from "@/lib/localStorage";
import { useAuth, useRole } from "@/contexts/AuthContext";
import {
  getRecentEmailStatuses,
  retryFailedEmail,
  getEmailStatusColor,
  getEmailStatusLabel,
  EmailQueueStatus
} from "@/lib/email-status-service";
import { getScannerStatuses, ScannerStatus } from "@/lib/scanner-status-service";
import { RecentPurchases } from "@/components/dashboard/RecentPurchases";
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
  DoorOpen,
  FileText,
  Globe,
  Mail,
  RefreshCw,
  Shield,
  Smartphone,
  Sparkles,
  Users,
  UsersRound,
  Zap,
  Wine,
  Wifi,
  WifiOff,
} from "lucide-react";

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
    vipTablesSold: 0,
    vipRevenue: 0,
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
  const [emailStatuses, setEmailStatuses] = useState<Map<string, EmailQueueStatus>>(new Map());
  const [emailStatusList, setEmailStatusList] = useState<EmailQueueStatus[]>([]);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const [scannerStatuses, setScannerStatuses] = useState<ScannerStatus[]>([]);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    // Allow owners and promoters to access dashboard
    if (role !== "owner" && role !== "promoter") {
      navigate("/scanner");
    }
  }, [role, navigate, authLoading, user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    // Allow owners and promoters
    if (role !== "owner" && role !== "promoter") {
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
            if (localUser && (localUser.role === 'owner' || localUser.role === 'promoter')) {
              loadData();
              return;
            }
            navigate("/auth");
            return;
          }
        } catch (error: any) {
          console.error("[OwnerDashboard] Auth error:", error);
          const localUser = localStorageService.getUser();
          if (localUser && (localUser.role === 'owner' || localUser.role === 'promoter')) {
            loadData();
            return;
          }
          navigate("/auth");
          return;
        }
      } else {
        const localUser = localStorageService.getUser();
        if (!localUser || (localUser.role !== 'owner' && localUser.role !== 'promoter')) {
          navigate("/auth");
          return;
        }
      }

      loadData();
    };

    checkAuth();
  }, [authLoading, navigate, role, user]);

  const fetchEmailStatuses = async () => {
    try {
      const statuses = await getRecentEmailStatuses(100);
      const statusMap = new Map<string, EmailQueueStatus>();
      for (const status of statuses) {
        if (status.related_id) {
          statusMap.set(status.related_id, status);
        }
      }
      setEmailStatuses(statusMap);
      setEmailStatusList(statuses);
    } catch (error) {
      console.error('Error fetching email statuses:', error);
    }
  };

  const fetchScannerStatuses = async () => {
    try {
      const statuses = await getScannerStatuses();
      setScannerStatuses(statuses);
    } catch (error) {
      console.error('Error fetching scanner statuses:', error);
    }
  };

  const handleRetryEmail = async (emailId: string) => {
    setIsRetrying(emailId);
    try {
      const result = await retryFailedEmail(emailId);
      if (result.success) {
        toast({
          title: "Email requeued",
          description: "The email has been queued for retry.",
        });
        await fetchEmailStatuses();
      } else {
        toast({
          variant: "destructive",
          title: "Retry failed",
          description: result.error || "Could not requeue email.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Retry failed",
        description: error.message,
      });
    } finally {
      setIsRetrying(null);
    }
  };

  const loadData = async () => {
    setIsLoading(true);

    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch email and scanner statuses in parallel with other data
      fetchEmailStatuses();
      fetchScannerStatuses();
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = startOfDay(subDays(now, 6));
      const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const fourteenDaysAgo = startOfDay(subDays(now, 13));

      const { data: ticketsData, error: ticketsError } = await supabase
        .from<any>("tickets")
        .select(`
          price, 
          created_at, 
          purchase_date, 
          scanned_at, 
          event_name,
          ticket_type_id,
          ticket_types (
            name
          )
        `);
      if (ticketsError) throw ticketsError;

      const { data: ordersData, error: ordersError } = await supabase
        .from<any>("orders")
        .select("id, total, created_at, status, purchaser_email, purchaser_name, event_id, events(name)");
      if (ordersError) throw ordersError;

      // Transform tickets for distribution calculation
      const typeCounts = new Map<string, number>();
      (ticketsData || []).forEach((ticket: any) => {
        // Handle nested ticket_types object
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

      const { data: eventsData, error: eventsError } = await (supabase as any)
        .from("events")
        .select("id, name, event_date, metadata")
        .eq("is_active", true)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true });
      if (eventsError) throw eventsError;

      // Fetch ticket types for active events to calculate capacity
      const eventIds = (eventsData || []).map((e: any) => e.id);
      const { data: eventTicketTypes, error: ttError } = await supabase
        .from("ticket_types")
        .select("event_id, capacity:total_inventory")
        .in("event_id", eventIds);

      if (ttError) console.warn("Error fetching event ticket types:", ttError);

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
        const currentEventTypes = (eventTicketTypes || []).filter((tt: any) => tt.event_id === event.id);
        const capacityFromTiers = currentEventTypes.reduce((sum: number, tier: any) => sum + (tier?.capacity || 0), 0);
        // Fallback to 100 if no capacity found to avoid division by zero visual errors
        const capacity = capacityFromTiers > 0 ? capacityFromTiers : 100;
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
        vipTablesSold: distribution.find(d => d.name.toLowerCase().includes('table'))?.value || 0,
        vipRevenue: revenueTickets
          .filter((t: any) =>
            t.ticket_types?.name?.toLowerCase().includes('vip')
          )
          .reduce((sum, t: any) => sum + parsePrice(t.price), 0),
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

  // Real-time subscription for live dashboard updates
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // Set up real-time subscription for dashboard updates
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scan_logs',
        },
        () => {
          // Refresh dashboard stats when new scan occurs
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        () => {
          // Refresh dashboard stats when tickets change
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        () => {
          // Refresh dashboard stats when new order is placed
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_queue',
        },
        () => {
          // Refresh email statuses when queue changes
          fetchEmailStatuses();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scanner_heartbeats',
        },
        () => {
          // Refresh scanner statuses when heartbeats change
          fetchScannerStatuses();
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, []);

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
        className="w-full border-indigo-500/30 bg-indigo-500/10 text-white hover:bg-indigo-500/20 sm:w-auto"
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

  const vipStatsCard = (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10">
      <div className="flex items-center gap-4">
        <div className="rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-3 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <Wine className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium leading-none text-white">VIP Experience</p>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-amber-400 font-semibold">{stats.vipTablesSold} tables sold</span>
            <span className="text-slate-600">•</span>
            <span>{currencyFormatter.format(stats.vipRevenue)} revenue</span>
          </div>
        </div>
      </div>
    </div>
  );

  const heroSection = (
    <section>
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] p-6 shadow-[0_45px_90px_rgba(3,7,23,0.7)] sm:p-8">
        <div className="text-xs uppercase tracking-[0.4em] text-indigo-200/80">
          <span>{format(new Date(), "PPPP")}</span>
        </div>
        <div className="mt-6">
          <p className="text-lg text-slate-300">
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
            className="w-full justify-center rounded-2xl bg-indigo-500/20 text-white hover:bg-indigo-500/30 sm:flex-1"
            onClick={() => navigate("/analytics")}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            View analytics
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center rounded-2xl border-indigo-500/30 bg-indigo-500/10 text-white hover:bg-indigo-500/20 sm:flex-1"
            onClick={() => navigate("/events")}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Manage events
          </Button>
        </div>
      </div>
    </section>
  );

  return (
    <OwnerPortalLayout
      title={`${getGreeting()}, Felix`}
      actions={headerActions}
      hero={heroSection}
    >
      {/* Recent Purchases + Operational Insights - Side by Side */}
      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <RecentPurchases orders={recentOrders} currencyFormatter={currencyFormatter} />
        </div>

        <Card className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl transition-all duration-300 hover:border-white/20">
          <CardHeader>
            <CardTitle className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Operational Insights</CardTitle>
            <CardDescription className="text-slate-400">Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.map((item) => (
              <div key={item.title} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none text-white">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.helper}</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-white">{item.value}</span>
                  {item.trendLabel && (
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">
                      {item.trendValue} {item.trendLabel}
                    </p>
                  )}
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 p-3 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none text-white">Scan Status</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-emerald-400 font-semibold">{stats.totalTicketsScanned} scanned</span>
                    <span className="text-slate-600">•</span>
                    <span>{Math.max(stats.totalTicketsSold - stats.totalTicketsScanned, 0)} pending</span>
                  </div>
                </div>
              </div>
              {/* Progress bar visual */}
              <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats.totalTicketsSold > 0 ? (stats.totalTicketsScanned / stats.totalTicketsSold) * 100 : 0}%` }}
                />
              </div>
            </div>

            {vipStatsCard}

            {/* Email Status Section */}
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10">
              <div className="flex items-center gap-4 mb-3">
                <div className="rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 p-3 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none text-white">Email Delivery</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-emerald-400 font-semibold">
                      {emailStatusList.filter(e => e.status === 'delivered').length} delivered
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-yellow-400">
                      {emailStatusList.filter(e => e.status === 'pending' || e.status === 'processing').length} pending
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-red-400">
                      {emailStatusList.filter(e => e.status === 'failed').length} failed
                    </span>
                  </div>
                </div>
              </div>
              {/* Recent email statuses */}
              {emailStatusList.length > 0 && (
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                  {emailStatusList.slice(0, 5).map((emailStatus) => (
                    <div key={emailStatus.id} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-300 truncate">{emailStatus.recipient_email || 'No email'}</p>
                        <p className="text-slate-500 truncate">{emailStatus.subject || emailStatus.email_type}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getEmailStatusColor(emailStatus.status)}`}>
                          {getEmailStatusLabel(emailStatus.status)}
                        </span>
                        {emailStatus.status === 'failed' && (
                          <button
                            onClick={() => handleRetryEmail(emailStatus.id)}
                            disabled={isRetrying === emailStatus.id}
                            className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
                            title="Retry email"
                          >
                            <RefreshCw className={`h-3 w-3 ${isRetrying === emailStatus.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {emailStatusList.length === 0 && (
                <p className="text-xs text-slate-500 mt-2">No recent emails</p>
              )}
            </div>

            {/* Scanner Status Section */}
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10">
              <div className="flex items-center gap-4 mb-3">
                <div className="rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-3 text-green-300 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none text-white">Scanner Status</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-emerald-400 font-semibold">
                      {scannerStatuses.filter(s => s.isOnline).length} online
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-red-400">
                      {scannerStatuses.filter(s => !s.isOnline).length} offline
                    </span>
                  </div>
                </div>
              </div>

              {/* Scanner list */}
              {scannerStatuses.length > 0 ? (
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                  {scannerStatuses.map((scanner) => (
                    <div
                      key={scanner.deviceId}
                      className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {scanner.isOnline ? (
                          <Wifi className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <WifiOff className="h-3 w-3 text-red-400" />
                        )}
                        <span className="text-slate-300">
                          {scanner.deviceName || scanner.deviceId.slice(0, 12)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {scanner.currentEventName && (
                          <span className="text-slate-500 truncate max-w-[100px]">
                            {scanner.currentEventName}
                          </span>
                        )}
                        <span className="text-slate-400">
                          {scanner.scansToday} scans
                        </span>
                        {scanner.pendingScans > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/20 text-yellow-400">
                            {scanner.pendingScans} pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">No active scanners</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

    </OwnerPortalLayout>
  );
};

export default OwnerDashboard;

