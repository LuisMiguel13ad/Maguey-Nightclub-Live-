import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BarChart3, Bell, CheckCircle2, XCircle, TrendingUp, Clock } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const NotificationAnalytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [stats, setStats] = useState({
    totalSent: 0,
    totalAcknowledged: 0,
    totalFailed: 0,
    acknowledgmentRate: 0,
    bySeverity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
    byChannel: {
      email: 0,
      sms: 0,
      push: 0,
      browser: 0,
      webhook: 0,
      slack: 0,
      discord: 0,
    },
    byTrigger: {} as Record<string, number>,
  });
  const [chartData, setChartData] = useState<Array<{
    date: string;
    sent: number;
    acknowledged: number;
    failed: number;
  }>>([]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    loadAnalytics();
  }, [user, navigate, timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      // Get all notifications in time range
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const totalSent = notifications?.length || 0;
      const totalAcknowledged = notifications?.filter(n => n.status === 'acknowledged').length || 0;
      const totalFailed = notifications?.filter(n => n.status === 'failed').length || 0;

      const bySeverity = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };

      const byChannel = {
        email: 0,
        sms: 0,
        push: 0,
        browser: 0,
        webhook: 0,
        slack: 0,
        discord: 0,
      };

      const byTrigger: Record<string, number> = {};

      notifications?.forEach((notif) => {
        // Count by severity
        if (notif.severity in bySeverity) {
          bySeverity[notif.severity as keyof typeof bySeverity]++;
        }

        // Count by channel
        notif.channels_used?.forEach((channel: string) => {
          if (channel in byChannel) {
            byChannel[channel as keyof typeof byChannel]++;
          }
        });

        // Count by trigger (from rule)
        if (notif.rule_id) {
          // We'd need to join with notification_rules to get trigger_type
          // For now, use a placeholder
          byTrigger[notif.rule_id] = (byTrigger[notif.rule_id] || 0) + 1;
        }
      });

      setStats({
        totalSent,
        totalAcknowledged,
        totalFailed,
        acknowledgmentRate: totalSent > 0 ? (totalAcknowledged / totalSent) * 100 : 0,
        bySeverity,
        byChannel,
        byTrigger,
      });

      // Generate chart data by day
      const chartDataMap = new Map<string, { sent: number; acknowledged: number; failed: number }>();

      notifications?.forEach((notif) => {
        const date = format(new Date(notif.created_at), 'yyyy-MM-dd');
        if (!chartDataMap.has(date)) {
          chartDataMap.set(date, { sent: 0, acknowledged: 0, failed: 0 });
        }

        const dayData = chartDataMap.get(date)!;
        dayData.sent++;
        if (notif.status === 'acknowledged') dayData.acknowledged++;
        if (notif.status === 'failed') dayData.failed++;
      });

      const chartDataArray = Array.from(chartDataMap.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM dd'),
          ...data,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setChartData(chartDataArray);
    } catch (error: any) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const severityColors = ['#3b82f6', '#eab308', '#f97316', '#ef4444'];
  const channelColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading analytics...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Notification Analytics
            </h1>
            <p className="text-muted-foreground mt-2">
              Track notification effectiveness and engagement
            </p>
          </div>
          <Select value={timeRange} onValueChange={(value: '7d' | '30d' | '90d') => setTimeRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Sent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {stats.totalSent}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Acknowledged</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                {stats.totalAcknowledged}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                {stats.totalFailed}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Acknowledgment Rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {stats.acknowledgmentRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Notifications Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sent" fill="#3b82f6" name="Sent" />
                  <Bar dataKey="acknowledged" fill="#10b981" name="Acknowledged" />
                  <Bar dataKey="failed" fill="#ef4444" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By Severity</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Low', value: stats.bySeverity.low },
                      { name: 'Medium', value: stats.bySeverity.medium },
                      { name: 'High', value: stats.bySeverity.high },
                      { name: 'Critical', value: stats.bySeverity.critical },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {severityColors.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>By Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={Object.entries(stats.byChannel).map(([name, value]) => ({ name, value }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotificationAnalytics;

