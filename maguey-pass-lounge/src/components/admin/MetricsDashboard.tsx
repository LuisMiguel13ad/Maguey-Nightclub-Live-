/**
 * Metrics Dashboard Component
 * 
 * Displays real-time metrics and system health for the ticketing platform.
 * Shows order statistics, error rates, and active alerts.
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
  DollarSign,
  Ticket,
  ShoppingCart,
  Activity,
  Zap
} from 'lucide-react';
import { 
  metrics, 
  getDashboardMetrics, 
  calculateErrorRate, 
  calculateScanSuccessRate 
} from '@/lib/monitoring';
import { alertManager, AlertSeverity, type Alert } from '@/lib/alerts';
import { healthCheck, type HealthCheckResult, type HealthStatus } from '@/api/health';

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
  ordersCreated: number;
  ordersFailed: number;
  ticketsSold: number;
  revenueInCents: number;
  avgOrderDuration: number;
  errorRate: number;
  scanSuccessRate: number;
  ticketScansTotal: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getStatusColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return 'text-green-500';
    case 'degraded': return 'text-yellow-500';
    case 'unhealthy': return 'text-red-500';
    default: return 'text-gray-500';
  }
}

function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case AlertSeverity.Info: return 'bg-blue-100 text-blue-800';
    case AlertSeverity.Warning: return 'bg-yellow-100 text-yellow-800';
    case AlertSeverity.Critical: return 'bg-red-100 text-red-800';
    case AlertSeverity.Emergency: return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
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
    neutral: 'border-l-gray-300',
  };

  return (
    <Card className={`border-l-4 ${statusColors[status]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              {icon}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 ${
              trend === 'up' ? 'text-green-500' : 
              trend === 'down' ? 'text-red-500' : 
              'text-gray-500'
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
// HEALTH STATUS COMPONENT
// ============================================

function HealthStatusCard({ health }: { health: HealthCheckResult | null }) {
  if (!health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading health status...</p>
        </CardContent>
      </Card>
    );
  }

  const StatusIcon = health.status === 'healthy' ? CheckCircle2 : 
                     health.status === 'degraded' ? AlertTriangle : XCircle;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          System Health
        </CardTitle>
        <CardDescription>
          Version {health.version} • Uptime: {Math.floor(health.uptime / 60)}m {health.uptime % 60}s
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-6 h-6 ${getStatusColor(health.status)}`} />
          <span className={`text-lg font-semibold capitalize ${getStatusColor(health.status)}`}>
            {health.status}
          </span>
        </div>
        
        <Separator />
        
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Components</p>
          {health.components.map((component) => (
            <div key={component.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {component.status === 'healthy' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : component.status === 'degraded' ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm capitalize">{component.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {component.latencyMs !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {component.latencyMs}ms
                  </span>
                )}
                <Badge 
                  variant={
                    component.status === 'healthy' ? 'default' : 
                    component.status === 'degraded' ? 'secondary' : 'destructive'
                  }
                  className="text-xs"
                >
                  {component.status}
                </Badge>
              </div>
            </div>
          ))}
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Active Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            <span>No active alerts</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Active Alerts ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div 
            key={alert.id} 
            className="p-3 border rounded-lg space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={getSeverityColor(alert.severity)}>
                  {alert.severity}
                </Badge>
                <span className="font-medium">{alert.ruleName}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{alert.message}</p>
            {!alert.acknowledged && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => alertManager.acknowledgeAlert(alert.id)}
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
// PERFORMANCE CHART COMPONENT
// ============================================

function PerformanceCard({ dashboardMetrics }: { dashboardMetrics: DashboardMetrics }) {
  const errorRate = dashboardMetrics.errorRate;
  const successRate = 100 - errorRate;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Order Success Rate</span>
            <span className={successRate >= 95 ? 'text-green-500' : successRate >= 90 ? 'text-yellow-500' : 'text-red-500'}>
              {successRate.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={successRate} 
            className="h-2"
          />
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Scan Success Rate</span>
            <span className={dashboardMetrics.scanSuccessRate >= 95 ? 'text-green-500' : dashboardMetrics.scanSuccessRate >= 80 ? 'text-yellow-500' : 'text-red-500'}>
              {dashboardMetrics.scanSuccessRate.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={dashboardMetrics.scanSuccessRate} 
            className="h-2"
          />
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Avg Order Time</p>
            <p className="font-semibold">{formatDuration(dashboardMetrics.avgOrderDuration)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Scans</p>
            <p className="font-semibold">{formatNumber(dashboardMetrics.ticketScansTotal)}</p>
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
    ordersCreated: 0,
    ordersFailed: 0,
    ticketsSold: 0,
    revenueInCents: 0,
    avgOrderDuration: 0,
    errorRate: 0,
    scanSuccessRate: 100,
    ticketScansTotal: 0,
  });
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Get dashboard metrics
      const metricsData = getDashboardMetrics();
      setDashboardMetrics(metricsData);
      
      // Get health status
      const healthData = await healthCheck({ includeMetrics: true, includeAlerts: true });
      setHealth(healthData);
      
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

  const getOrderStatus = (): 'success' | 'warning' | 'error' => {
    if (dashboardMetrics.errorRate > 10) return 'error';
    if (dashboardMetrics.errorRate > 5) return 'warning';
    return 'success';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={refreshData}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Orders Created"
          value={formatNumber(dashboardMetrics.ordersCreated)}
          subtitle={`${dashboardMetrics.ordersFailed} failed`}
          icon={<ShoppingCart className="w-5 h-5 text-blue-500" />}
          status={getOrderStatus()}
        />
        <MetricCard
          title="Tickets Sold"
          value={formatNumber(dashboardMetrics.ticketsSold)}
          icon={<Ticket className="w-5 h-5 text-purple-500" />}
          status="success"
        />
        <MetricCard
          title="Revenue"
          value={formatCurrency(dashboardMetrics.revenueInCents)}
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
          status="success"
        />
        <MetricCard
          title="Avg Order Time"
          value={formatDuration(dashboardMetrics.avgOrderDuration)}
          icon={<Clock className="w-5 h-5 text-orange-500" />}
          status={dashboardMetrics.avgOrderDuration > 5000 ? 'warning' : 'success'}
        />
      </div>

      {/* Secondary Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Health Status */}
        <HealthStatusCard health={health} />
        
        {/* Performance */}
        <PerformanceCard dashboardMetrics={dashboardMetrics} />
        
        {/* Alerts */}
        <AlertsPanel alerts={alerts} />
      </div>

      {/* Error Rate Warning */}
      {dashboardMetrics.errorRate > 5 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
              <div>
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                  High Error Rate Detected
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Current error rate is {dashboardMetrics.errorRate.toFixed(1)}%. 
                  Investigate order failures immediately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default MetricsDashboard;
