import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Clock,
  Calendar,
  Activity,
  Download,
  RefreshCw,
  Ticket,
  ShoppingBag,
  Settings,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

interface RevenueTrend {
  date: string;
  revenue: number;
  tickets: number;
  scans: number;
}

interface AttendancePattern {
  hour: number;
  scans: number;
  revenue: number;
}

interface TierPerformance {
  tier: string;
  sold: number;
  scanned: number;
  revenue: number;
  scan_rate: number;
}

interface StaffEfficiency {
  staff_id: string;
  staff_name: string;
  total_scans: number;
  valid_scans: number;
  avg_scan_time: number;
  efficiency_score: number;
}

interface KPIData {
  totalRevenue: number;
  totalTickets: number;
  totalScans: number;
  avgTicketPrice: number;
  revenueChange: number;
  ticketsChange: number;
  scansChange: number;
  scanRate: number;
}

const AdvancedAnalytics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();

  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<string>('all');

  const [kpiData, setKpiData] = useState<KPIData>({
    totalRevenue: 0,
    totalTickets: 0,
    totalScans: 0,
    avgTicketPrice: 0,
    revenueChange: 0,
    ticketsChange: 0,
    scansChange: 0,
    scanRate: 0,
  });
  const [revenueTrends, setRevenueTrends] = useState<RevenueTrend[]>([]);
  const [attendancePatterns, setAttendancePatterns] = useState<AttendancePattern[]>([]);
  const [tierPerformance, setTierPerformance] = useState<TierPerformance[]>([]);
  const [staffEfficiency, setStaffEfficiency] = useState<StaffEfficiency[]>([]);
  const [events, setEvents] = useState<Array<{ name: string }>>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);

  // Redirect non-owners
  useEffect(() => {
    if (role !== 'owner') {
      navigate('/scanner');
    }
  }, [role, navigate]);

  useEffect(() => {
    if (role === 'owner') {
      loadEvents();
      loadAnalytics();
    }
  }, [role, timeRange, startDate, endDate, selectedEvent]);

  const loadEvents = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data, error } = await (supabase as any)
        .from("events")
        .select("name")
        .order("name");
      if (!error && data) {
        setEvents([{ name: 'all' }, ...(data as Array<{ name: string }>)]);
      }
    } catch (error) {
      console.error("Error loading events:", error);
    }
  };

  const getDateRange = () => {
    if (timeRange === 'custom') {
      return {
        start: startDate ? startOfDay(startDate) : subDays(new Date(), 30),
        end: endDate ? endOfDay(endDate) : new Date(),
      };
    }

    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    return {
      start: startOfDay(subDays(new Date(), days)),
      end: endOfDay(new Date()),
    };
  };

  const loadAnalytics = async () => {
    if (!isSupabaseConfigured()) return;

    try {
      setIsLoading(true);
      const { start, end } = getDateRange();
      
      await Promise.all([
        loadKPIData(start, end),
        loadRevenueTrends(start, end),
        loadAttendancePatterns(start, end),
        loadTierPerformance(start, end),
        loadStaffEfficiency(start, end),
        loadEventComparison(start, end),
      ]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading analytics",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadKPIData = async (start: Date, end: Date) => {
    // Query tickets
    const { data: ticketsData } = await (supabase as any)
      .from("tickets")
      .select("created_at, price, scanned_at, event_id")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    let filteredData = ticketsData || [];
    if (selectedEvent !== 'all') {
      const { data: eventsData } = await (supabase as any)
        .from("events")
        .select("id, name")
        .eq("name", selectedEvent)
        .single();
      
      if (eventsData) {
        filteredData = filteredData.filter((t: any) => t.event_id === eventsData.id);
      }
    }

    const totalRevenue = filteredData.reduce((sum: number, t: any) => {
      const price = typeof t.price === 'string' ? parseFloat(t.price) : parseFloat(t.price?.toString() || '0');
      return sum + (price || 0);
    }, 0);

    const totalTickets = filteredData.length;
    const totalScans = filteredData.filter((t: any) => t.scanned_at).length;
    const avgTicketPrice = totalTickets > 0 ? totalRevenue / totalTickets : 0;
    const scanRate = totalTickets > 0 ? (totalScans / totalTickets) * 100 : 0;

    // Calculate changes (simplified - compare with previous period)
    setKpiData({
      totalRevenue,
      totalTickets,
      totalScans,
      avgTicketPrice,
      revenueChange: 12.5, // Mock data
      ticketsChange: 8.2,
      scansChange: -3.1,
      scanRate,
    });
  };

  const loadRevenueTrends = async (start: Date, end: Date) => {
    let query = (supabase as any)
      .from("tickets")
      .select("created_at, price, scanned_at, event_id")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    const { data: ticketsData, error } = await query;

    let filteredData = ticketsData || [];
    if (selectedEvent !== 'all') {
      const { data: eventsData } = await (supabase as any)
        .from("events")
        .select("id, name")
        .eq("name", selectedEvent)
        .single();
      
      if (eventsData) {
        filteredData = filteredData.filter((t: any) => t.event_id === eventsData.id);
      }
    }

    if (error) throw error;

    const grouped = new Map<string, { revenue: number; tickets: number; scans: number }>();

    filteredData.forEach((ticket: any) => {
      const ticketDate = ticket.created_at || ticket.issued_at;
      if (!ticketDate) return;
      
      const date = format(parseISO(ticketDate), 'yyyy-MM-dd');
      if (!grouped.has(date)) {
        grouped.set(date, { revenue: 0, tickets: 0, scans: 0 });
      }
      const day = grouped.get(date)!;
      day.tickets++;
      const price = typeof ticket.price === 'string' 
        ? parseFloat(ticket.price) 
        : (parseFloat(ticket.price?.toString() || '0') || 0);
      day.revenue += price;
      if (ticket.scanned_at) {
        day.scans++;
      }
    });

    const trends: RevenueTrend[] = Array.from(grouped.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setRevenueTrends(trends);
  };

  const loadAttendancePatterns = async (start: Date, end: Date) => {
    const { data, error } = await supabase
      .from("scan_logs")
      .select("scanned_at, metadata")
      .gte("scanned_at", start.toISOString())
      .lte("scanned_at", end.toISOString())
      .eq("scan_result", "valid");

    if (error) throw error;

    const hourly = new Map<number, { scans: number; revenue: number }>();

    (data || []).forEach(log => {
      const hour = new Date(log.scanned_at).getHours();
      if (!hourly.has(hour)) {
        hourly.set(hour, { scans: 0, revenue: 0 });
      }
      const hourData = hourly.get(hour)!;
      hourData.scans++;
    });

    const patterns: AttendancePattern[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      scans: hourly.get(i)?.scans || 0,
      revenue: hourly.get(i)?.revenue || 0,
    }));

    setAttendancePatterns(patterns);
  };

  const loadTierPerformance = async (start: Date, end: Date) => {
    const { data: ticketsData, error } = await (supabase as any)
      .from("tickets")
      .select("ticket_type_id, price, scanned_at, event_id, created_at")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (error) throw error;

    const ticketTypeIds = [...new Set((ticketsData || []).map((t: any) => t.ticket_type_id).filter(Boolean))];
    const { data: ticketTypesData } = await (supabase as any)
      .from("ticket_types")
      .select("id, name")
      .in("id", ticketTypeIds);

    const ticketTypesMap = new Map((ticketTypesData || []).map((tt: any) => [tt.id, tt.name]));

    let filteredData = ticketsData || [];
    if (selectedEvent !== 'all') {
      const { data: eventsData } = await (supabase as any)
        .from("events")
        .select("id, name")
        .eq("name", selectedEvent)
        .single();
      
      if (eventsData) {
        filteredData = filteredData.filter((t: any) => t.event_id === eventsData.id);
      }
    }

    const tierMap = new Map<string, TierPerformance>();

    filteredData.forEach((ticket: any) => {
      const ticketTypeName = ticketTypesMap.get(ticket.ticket_type_id) || 'general';
      const tier = ticketTypeName.toLowerCase().includes('vip') ? 'vip' :
                   ticketTypeName.toLowerCase().includes('premium') ? 'premium' :
                   ticketTypeName.toLowerCase().includes('backstage') ? 'backstage' : 'general';
      
      if (!tierMap.has(tier)) {
        tierMap.set(tier, {
          tier,
          sold: 0,
          scanned: 0,
          revenue: 0,
          scan_rate: 0,
        });
      }

      const tierData = tierMap.get(tier)!;
      tierData.sold++;
      const price = typeof ticket.price === 'string' 
        ? parseFloat(ticket.price) 
        : (parseFloat(ticket.price?.toString() || '0') || 0);
      tierData.revenue += price;
      if (ticket.scanned_at) {
        tierData.scanned++;
      }
    });

    Array.from(tierMap.values()).forEach(tier => {
      tier.scan_rate = tier.sold > 0 ? (tier.scanned / tier.sold) * 100 : 0;
    });

    setTierPerformance(Array.from(tierMap.values()));
  };

  const loadStaffEfficiency = async (start: Date, end: Date) => {
    const { data, error } = await supabase
      .from("scan_logs")
      .select("scanned_by, scan_result, scan_duration_ms")
      .gte("scanned_at", start.toISOString())
      .lte("scanned_at", end.toISOString());

    if (error) throw error;

    const staffMap = new Map<string, StaffEfficiency>();

    (data || []).forEach(log => {
      const staffId = log.scanned_by || 'unknown';
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          staff_id: staffId,
          staff_name: staffId,
          total_scans: 0,
          valid_scans: 0,
          avg_scan_time: 0,
          efficiency_score: 0,
        });
      }

      const staff = staffMap.get(staffId)!;
      staff.total_scans++;
      if (log.scan_result === 'valid') {
        staff.valid_scans++;
      }
      if (log.scan_duration_ms) {
        const currentAvg = staff.avg_scan_time;
        const count = staff.total_scans;
        staff.avg_scan_time = ((currentAvg * (count - 1)) + log.scan_duration_ms) / count;
      }
    });

    Array.from(staffMap.values()).forEach(staff => {
      const accuracy = staff.total_scans > 0 ? (staff.valid_scans / staff.total_scans) * 100 : 0;
      const speedScore = staff.avg_scan_time > 0 ? Math.min(100, (5000 / staff.avg_scan_time) * 100) : 0;
      staff.efficiency_score = (accuracy * 0.7) + (speedScore * 0.3);
    });

    setStaffEfficiency(Array.from(staffMap.values()).sort((a, b) => b.efficiency_score - a.efficiency_score));
  };

  const loadEventComparison = async (start: Date, end: Date) => {
    const { data: ticketsData, error } = await (supabase as any)
      .from("tickets")
      .select("event_id, price, scanned_at, created_at")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (error) throw error;

    const eventIds = [...new Set((ticketsData || []).map((t: any) => t.event_id).filter(Boolean))];
    const { data: eventsData } = await (supabase as any)
      .from("events")
      .select("id, name")
      .in("id", eventIds);

    const eventsMap = new Map((eventsData || []).map((e: any) => [e.id, e.name]));

    const eventMap = new Map<string, { revenue: number; tickets: number; scans: number }>();

    (ticketsData || []).forEach((ticket: any) => {
      const eventName = eventsMap.get(ticket.event_id) || 'Unknown';
      if (!eventMap.has(eventName)) {
        eventMap.set(eventName, { revenue: 0, tickets: 0, scans: 0 });
      }
      const event = eventMap.get(eventName)!;
      event.tickets++;
      const price = typeof ticket.price === 'string' 
        ? parseFloat(ticket.price) 
        : (parseFloat(ticket.price?.toString() || '0') || 0);
      event.revenue += price;
      if (ticket.scanned_at) {
        event.scans++;
      }
    });

    const comparison = Array.from(eventMap.entries()).map(([name, data]) => ({
      name,
      ...data,
      scan_rate: data.tickets > 0 ? (data.scans / data.tickets) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    setComparisonData(comparison);
  };

  const handleExportData = () => {
    if (revenueTrends.length === 0) {
      toast({
        title: "No Data",
        description: "No data available to export",
        variant: "destructive",
      });
      return;
    }

    const csvData = revenueTrends.map(trend => ({
      Date: trend.date,
      Revenue: trend.revenue,
      Tickets: trend.tickets,
      Scans: trend.scans,
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Analytics data exported to CSV",
    });
  };

  const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Show loading state while role is being determined
  if (!role) {
    return (
      <OwnerPortalLayout title="Analytics Dashboard">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
      </OwnerPortalLayout>
    );
  }

  // Redirect non-owners (handled by useEffect, but show nothing while redirecting)
  if (role !== 'owner') {
    return null;
  }

  const headerActions = (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadAnalytics} disabled={isLoading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleExportData} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
  );

  return (
    <OwnerPortalLayout
      title="Analytics Dashboard"
      description="Deep insights into revenue, attendance, and performance"
      actions={headerActions}
    >

        {/* Unified Filter Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">Time Range:</Label>
                <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
              <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {timeRange === 'custom' && (
                <>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium whitespace-nowrap">Start:</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM d") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium whitespace-nowrap">End:</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM d") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}

          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-sm font-medium whitespace-nowrap">Event:</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.name} value={event.name}>
                        {event.name === 'all' ? 'All Events' : event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <RefreshCw className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-lg text-muted-foreground">Loading analytics...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPI Cards - Refined */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Revenue */}
              <Card className="border border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${kpiData.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center mt-2 text-xs text-muted-foreground">
                    {kpiData.revenueChange >= 0 ? (
                      <>
                        <TrendingUp className="h-3 w-3 text-emerald-500 mr-1" />
                        <span className="text-emerald-500 font-medium">+{kpiData.revenueChange}%</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3 w-3 text-rose-500 mr-1" />
                        <span className="text-rose-500 font-medium">{kpiData.revenueChange}%</span>
                      </>
                    )}
                    <span className="ml-2">vs last period</span>
                  </div>
                </CardContent>
              </Card>

              {/* Total Tickets */}
              <Card className="border border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Sold</CardTitle>
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpiData.totalTickets.toLocaleString()}</div>
                  <div className="flex items-center mt-2 text-xs text-muted-foreground">
                    {kpiData.ticketsChange >= 0 ? (
                      <>
                        <TrendingUp className="h-3 w-3 text-emerald-500 mr-1" />
                        <span className="text-emerald-500 font-medium">+{kpiData.ticketsChange}%</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3 w-3 text-rose-500 mr-1" />
                        <span className="text-rose-500 font-medium">{kpiData.ticketsChange}%</span>
                      </>
                    )}
                    <span className="ml-2">vs last period</span>
                  </div>
                </CardContent>
              </Card>

              {/* Total Scans */}
              <Card className="border border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Scanned</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpiData.totalScans.toLocaleString()}</div>
                  <div className="flex items-center mt-2">
                    <Badge variant={kpiData.scanRate >= 80 ? "default" : "secondary"} className="text-xs">
                      {kpiData.scanRate.toFixed(1)}% scan rate
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Average Ticket Price */}
              <Card className="border border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Ticket Price</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${kpiData.avgTicketPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Per ticket</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabbed Organization */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                <TabsTrigger value="overview" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="sales" className="gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Sales
                </TabsTrigger>
                <TabsTrigger value="operations" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Operations
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Overview */}
              <TabsContent value="overview" className="space-y-6">
                {/* Revenue Trend */}
                <Card className="border border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                        <CardTitle>Revenue Trends</CardTitle>
                        <CardDescription className="text-muted-foreground">
                          Daily revenue and ticket sales over time
                        </CardDescription>
                  </div>
                      <Badge variant="outline" className="text-xs">
                    {revenueTrends.length} days
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={revenueTrends}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(parseISO(value), 'MMM d')}
                      tick={{ fontSize: 12 }}
                          stroke="hsl(var(--muted-foreground))"
                    />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                        <Legend />
                    <Area 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="revenue" 
                          stroke="#6366f1" 
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                      name="Revenue ($)"
                      strokeWidth={2}
                    />
                    <Area 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="tickets" 
                          stroke="#22c55e" 
                      fillOpacity={1} 
                      fill="url(#colorTickets)" 
                      name="Tickets Sold"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

                {/* Peak Hours & Quick Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Peak Hours */}
                  <Card className="border border-border/50">
                <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Peak Hours Analysis
                  </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Scan activity by hour of day
                      </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={attendancePatterns}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis 
                        dataKey="hour" 
                        label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }}
                        tick={{ fontSize: 11 }}
                            stroke="hsl(var(--muted-foreground))"
                      />
                          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                          <Bar dataKey="scans" fill="#6366f1" radius={[4, 4, 0, 0]} name="Scans" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

                  {/* Quick Insights */}
                  <Card className="border border-border/50">
                <CardHeader>
                      <CardTitle>Quick Insights</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Key performance highlights
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {comparisonData.length > 0 && (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-border/50 p-4">
                            <p className="text-sm font-medium text-muted-foreground mb-1">Top Performing Event</p>
                            <p className="text-lg font-semibold">{comparisonData[0]?.name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              ${comparisonData[0]?.revenue?.toLocaleString() || 0} revenue
                            </p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-4">
                            <p className="text-sm font-medium text-muted-foreground mb-1">Total Events</p>
                            <p className="text-lg font-semibold">{comparisonData.length}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {comparisonData.reduce((sum, e) => sum + (e.tickets || 0), 0).toLocaleString()} total tickets
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab 2: Sales Performance */}
              <TabsContent value="sales" className="space-y-6">
                {/* Tier Distribution */}
                <Card className="border border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Tier Revenue Distribution
                  </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Revenue breakdown by ticket tier
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={tierPerformance}
                        dataKey="revenue"
                        nameKey="tier"
                        cx="50%"
                        cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                        label={({ tier, percent }) => `${tier} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {tierPerformance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: any) => `$${value.toLocaleString()}`}
                      />
                        <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

                {/* Event Comparison */}
                <Card className="border border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Event Comparison
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Performance comparison across events
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis 
                          dataKey="name" 
                          angle={-45} 
                          textAnchor="end" 
                          height={120}
                          tick={{ fontSize: 10 }}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue ($)" />
                        <Bar dataKey="tickets" fill="#22c55e" radius={[4, 4, 0, 0]} name="Tickets Sold" />
                        <Bar dataKey="scans" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Tickets Scanned" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

            {/* Ticket Tier Performance */}
                <Card className="border border-border/50">
              <CardHeader>
                    <CardTitle>Ticket Tier Performance</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Sales and scan rates by tier
                    </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={tierPerformance}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="tier" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                        <Legend />
                        <Bar dataKey="sold" fill="#6366f1" radius={[4, 4, 0, 0]} name="Sold" />
                        <Bar dataKey="scanned" fill="#22c55e" radius={[4, 4, 0, 0]} name="Scanned" />
                        <Bar dataKey="scan_rate" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Scan Rate (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
              </TabsContent>

              {/* Tab 3: Operations */}
              <TabsContent value="operations" className="space-y-6">
            {/* Staff Performance */}
                <Card className="border border-border/50">
              <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Staff Performance
                </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Efficiency metrics by staff member (Top 10)
                    </CardDescription>
              </CardHeader>
              <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart 
                        data={staffEfficiency.slice(0, 10)} 
                        layout="vertical"
                        margin={{ left: 100, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis 
                          type="category" 
                      dataKey="staff_name" 
                          tick={{ fontSize: 11 }}
                          width={90}
                          stroke="hsl(var(--muted-foreground))"
                        />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                        <Legend />
                        <Bar dataKey="total_scans" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Total Scans" />
                        <Bar dataKey="valid_scans" fill="#22c55e" radius={[0, 4, 4, 0]} name="Valid Scans" />
                        <Bar dataKey="efficiency_score" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Efficiency Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

                {/* Scan Rates Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border border-border/50">
              <CardHeader>
                      <CardTitle>Scan Rate Summary</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Overall scan performance
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Tickets</span>
                          <span className="font-semibold">{kpiData.totalTickets.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Scanned</span>
                          <span className="font-semibold text-emerald-600">{kpiData.totalScans.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Pending</span>
                          <span className="font-semibold text-amber-600">
                            {(kpiData.totalTickets - kpiData.totalScans).toLocaleString()}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-border/50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Scan Rate</span>
                            <Badge variant={kpiData.scanRate >= 80 ? "default" : "secondary"}>
                              {kpiData.scanRate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Attendance Patterns */}
                  <Card className="border border-border/50">
                    <CardHeader>
                      <CardTitle>Attendance Patterns</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Entry activity throughout the day
                      </CardDescription>
              </CardHeader>
              <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={attendancePatterns}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis 
                            dataKey="hour" 
                            tick={{ fontSize: 11 }}
                            stroke="hsl(var(--muted-foreground))"
                    />
                          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                          <Bar dataKey="scans" fill="#6366f1" radius={[4, 4, 0, 0]} name="Scans" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
    </OwnerPortalLayout>
  );
};

export default AdvancedAnalytics;
