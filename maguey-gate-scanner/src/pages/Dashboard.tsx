import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { localStorageService } from "@/lib/localStorage";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { resolveStaffNames, getStaffDisplayName } from "@/lib/staff-name-service";
import { Navigation } from "@/components/layout/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart3, 
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  TrendingUp,
  DollarSign,
  CalendarRange,
  PieChart,
  Sun,
  LogIn,
  IdCard
} from "lucide-react";
import type { ScanLog } from "@/lib/localStorage";
import { getCurrentlyInsideCount } from "@/lib/re-entry-service";
import { getScanMetrics, getScannerPerformance, getScanRateOverTime, type ScannerPerformance } from "@/lib/scan-metrics-service";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getAllTiers, getTierColor, getTierDisplayName, type TicketTier } from "@/lib/tier-service";
import { getIDVerificationStats } from "@/lib/id-verification-service";
import { getOverrideStats, getRecentOverrideLogs, type OverrideLog } from "@/lib/emergency-override-service";
import { AlertTriangle, FileText, FileSpreadsheet } from "lucide-react";
import {
  exportScanLogsCSV,
  exportScanLogsPDF,
  exportScanLogsExcel,
  exportRevenueReportExcel,
  exportStaffPerformanceExcel,
  exportDiscrepanciesCSV,
  fetchScanLogs,
  fetchRevenueReport,
  fetchStaffPerformance,
  fetchDiscrepancies,
  type ReportFilters,
} from "@/lib/report-service";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { FraudAlertsWidget } from "@/components/dashboard/FraudAlertsWidget";
import { NotificationFeed } from "@/components/dashboard/NotificationFeed";
import { UnifiedCapacityDisplay } from "@/components/dashboard/UnifiedCapacityDisplay";
import { DiscrepancyAlerts } from "@/components/dashboard/DiscrepancyAlerts";
import { EntryExitFlowVisualization } from "@/components/dashboard/EntryExitFlowVisualization";
import { getTicketsSoldPerEvent, getDailyWeeklySales, getCheckInRates, type TicketsSoldPerEvent, type DailyWeeklySales, type CheckInRate } from "@/lib/analytics-service";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { RevenueVerification } from "@/components/dashboard/RevenueVerification";
import { CheckInProgress } from "@/components/dashboard/CheckInProgress";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();
  const [isLoading, setIsLoading] = useState(true);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [tierStats, setTierStats] = useState<Record<string, {
    revenue: number;
    count: number;
    scanCount: number;
    scanRate: number;
  }>>({});
  const [stats, setStats] = useState({
    totalScans: 0,
    todayScans: 0,
    validScans: 0,
    invalidScans: 0,
    recentScans: [] as ScanLog[],
    todayRevenue: 0,
    todayTickets: 0,
    weekRevenue: 0,
    weekTickets: 0,
    monthRevenue: 0,
    monthTickets: 0,
    totalRevenue: 0,
    totalRevenueTickets: 0,
    currentlyInside: 0,
    idVerificationStats: {
      total: 0,
      verified: 0,
      notVerified: 0,
      skipped: 0,
      complianceRate: 0,
    },
  });
  const [scanSpeedMetrics, setScanSpeedMetrics] = useState<{
    currentRate: number;
    todayAverage: number;
    peakRate: number;
    peakRateTime: string | null;
    avgDurationMs: number;
    totalScans: number;
  } | null>(null);
  const [scannerPerformance, setScannerPerformance] = useState<ScannerPerformance[]>([]);
  const [scanRateChartData, setScanRateChartData] = useState<Array<{
    period_start: string;
    scans_per_minute: number;
  }>>([]);
  const [overrideStats, setOverrideStats] = useState<{
    total_overrides: number;
    capacity_overrides: number;
    refund_overrides: number;
    transfer_overrides: number;
    id_verification_overrides: number;
    duplicate_overrides: number;
    unique_users: number;
  } | null>(null);
  const [recentOverrideLogs, setRecentOverrideLogs] = useState<OverrideLog[]>([]);
  const [activeEvent, setActiveEvent] = useState<{ id: string; name: string } | null>(null);
  const [ticketsSoldPerEvent, setTicketsSoldPerEvent] = useState<TicketsSoldPerEvent[]>([]);
  const [dailyWeeklySales, setDailyWeeklySales] = useState<DailyWeeklySales[]>([]);
  const [checkInRates, setCheckInRates] = useState<CheckInRate[]>([]);
  const [salesPeriod, setSalesPeriod] = useState<'daily' | 'weekly'>('daily');
  
  // Report export state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [reportType, setReportType] = useState<'scan-logs' | 'revenue' | 'staff-performance' | 'discrepancies'>('scan-logs');
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'excel'>('csv');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [exportEventName, setExportEventName] = useState<string>('');
  const [exportTicketTier, setExportTicketTier] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [availableEvents, setAvailableEvents] = useState<Array<{ name: string }>>([]);

  // Real-time subscription hook for dashboard updates
  const { isLive, lastUpdate } = useDashboardRealtime({
    tables: ['tickets', 'orders', 'vip_reservations', 'scan_logs'],
    onUpdate: () => {
      loadData();
      loadScanSpeedMetrics();
      loadAnalytics();
    },
  });

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  const revenueBreakdown = [
    {
      label: "Today",
      description: "Since midnight",
      amount: stats.todayRevenue,
      tickets: stats.todayTickets,
      icon: Sun,
      border: "border-emerald-400/30",
      bg: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-300",
    },
    {
      label: "This Week",
      description: "Last 7 days",
      amount: stats.weekRevenue,
      tickets: stats.weekTickets,
      icon: CalendarRange,
      border: "border-sky-400/30",
      bg: "from-sky-500/15 via-sky-500/5 to-transparent",
      iconBg: "bg-sky-500/10",
      iconColor: "text-sky-300",
    },
    {
      label: "This Month",
      description: new Date().toLocaleString("default", { month: "long" }),
      amount: stats.monthRevenue,
      tickets: stats.monthTickets,
      icon: PieChart,
      border: "border-purple-400/30",
      bg: "from-purple-500/15 via-purple-500/5 to-transparent",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-300",
    },
  ];

  // Redirect employees to scanner
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Analytics dashboard is only available to owners.",
      });
      navigate("/scanner");
    }
  }, [role, navigate, toast]);

  useEffect(() => {
    const checkAuth = async () => {
      const isConfigured = isSupabaseConfigured();
      
      if (isConfigured) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (!session) {
            navigate("/auth");
            return;
          }
        } catch (error: any) {
          console.error("Auth error:", error);
          navigate("/auth");
          return;
        }
      } else {
        // Development mode - use local storage
        if (import.meta.env.DEV) {
          const localUser = localStorageService.getUser();
          if (!localUser) {
            navigate("/auth");
            return;
          }
        } else {
          navigate("/auth");
          return;
        }
      }
      
      setIsLoading(false);
      loadData();
      loadScanSpeedMetrics();
      loadAnalytics();
    };

    checkAuth();
  }, [navigate]);

  const loadAnalytics = async () => {
    if (!isSupabaseConfigured()) return;
    
    try {
      const [ticketsSold, sales, checkIns] = await Promise.all([
        getTicketsSoldPerEvent(),
        getDailyWeeklySales(salesPeriod),
        getCheckInRates(),
      ]);
      
      setTicketsSoldPerEvent(ticketsSold);
      setDailyWeeklySales(sales);
      setCheckInRates(checkIns);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured()) {
      loadAnalytics();
    }
  }, [salesPeriod]);

  // Update scan speed metrics periodically
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    
    loadScanSpeedMetrics();
    const interval = setInterval(loadScanSpeedMetrics, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadScanSpeedMetrics = async () => {
    if (!isSupabaseConfigured()) return;
    
    try {
      const metrics = await getScanMetrics();
      setScanSpeedMetrics(metrics);

      // Load scanner performance leaderboard
      const performance = await getScannerPerformance();
      setScannerPerformance(performance);

      // Load scan rate over time for chart
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const chartData = await getScanRateOverTime(todayStart, new Date(), 15);
      setScanRateChartData(chartData.map(d => ({
        period_start: new Date(d.period_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        scans_per_minute: d.scans_per_minute,
      })));
    } catch (error: any) {
      console.error('Error loading scan speed metrics:', error);
    }
  };

  const loadData = () => {
    const isConfigured = isSupabaseConfigured();
    
    if (isConfigured) {
      loadSupabaseData();
    } else {
      // Load from local storage
      const logs = localStorageService.getScanLogs();
      setScanLogs(logs);
      const tickets = localStorageService.getTickets();
      calculateStats(logs, tickets);
      calculateTierStats(logs, tickets);
    }
  };

  const loadSupabaseData = async () => {
    try {
      // Load scan logs
      const { data: logsData, error: logsError } = await supabase
        .from("scan_logs")
        .select("*, override_used, override_reason")
        .order("scanned_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      
      const logs = (logsData || []).map(log => ({
        id: log.id,
        ticket_id: log.ticket_id,
        scanned_by: log.scanned_by,
        scan_result: log.scan_result,
        scanned_at: log.scanned_at,
        metadata: log.metadata,
        override_used: (log as any).override_used || false,
        override_reason: (log as any).override_reason || null,
      }));

      // Resolve staff names for all scanned_by UUIDs
      const scannerIds = [...new Set(logs.map(l => l.scanned_by).filter(Boolean))];
      if (scannerIds.length > 0) {
        await resolveStaffNames(scannerIds);
      }

      setScanLogs(logs);

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select("price, created_at, scanned_at, ticket_type_id, ticket_types(name)");

      if (ticketsError) throw ticketsError;

      // Transform tickets data to match expected format
      const transformedTickets = (ticketsData || []).map((ticket: any) => ({
        price_paid: ticket.price || 0,
        created_at: ticket.created_at,
        purchase_date: ticket.created_at || ticket.issued_at,
        tier: ticket.ticket_types?.name?.toLowerCase().includes('vip') ? 'vip' : 
              ticket.ticket_types?.name?.toLowerCase().includes('premium') ? 'premium' : 'general',
        ticket_type: ticket.ticket_types?.name || 'general',
        scanned_at: ticket.scanned_at,
      }));

      // Load re-entry stats
      const currentlyInside = await getCurrentlyInsideCount();
      
      // Load ID verification stats
      const idVerificationStats = await getIDVerificationStats();
      
      calculateStats(logs, transformedTickets, currentlyInside, idVerificationStats);
      calculateTierStats(logs, transformedTickets);
      
      // Load override statistics
      const overrideStatsData = await getOverrideStats();
      setOverrideStats(overrideStatsData);
      
      const overrideLogs = await getRecentOverrideLogs(20);
      setRecentOverrideLogs(overrideLogs);

      // Load active event for door counter integration (use type assertion for events table)
      const { data: eventsData, error: eventsError } = await (supabase as any)
        .from("events")
        .select("id, name")
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: false })
        .limit(1);

      if (!eventsError && eventsData && eventsData.length > 0) {
        setActiveEvent({ id: (eventsData[0] as any).id, name: (eventsData[0] as any).name });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading data",
        description: error.message,
      });
    }
  };

  const calculateTierStats = async (logs: ScanLog[], tickets: Array<{ 
    price_paid: number | string | null; 
    created_at?: string | null; 
    purchase_date?: string | null;
    tier?: string | null;
    ticket_type?: string | null;
    scanned_at?: string | null;
  }> = []) => {
    const parsePrice = (value: number | string | null | undefined) => {
      if (value === null || value === undefined) return 0;
      const parsed = typeof value === "string" ? parseFloat(value) : value;
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const tierBreakdown: Record<string, {
      revenue: number;
      count: number;
      scanCount: number;
      scanRate: number;
    }> = {};

    // Process tickets by tier
    tickets.forEach((ticket) => {
      const tier = ticket.tier || (ticket.ticket_type?.toLowerCase().includes('vip') ? 'vip' :
                                   ticket.ticket_type?.toLowerCase().includes('premium') ? 'premium' :
                                   ticket.ticket_type?.toLowerCase().includes('backstage') ? 'backstage' : 'general');
      
      if (!tierBreakdown[tier]) {
        tierBreakdown[tier] = {
          revenue: 0,
          count: 0,
          scanCount: 0,
          scanRate: 0,
        };
      }

      tierBreakdown[tier].revenue += parsePrice(ticket.price_paid);
      tierBreakdown[tier].count += 1;
      
      if (ticket.scanned_at) {
        tierBreakdown[tier].scanCount += 1;
      }
    });

    // Calculate scan rates
    Object.keys(tierBreakdown).forEach((tier) => {
      const stats = tierBreakdown[tier];
      stats.scanRate = stats.count > 0 ? (stats.scanCount / stats.count) * 100 : 0;
    });

    setTierStats(tierBreakdown);
  };

  const calculateStats = (logs: ScanLog[], tickets: Array<{ price_paid: number | string | null; created_at?: string | null; purchase_date?: string | null }> = [], currentlyInside: number = 0, idVerificationStats?: { total: number; verified: number; notVerified: number; skipped: number; complianceRate: number }) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const todayScans = logs.filter(log => {
      const scanDate = new Date(log.scanned_at);
      return scanDate >= todayStart;
    });

    const validScans = logs.filter(log => log.scan_result === 'valid' || log.scan_result === 'scanned');
    const invalidScans = logs.filter(log => log.scan_result === 'invalid');

    const parsePrice = (value: number | string | null | undefined) => {
      if (value === null || value === undefined) return 0;
      const parsed = typeof value === "string" ? parseFloat(value) : value;
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const resolveDate = (ticket: { created_at?: string | null; purchase_date?: string | null }) => {
      return ticket.created_at || ticket.purchase_date || null;
    };

    const revenueTickets = tickets.filter((ticket) => parsePrice(ticket.price_paid) > 0);

    const totalRevenue = revenueTickets.reduce((sum, ticket) => sum + parsePrice(ticket.price_paid), 0);
    const totalRevenueTickets = revenueTickets.length;

    const todayRevenueTickets = revenueTickets.filter((ticket) => {
      const ticketDate = resolveDate(ticket);
      if (!ticketDate) return false;
      const createdAt = new Date(ticketDate);
      return createdAt >= todayStart;
    });

    const weekRevenueTickets = revenueTickets.filter((ticket) => {
      const ticketDate = resolveDate(ticket);
      if (!ticketDate) return false;
      const createdAt = new Date(ticketDate);
      return createdAt >= weekStart;
    });

    const monthRevenueTickets = revenueTickets.filter((ticket) => {
      const ticketDate = resolveDate(ticket);
      if (!ticketDate) return false;
      const createdAt = new Date(ticketDate);
      return createdAt >= monthStart;
    });

    setStats({
      totalScans: logs.length,
      todayScans: todayScans.length,
      validScans: validScans.length,
      invalidScans: invalidScans.length,
      recentScans: logs.slice(0, 50),
      todayRevenue: todayRevenueTickets.reduce((sum, ticket) => sum + parsePrice(ticket.price_paid), 0),
      todayTickets: todayRevenueTickets.length,
      currentlyInside,
      weekRevenue: weekRevenueTickets.reduce((sum, ticket) => sum + parsePrice(ticket.price_paid), 0),
      weekTickets: weekRevenueTickets.length,
      monthRevenue: monthRevenueTickets.reduce((sum, ticket) => sum + parsePrice(ticket.price_paid), 0),
      monthTickets: monthRevenueTickets.length,
      totalRevenue,
      totalRevenueTickets,
      idVerificationStats: idVerificationStats || {
        total: 0,
        verified: 0,
        notVerified: 0,
        skipped: 0,
        complianceRate: 0,
      },
    });
  };

  const handleExportCSV = () => {
    exportScanLogsCSV(stats.recentScans.map(log => ({
      scanned_at: log.scanned_at,
      ticket_id: log.ticket_id,
      scan_result: log.scan_result,
      tier: log.metadata?.tier,
      override_used: (log as any).override_used,
      override_reason: (log as any).override_reason,
      scanned_by: log.scanned_by,
      metadata: log.metadata,
    })));
    toast({
      title: "CSV Export Successful",
      description: "Scan logs exported to CSV file",
    });
  };

  // Load available events for filter
  useEffect(() => {
    const loadEvents = async () => {
      if (!isSupabaseConfigured()) return;
      try {
        // Use type assertion for events table (not in TypeScript types yet)
        const { data, error } = await (supabase as any)
          .from("events")
          .select("name")
          .order("name");
        if (!error && data) {
          setAvailableEvents(data);
        }
      } catch (error) {
        console.error("Error loading events:", error);
      }
    };
    if (exportDialogOpen) {
      loadEvents();
    }
  }, [exportDialogOpen]);

  const handleAdvancedExport = async () => {
    if (!isSupabaseConfigured()) {
      toast({
        variant: "destructive",
        title: "Export Unavailable",
        description: "Advanced exports require Supabase connection",
      });
      return;
    }

    setExporting(true);
    try {
      const filters: ReportFilters = {
        startDate,
        endDate,
        eventName: exportEventName || undefined,
        ticketTier: exportTicketTier || undefined,
      };

      if (reportType === 'scan-logs') {
        const logs = await fetchScanLogs(filters);
        
        if (exportFormat === 'csv') {
          exportScanLogsCSV(logs);
        } else if (exportFormat === 'pdf') {
          exportScanLogsPDF(logs, filters);
        } else if (exportFormat === 'excel') {
          exportScanLogsExcel(logs, filters);
        }
        
        toast({
          title: "Export Successful",
          description: `Exported ${logs.length} scan log entries`,
        });
      } else if (reportType === 'revenue') {
        const revenueData = await fetchRevenueReport(filters);
        exportRevenueReportExcel(revenueData);
        
        toast({
          title: "Export Successful",
          description: `Exported revenue report with ${revenueData.length} entries`,
        });
      } else if (reportType === 'staff-performance') {
        const staffData = await fetchStaffPerformance(filters);
        exportStaffPerformanceExcel(staffData);

        toast({
          title: "Export Successful",
          description: `Exported staff performance report for ${staffData.length} staff members`,
        });
      } else if (reportType === 'discrepancies') {
        const discrepancyData = await fetchDiscrepancies(100);
        exportDiscrepanciesCSV(discrepancyData);

        toast({
          title: "Export Successful",
          description: `Exported ${discrepancyData.length} revenue discrepancy records`,
        });
      }

      setExportDialogOpen(false);
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error.message || "Failed to export report",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportOverrideLogs = async () => {
    if (!isSupabaseConfigured()) {
      toast({
        variant: "destructive",
        title: "Export Unavailable",
        description: "Override logs export requires Supabase connection",
      });
      return;
    }

    try {
      // Fetch all override logs (or recent ones)
      const allLogs = await getRecentOverrideLogs(1000); // Get up to 1000 recent logs

      const headers = ["Time", "Ticket ID", "Override Type", "Reason", "Notes", "User ID", "Scan Log ID"];
      const rows = allLogs.map(log => [
        new Date(log.created_at).toISOString(),
        log.ticket_id || "-",
        log.override_type,
        log.reason,
        log.notes || "-",
        log.user_id || "System",
        log.scan_log_id || "-",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `override-logs-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Exported ${allLogs.length} override log entries`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error.message || "Failed to export override logs",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (role !== 'owner') {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">
              Analytics Dashboard
            </h1>
            <LiveIndicator isLive={isLive} lastUpdate={lastUpdate} showLastUpdate />
          </div>
          <p className="text-muted-foreground mt-2">
            View scan statistics and recent activity
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Total Scans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalScans}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card className="border-success/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Today's Scans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.todayScans}</div>
              <p className="text-xs text-muted-foreground mt-1">Since midnight</p>
            </CardContent>
          </Card>

          <Card className="border-success/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Valid Scans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.validScans}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalScans > 0 
                  ? `${Math.round((stats.validScans / stats.totalScans) * 100)}% success rate`
                  : "No scans yet"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Currently Inside
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.currentlyInside}</div>
              <p className="text-xs text-muted-foreground mt-1">In venue right now</p>
            </CardContent>
          </Card>

          {/* ID Verification Compliance */}
          {stats.idVerificationStats.total > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IdCard className="h-4 w-4 text-amber-500" />
                  ID Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-amber-500">
                    {stats.idVerificationStats.complianceRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compliance Rate
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Verified</p>
                      <p className="text-lg font-semibold text-green-600">{stats.idVerificationStats.verified}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Not Verified</p>
                      <p className="text-lg font-semibold text-amber-600">{stats.idVerificationStats.notVerified}</p>
                    </div>
                    {stats.idVerificationStats.skipped > 0 && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Skipped</p>
                        <p className="text-sm font-semibold text-muted-foreground">{stats.idVerificationStats.skipped}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-destructive/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Invalid Scans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{stats.invalidScans}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalScans > 0 
                  ? `${Math.round((stats.invalidScans / stats.totalScans) * 100)}% failure rate`
                  : "No scans yet"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Overview */}
        <Card className="mb-8 border-primary/20 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100 overflow-hidden shadow-lg">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <CardHeader className="relative z-10 pb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2 text-white">
                  <DollarSign className="h-5 w-5 text-primary-foreground bg-primary/80 rounded-full p-1" />
                  Revenue Overview
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Gross ticket sales captured through the scanner
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">All Time Revenue</p>
                <p className="text-4xl font-extrabold text-primary-foreground">
                  {currencyFormatter.format(stats.totalRevenue)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {stats.totalRevenueTickets === 1
                    ? "1 ticket sold all time"
                    : `${stats.totalRevenueTickets} tickets sold all time`}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid gap-6 md:grid-cols-3">
              {revenueBreakdown.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className={`rounded-2xl border backdrop-blur-sm p-4 shadow-inner bg-gradient-to-br ${metric.border} ${metric.bg}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wide text-slate-300">{metric.label}</p>
                        <p className="text-2xl font-semibold text-white">
                          {currencyFormatter.format(metric.amount)}
                        </p>
                      </div>
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${metric.iconBg}`}>
                        <Icon className={`h-5 w-5 ${metric.iconColor}`} />
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 mt-3">{metric.description}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {metric.tickets === 1
                        ? "1 ticket sold"
                        : `${metric.tickets} tickets sold`}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Revenue Verification - verifies DB total against Stripe */}
            <div className="mt-6">
              <RevenueVerification
                startDate={(() => {
                  const monthStart = new Date();
                  monthStart.setDate(1);
                  monthStart.setHours(0, 0, 0, 0);
                  return monthStart;
                })()}
                endDate={new Date()}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tier Breakdown */}
        <Card className="mb-8 border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5" />
              Tier Breakdown
            </CardTitle>
            <CardDescription className="mt-1">
              Revenue, ticket count, and scan rate by tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(tierStats).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No tier data available yet
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(tierStats)
                  .sort(([, a], [, b]) => b.revenue - a.revenue)
                  .map(([tier, stats]) => {
                    const tierColor = getTierColor(tier);
                    const tierDisplayName = getTierDisplayName(tier);
                    const totalRevenue = Object.values(tierStats).reduce((sum, s) => sum + s.revenue, 0);
                    const percentage = totalRevenue > 0 
                      ? (stats.revenue / totalRevenue) * 100 
                      : 0;
                    
                    return (
                      <div
                        key={tier}
                        className="p-4 rounded-lg border-2"
                        style={{ borderColor: `${tierColor}40`, backgroundColor: `${tierColor}05` }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: tierColor }}
                            />
                            <h3 className="font-semibold text-lg">{tierDisplayName}</h3>
                          </div>
                          <Badge
                            style={{
                              backgroundColor: tierColor,
                              color: 'white',
                            }}
                          >
                            {tierDisplayName}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                            <p className="text-lg font-bold" style={{ color: tierColor }}>
                              {currencyFormatter.format(stats.revenue)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {percentage.toFixed(1)}% of total
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Tickets</p>
                            <p className="text-lg font-bold">{stats.count}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Scanned</p>
                            <p className="text-lg font-bold text-success">{stats.scanCount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Scan Rate</p>
                            <p className="text-lg font-bold">{stats.scanRate.toFixed(1)}%</p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: tierColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan Speed Analytics */}
        {scanSpeedMetrics && (
          <Card className="mb-8 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Scan Speed Analytics
              </CardTitle>
              <CardDescription>
                Real-time scan performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Current Rate</p>
                  <p className={`text-2xl font-bold ${
                    scanSpeedMetrics.currentRate >= 15 
                      ? "text-green-600" 
                      : scanSpeedMetrics.currentRate >= 10 
                      ? "text-yellow-600" 
                      : "text-red-600"
                  }`}>
                    {scanSpeedMetrics.currentRate.toFixed(1)} scans/min
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Today's Average</p>
                  <p className="text-2xl font-bold">
                    {scanSpeedMetrics.todayAverage.toFixed(1)} scans/min
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Peak Rate</p>
                  <p className="text-2xl font-bold text-primary">
                    {scanSpeedMetrics.peakRate.toFixed(1)} scans/min
                  </p>
                  {scanSpeedMetrics.peakRateTime && (
                    <p className="text-xs text-muted-foreground">
                      at {new Date(scanSpeedMetrics.peakRateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <p className="text-2xl font-bold">
                    {(scanSpeedMetrics.avgDurationMs / 1000).toFixed(2)}s
                  </p>
                  <p className="text-xs text-muted-foreground">
                    per scan
                  </p>
                </div>
              </div>

              {/* Scan Rate Chart */}
              {scanRateChartData.length > 0 && (
                <div className="h-64 mt-6">
                  <h3 className="text-sm font-medium mb-4">Scan Rate Over Time (Today)</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scanRateChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="period_start" 
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        label={{ value: 'Scans/min', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(1)} scans/min`, 'Rate']}
                        labelFormatter={(label) => `Time: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="scans_per_minute" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Scanner Performance Leaderboard */}
        {scannerPerformance.length > 0 && (
          <Card className="mb-8 border-primary/20">
            <CardHeader>
              <CardTitle>Scanner Performance Leaderboard</CardTitle>
              <CardDescription>
                Top scanners ranked by speed and accuracy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Scanner</TableHead>
                      <TableHead>Scans</TableHead>
                      <TableHead>Speed</TableHead>
                      <TableHead>Avg Duration</TableHead>
                      <TableHead>Error Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scannerPerformance
                      .sort((a, b) => b.scans_per_minute - a.scans_per_minute)
                      .map((perf, index) => (
                        <TableRow key={perf.user_id || index}>
                          <TableCell>
                            <Badge variant={index === 0 ? "default" : "outline"}>
                              #{index + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {perf.user_email || "Unknown"}
                          </TableCell>
                          <TableCell>{perf.total_scans}</TableCell>
                          <TableCell>
                            <span className={perf.scans_per_minute >= 15 ? "text-green-600 font-semibold" : perf.scans_per_minute >= 10 ? "text-yellow-600" : "text-red-600"}>
                              {perf.scans_per_minute.toFixed(1)}/min
                            </span>
                          </TableCell>
                          <TableCell>
                            {perf.avg_duration_ms 
                              ? `${(perf.avg_duration_ms / 1000).toFixed(2)}s`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <span className={perf.error_rate < 5 ? "text-green-600" : perf.error_rate < 10 ? "text-yellow-600" : "text-red-600"}>
                              {perf.error_rate.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unified Capacity Display */}
        {activeEvent && (
          <div className="mb-8">
            <UnifiedCapacityDisplay eventId={activeEvent.id} eventName={activeEvent.name} />
          </div>
        )}

        {/* Discrepancy Alerts */}
        {activeEvent && (
          <div className="mb-8">
            <DiscrepancyAlerts eventId={activeEvent.id} />
          </div>
        )}

        {/* Entry/Exit Flow Visualization */}
        {activeEvent && (
          <div className="mb-8">
            <EntryExitFlowVisualization eventId={activeEvent.id} />
          </div>
        )}

        {/* Check-In Progress - Simple "X / Y checked in" with progress bar per CONTEXT.md */}
        <div className="mb-8">
          {activeEvent ? (
            <CheckInProgress
              eventId={activeEvent.id}
              eventName={activeEvent.name}
              showDetails={true}
            />
          ) : (
            <CheckInProgress showDetails={true} />
          )}
        </div>

        {/* Event Analytics Charts */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Tickets Sold Per Event */}
          {ticketsSoldPerEvent.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Tickets Sold Per Event</CardTitle>
                <CardDescription>Total tickets sold and scanned by event</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ticketsSoldPerEvent}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="eventName" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="ticketsSold" fill="hsl(var(--primary))" name="Tickets Sold" />
                      <Bar dataKey="ticketsScanned" fill="hsl(var(--success))" name="Tickets Scanned" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Check-In Rates */}
          {checkInRates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Check-In Rates</CardTitle>
                <CardDescription>Percentage of tickets scanned per event</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={checkInRates} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <YAxis 
                        dataKey="eventName" 
                        type="category"
                        width={100}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Bar dataKey="checkInRate" fill="hsl(var(--accent))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Daily/Weekly Sales */}
        {dailyWeeklySales.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Over Time</CardTitle>
                  <CardDescription>Tickets sold and revenue by {salesPeriod === 'daily' ? 'day' : 'week'}</CardDescription>
                </div>
                <Select value={salesPeriod} onValueChange={(value: 'daily' | 'weekly') => setSalesPeriod(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyWeeklySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'revenue') return currencyFormatter.format(value);
                        return value;
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="ticketsSold" fill="hsl(var(--primary))" name="Tickets Sold" />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      name="Revenue"
                      dot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fraud Alerts Widget */}
        <div className="mb-8">
          <FraudAlertsWidget />
          <NotificationFeed />
        </div>

        {/* Override Statistics */}
        {overrideStats && overrideStats.total_overrides > 0 && (
          <Card className="mb-8 border-red-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Emergency Override Statistics
              </CardTitle>
              <CardDescription>
                Override usage and audit trail (Last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Overrides</p>
                  <p className="text-2xl font-bold text-red-500">
                    {overrideStats.total_overrides}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Unique Users</p>
                  <p className="text-2xl font-bold">
                    {overrideStats.unique_users}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Most Common</p>
                  <p className="text-lg font-semibold capitalize">
                    {overrideStats.capacity_overrides > overrideStats.refund_overrides && overrideStats.capacity_overrides > overrideStats.duplicate_overrides
                      ? 'Capacity'
                      : overrideStats.refund_overrides > overrideStats.duplicate_overrides
                      ? 'Refund'
                      : 'Duplicate'}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-5 mb-6">
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <p className="text-xs text-muted-foreground mb-1">Capacity</p>
                  <p className="text-lg font-bold text-red-500">{overrideStats.capacity_overrides}</p>
                </div>
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <p className="text-xs text-muted-foreground mb-1">Refund</p>
                  <p className="text-lg font-bold text-red-500">{overrideStats.refund_overrides}</p>
                </div>
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <p className="text-xs text-muted-foreground mb-1">Transfer</p>
                  <p className="text-lg font-bold text-red-500">{overrideStats.transfer_overrides}</p>
                </div>
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <p className="text-xs text-muted-foreground mb-1">ID Verify</p>
                  <p className="text-lg font-bold text-red-500">{overrideStats.id_verification_overrides}</p>
                </div>
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <p className="text-xs text-muted-foreground mb-1">Duplicate</p>
                  <p className="text-lg font-bold text-red-500">{overrideStats.duplicate_overrides}</p>
                </div>
              </div>

              {/* Recent Override Logs */}
              {recentOverrideLogs.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Recent Override Actions</h3>
                    <Button
                      variant="outline"
                      onClick={handleExportOverrideLogs}
                      size="sm"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export Logs
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>User</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentOverrideLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {new Date(log.created_at).toLocaleString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="text-xs capitalize">
                                {log.override_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {log.reason}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                              {log.notes || "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {log.user_id ? log.user_id.substring(0, 8) + '...' : 'System'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Scans */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Scans</CardTitle>
                <CardDescription>Last 50 scan attempts</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  size="sm"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Quick CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setExportDialogOpen(true)}
                  size="sm"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Advanced Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Override</TableHead>
                    <TableHead>Scanned By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentScans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No scan logs yet. Start scanning tickets to see activity here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.recentScans.map((log) => {
                      const tier = log.metadata?.tier || "-";
                      const tierColor = tier !== "-" ? getTierColor(tier) : undefined;
                      const tierDisplayName = tier !== "-" ? getTierDisplayName(tier) : "-";
                      const overrideUsed = (log as any).override_used || false;
                      const overrideReason = (log as any).override_reason || null;
                      
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {new Date(log.scanned_at).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {log.metadata?.ticket_id || log.ticket_id || "-"}
                          </TableCell>
                          <TableCell>
                            {log.scan_result === "valid" || log.scan_result === "scanned" ? (
                              <Badge className="bg-success">Valid</Badge>
                            ) : log.scan_result === "used" ? (
                              <Badge className="bg-accent">Used</Badge>
                            ) : (
                              <Badge variant="destructive">Invalid</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {tierColor ? (
                              <Badge
                                className="text-xs"
                                style={{
                                  backgroundColor: tierColor,
                                  color: 'white',
                                }}
                              >
                                {tierDisplayName}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">{tierDisplayName}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {overrideUsed ? (
                              <div className="flex flex-col gap-1">
                                <Badge variant="destructive" className="text-xs w-fit">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Override
                                </Badge>
                                {overrideReason && (
                                  <span className="text-xs text-muted-foreground max-w-[150px] truncate" title={overrideReason}>
                                    {overrideReason}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {log.scanned_by ? getStaffDisplayName(log.scanned_by) : "System"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Export Report</DialogTitle>
              <DialogDescription>
                Export data with custom filters and formats
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Report Type */}
              <div className="space-y-2">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scan-logs">Scan Logs</SelectItem>
                    <SelectItem value="revenue">Revenue Report</SelectItem>
                    <SelectItem value="staff-performance">Staff Performance</SelectItem>
                    <SelectItem value="discrepancies">Revenue Discrepancies</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Export Format */}
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    {reportType === 'scan-logs' && (
                      <>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                      </>
                    )}
                    {(reportType === 'revenue' || reportType === 'staff-performance') && (
                      <SelectItem value="excel">Excel</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarRange className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarRange className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Event Filter */}
              {reportType === 'scan-logs' && (
                <div className="space-y-2">
                  <Label>Event (Optional)</Label>
                  <Select value={exportEventName} onValueChange={setExportEventName}>
                    <SelectTrigger>
                      <SelectValue placeholder="All events" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All events</SelectItem>
                      {availableEvents.map((event) => (
                        <SelectItem key={event.name} value={event.name}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tier Filter */}
              {reportType === 'scan-logs' && (
                <div className="space-y-2">
                  <Label>Ticket Tier (Optional)</Label>
                  <Select value={exportTicketTier} onValueChange={setExportTicketTier}>
                    <SelectTrigger>
                      <SelectValue placeholder="All tiers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All tiers</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="backstage">Backstage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setExportDialogOpen(false)}
                disabled={exporting}
              >
                Cancel
              </Button>
              <Button onClick={handleAdvancedExport} disabled={exporting}>
                {exporting ? "Exporting..." : "Export"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;
