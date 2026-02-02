/**
 * Metrics Dashboard Component
 *
 * Displays real-time metrics and system health for the scanner platform.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Ticket,
  Activity,
  Zap,
  Scan,
} from 'lucide-react';
import {
  metrics,
  getDashboardMetrics,
  calculateScanSuccessRate,
} from '@/lib/monitoring';
import { alertManager, AlertSeverity, type Alert } from '@/lib/alerts';

// ============================================
// TYPES
// ============================================

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  status?: 'success' | 'warning' | 'error' | 'neutral';
}

interface DashboardMetrics {
  ticketScansTotal: number;
  scanSuccessRate: number;
  avgScanDuration: number;
  activeEvents: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case AlertSeverity.Info: return 'bg-blue-500/20 text-blue-400';
    case AlertSeverity.Warning: return 'bg-yellow-500/20 text-yellow-400';
    case AlertSeverity.Critical: return 'bg-red-500/20 text-red-400';
    case AlertSeverity.Emergency: return 'bg-purple-500/20 text-purple-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
}

// ============================================
// METRIC CARD COMPONENT
// ============================================

function MetricCard({ title, value, subtitle, icon, trend, trendValue, status = 'neutral' }: MetricCardProps) {
  const statusColors = {
    success: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    error: 'border-l-red-500',
    neutral: 'border-l-slate-500',
  };

  return (
    <Card className={`border-l-4 ${statusColors[status]} bg-white/5 border-white/10`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg">
              {icon}
            </div>
            <div>
              <p className="text-sm text-slate-400">{title}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
              {subtitle && (
                <p className="text-xs text-slate-500">{subtitle}</p>
              )}
            </div>
          </div>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 ${
              trend === 'up' ? 'text-green-400' :
              trend === 'down' ? 'text-red-400' :
              'text-slate-400'
            }`}>
              {trend === 'up' ? <TrendingUp className="w-4 h-4" /> :
               trend === 'down' ? <TrendingDown className="w-4 h-4" /> : null}
              <span className="text-sm font-medium">{trendValue}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// ALERTS PANEL COMPONENT
// ============================================

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="w-5 h-5" />
            Active Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            <span>No active alerts</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-400">
          <AlertTriangle className="w-5 h-5" />
          Active Alerts ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="p-3 border border-white/10 rounded-lg space-y-2 bg-white/5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={getSeverityColor(alert.severity)}>
                  {alert.severity}
                </Badge>
                <span className="font-medium text-white">{alert.ruleName}</span>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-slate-400">{alert.message}</p>
            {!alert.acknowledged && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => alertManager.acknowledgeAlert(alert.id)}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                Acknowledge
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================
// PERFORMANCE CARD COMPONENT
// ============================================

function PerformanceCard({ dashboardMetrics }: { dashboardMetrics: DashboardMetrics }) {
  const scanSuccessRate = dashboardMetrics.scanSuccessRate;

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Zap className="w-5 h-5" />
          Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Scan Success Rate</span>
            <span className={scanSuccessRate >= 95 ? 'text-green-400' : scanSuccessRate >= 80 ? 'text-yellow-400' : 'text-red-400'}>
              {scanSuccessRate.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={scanSuccessRate}
            className="h-2"
          />
        </div>

        <Separator className="bg-white/10" />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Avg Scan Time</p>
            <p className="font-semibold text-white">{formatDuration(dashboardMetrics.avgScanDuration)}</p>
          </div>
          <div>
            <p className="text-slate-400">Total Scans</p>
            <p className="font-semibold text-white">{formatNumber(dashboardMetrics.ticketScansTotal)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export function MetricsDashboard() {
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({
    ticketScansTotal: 0,
    scanSuccessRate: 100,
    avgScanDuration: 0,
    activeEvents: 0,
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Get dashboard metrics
      const metricsData = getDashboardMetrics();
      setDashboardMetrics({
        ticketScansTotal: metricsData.ticketScansTotal || 0,
        scanSuccessRate: metricsData.scanSuccessRate || 100,
        avgScanDuration: metricsData.avgOrderDuration || 0,
        activeEvents: 0,
      });

      // Get active alerts
      const activeAlerts = alertManager.getActiveAlerts();
      setAlerts(activeAlerts);

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial load and auto-refresh
  useEffect(() => {
    refreshData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">System Metrics</h1>
          <p className="text-slate-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refreshData}
          disabled={isRefreshing}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Scans"
          value={formatNumber(dashboardMetrics.ticketScansTotal)}
          icon={<Scan className="w-5 h-5 text-blue-400" />}
          status="success"
        />
        <MetricCard
          title="Success Rate"
          value={`${dashboardMetrics.scanSuccessRate.toFixed(1)}%`}
          icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
          status={dashboardMetrics.scanSuccessRate >= 95 ? 'success' : 'warning'}
        />
        <MetricCard
          title="Avg Scan Time"
          value={formatDuration(dashboardMetrics.avgScanDuration)}
          icon={<Clock className="w-5 h-5 text-orange-400" />}
          status={dashboardMetrics.avgScanDuration > 2000 ? 'warning' : 'success'}
        />
        <MetricCard
          title="Active Events"
          value={dashboardMetrics.activeEvents}
          icon={<Activity className="w-5 h-5 text-purple-400" />}
          status="neutral"
        />
      </div>

      {/* Secondary Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance */}
        <PerformanceCard dashboardMetrics={dashboardMetrics} />

        {/* Alerts */}
        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );
}

export default MetricsDashboard;
