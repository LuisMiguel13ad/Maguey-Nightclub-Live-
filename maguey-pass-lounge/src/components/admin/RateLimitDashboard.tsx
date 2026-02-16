/**
 * Rate Limit Dashboard
 * 
 * Displays rate limiting statistics, violations, and blocked IPs
 * for monitoring and managing rate limit policies.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  Shield,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Ban,
  CheckCircle2,
  XCircle,
  BarChart3,
  Users,
  Globe,
} from 'lucide-react';
import {
  orderLimiter,
  apiLimiter,
  authLimiter,
  webhookLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  scanLimiter,
  type RateLimitViolation,
} from '@/lib/rate-limiter';

// ============================================
// TYPES
// ============================================

interface LimiterStats {
  name: string;
  config: {
    windowMs: number;
    maxRequests: number;
    keyPrefix?: string;
  };
  stats: {
    totalKeys: number;
    totalViolations: number;
    violationsLastHour: number;
  };
}

interface DashboardData {
  limiters: LimiterStats[];
  recentViolations: RateLimitViolation[];
  topOffendingKeys: Array<{ key: string; count: number; lastSeen: number }>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${Math.floor(ms / 3600000)}h`;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getKeyType(key: string): 'user' | 'ip' | 'other' {
  if (key.startsWith('user:')) return 'user';
  if (key.startsWith('ip:')) return 'ip';
  return 'other';
}

function extractKeyValue(key: string): string {
  const parts = key.split(':');
  return parts.length > 1 ? parts.slice(1).join(':') : key;
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-1">
            {trend === 'up' ? (
              <TrendingUp className="h-3 w-3 text-red-500 mr-1" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ViolationsTable({ violations }: { violations: RateLimitViolation[] }) {
  if (violations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
        <p>No rate limit violations in the last hour</p>
        <p className="text-sm">All requests are within limits!</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Key</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Endpoint</TableHead>
          <TableHead className="text-right">Count</TableHead>
          <TableHead className="text-right">Max</TableHead>
          <TableHead>IP</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {violations.map((violation, index) => {
          const keyType = getKeyType(violation.key);
          const keyValue = extractKeyValue(violation.key);
          
          return (
            <TableRow key={index}>
              <TableCell className="font-mono text-xs">
                {keyValue.length > 30 ? `${keyValue.slice(0, 30)}...` : keyValue}
              </TableCell>
              <TableCell>
                <Badge variant={keyType === 'user' ? 'default' : 'secondary'}>
                  {keyType}
                </Badge>
              </TableCell>
              <TableCell>
                {violation.endpoint ? (
                  <span className="text-sm">{violation.endpoint}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="destructive">{violation.count}</Badge>
              </TableCell>
              <TableCell className="text-right">{violation.maxRequests}</TableCell>
              <TableCell>
                {violation.ip ? (
                  <span className="font-mono text-xs">{violation.ip}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>{formatTimeAgo(violation.timestamp)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function LimitersTable({ limiters }: { limiters: LimiterStats[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Limiter</TableHead>
          <TableHead>Window</TableHead>
          <TableHead className="text-right">Max Requests</TableHead>
          <TableHead className="text-right">Active Keys</TableHead>
          <TableHead className="text-right">Total Violations</TableHead>
          <TableHead className="text-right">Last Hour</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {limiters.map((limiter) => (
          <TableRow key={limiter.name}>
            <TableCell className="font-medium">{limiter.name}</TableCell>
            <TableCell>{formatDuration(limiter.config.windowMs)}</TableCell>
            <TableCell className="text-right">{limiter.config.maxRequests}</TableCell>
            <TableCell className="text-right">{limiter.stats.totalKeys}</TableCell>
            <TableCell className="text-right">{limiter.stats.totalViolations}</TableCell>
            <TableCell className="text-right">
              {limiter.stats.violationsLastHour > 0 ? (
                <Badge variant="destructive">{limiter.stats.violationsLastHour}</Badge>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RateLimitDashboard() {
  const [data, setData] = useState<DashboardData>({
    limiters: [],
    recentViolations: [],
    topOffendingKeys: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    
    try {
      // Get stats from all limiters
      const limiters: LimiterStats[] = [
        {
          name: 'Order Creation',
          config: orderLimiter['config'],
          stats: orderLimiter.getStats(),
        },
        {
          name: 'API Calls',
          config: apiLimiter['config'],
          stats: apiLimiter.getStats(),
        },
        {
          name: 'Authentication',
          config: authLimiter['config'],
          stats: authLimiter.getStats(),
        },
        {
          name: 'Webhooks',
          config: webhookLimiter['config'],
          stats: webhookLimiter.getStats(),
        },
        {
          name: 'Password Reset',
          config: passwordResetLimiter['config'],
          stats: passwordResetLimiter.getStats(),
        },
        {
          name: 'Email Verification',
          config: emailVerificationLimiter['config'],
          stats: emailVerificationLimiter.getStats(),
        },
        {
          name: 'Ticket Scanning',
          config: scanLimiter['config'],
          stats: scanLimiter.getStats(),
        },
      ];

      // Get recent violations from all limiters
      const allViolations: RateLimitViolation[] = [];
      limiters.forEach(limiter => {
        const violations = limiter.name === 'Order Creation' ? orderLimiter.getViolations(50) :
                          limiter.name === 'API Calls' ? apiLimiter.getViolations(50) :
                          limiter.name === 'Authentication' ? authLimiter.getViolations(50) :
                          limiter.name === 'Webhooks' ? webhookLimiter.getViolations(50) :
                          limiter.name === 'Password Reset' ? passwordResetLimiter.getViolations(50) :
                          limiter.name === 'Email Verification' ? emailVerificationLimiter.getViolations(50) :
                          scanLimiter.getViolations(50);
        allViolations.push(...violations);
      });

      // Sort by timestamp (most recent first)
      allViolations.sort((a, b) => b.timestamp - a.timestamp);

      // Get top offending keys
      const keyCounts = new Map<string, { count: number; lastSeen: number }>();
      allViolations.forEach(v => {
        const existing = keyCounts.get(v.key);
        if (existing) {
          existing.count++;
          existing.lastSeen = Math.max(existing.lastSeen, v.timestamp);
        } else {
          keyCounts.set(v.key, { count: 1, lastSeen: v.timestamp });
        }
      });

      const topOffendingKeys = Array.from(keyCounts.entries())
        .map(([key, data]) => ({ key, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      // Calculate totals
      const totalViolations = allViolations.length;
      const violationsLastHour = allViolations.filter(
        v => v.timestamp > Date.now() - 3600000
      ).length;
      const totalActiveKeys = limiters.reduce((sum, l) => sum + l.stats.totalKeys, 0);

      setData({
        limiters,
        recentViolations: allViolations.slice(0, 100),
        topOffendingKeys,
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to refresh rate limit data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalViolations = data.recentViolations.length;
  const violationsLastHour = data.recentViolations.filter(
    v => v.timestamp > Date.now() - 3600000
  ).length;
  const totalActiveKeys = data.limiters.reduce((sum, l) => sum + l.stats.totalKeys, 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Rate Limit Dashboard
          </h2>
          <p className="text-muted-foreground">
            Monitor rate limiting policies, violations, and blocked requests
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Updated {formatTimeAgo(lastUpdated.getTime())}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Violations"
          value={totalViolations}
          description="All time violations"
          icon={AlertTriangle}
          trend={violationsLastHour > 10 ? 'up' : 'neutral'}
        />
        <StatsCard
          title="Violations (Last Hour)"
          value={violationsLastHour}
          description="Recent rate limit violations"
          icon={Clock}
          trend={violationsLastHour > 5 ? 'up' : 'down'}
        />
        <StatsCard
          title="Active Keys"
          value={totalActiveKeys}
          description="Currently tracked rate limit keys"
          icon={Users}
        />
        <StatsCard
          title="Limiters"
          value={data.limiters.length}
          description="Active rate limiters"
          icon={BarChart3}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="violations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="violations" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Violations
            {violationsLastHour > 0 && (
              <Badge variant="destructive" className="ml-1">{violationsLastHour}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="limiters" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Limiters
          </TabsTrigger>
          <TabsTrigger value="offenders" className="flex items-center gap-2">
            <Ban className="h-4 w-4" />
            Top Offenders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="violations">
          <Card>
            <CardHeader>
              <CardTitle>Recent Rate Limit Violations</CardTitle>
              <CardDescription>
                Requests that exceeded rate limits in the last hour
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ViolationsTable violations={data.recentViolations} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limiters">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limiter Configuration</CardTitle>
              <CardDescription>
                Current rate limiting policies and their statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LimitersTable limiters={data.limiters} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offenders">
          <Card>
            <CardHeader>
              <CardTitle>Top Offending Keys</CardTitle>
              <CardDescription>
                Keys (users/IPs) with the most rate limit violations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.topOffendingKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No offending keys found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Violations</TableHead>
                      <TableHead>Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topOffendingKeys.map((offender) => {
                      const keyType = getKeyType(offender.key);
                      const keyValue = extractKeyValue(offender.key);
                      
                      return (
                        <TableRow key={offender.key}>
                          <TableCell className="font-mono text-xs">
                            {keyValue.length > 40 ? `${keyValue.slice(0, 40)}...` : keyValue}
                          </TableCell>
                          <TableCell>
                            <Badge variant={keyType === 'user' ? 'default' : 'secondary'}>
                              {keyType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">{offender.count}</Badge>
                          </TableCell>
                          <TableCell>{formatTimeAgo(offender.lastSeen)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RateLimitDashboard;
