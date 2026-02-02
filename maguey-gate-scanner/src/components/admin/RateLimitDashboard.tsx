/**
 * Rate Limit Dashboard
 *
 * Displays rate limiting statistics and violations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Activity,
  Ban,
  CheckCircle2,
  Users,
} from 'lucide-react';
import {
  orderLimiter,
  apiLimiter,
  authLimiter,
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
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{value}</div>
        {description && (
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ViolationsTable({ violations }: { violations: RateLimitViolation[] }) {
  if (violations.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-400" />
        <p>No rate limit violations in the last hour</p>
        <p className="text-sm">All requests are within limits!</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/10">
          <TableHead className="text-slate-400">Key</TableHead>
          <TableHead className="text-slate-400">Type</TableHead>
          <TableHead className="text-slate-400">Endpoint</TableHead>
          <TableHead className="text-right text-slate-400">Count</TableHead>
          <TableHead className="text-right text-slate-400">Max</TableHead>
          <TableHead className="text-slate-400">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {violations.map((violation, index) => {
          const keyType = getKeyType(violation.key);
          const keyValue = extractKeyValue(violation.key);

          return (
            <TableRow key={index} className="border-white/10">
              <TableCell className="font-mono text-xs text-slate-300">
                {keyValue.length > 30 ? `${keyValue.slice(0, 30)}...` : keyValue}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={keyType === 'user' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-slate-500/20 text-slate-400 border-slate-500/50'}>
                  {keyType}
                </Badge>
              </TableCell>
              <TableCell className="text-slate-300">
                {violation.endpoint || <span className="text-slate-500">-</span>}
              </TableCell>
              <TableCell className="text-right">
                <Badge className="bg-red-500/20 text-red-400">{violation.count}</Badge>
              </TableCell>
              <TableCell className="text-right text-slate-300">{violation.maxRequests}</TableCell>
              <TableCell className="text-slate-400">{formatTimeAgo(violation.timestamp)}</TableCell>
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
        <TableRow className="border-white/10">
          <TableHead className="text-slate-400">Limiter</TableHead>
          <TableHead className="text-slate-400">Window</TableHead>
          <TableHead className="text-right text-slate-400">Max Requests</TableHead>
          <TableHead className="text-right text-slate-400">Active Keys</TableHead>
          <TableHead className="text-right text-slate-400">Total Violations</TableHead>
          <TableHead className="text-right text-slate-400">Last Hour</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {limiters.map((limiter) => (
          <TableRow key={limiter.name} className="border-white/10">
            <TableCell className="font-medium text-white">{limiter.name}</TableCell>
            <TableCell className="text-slate-300">{formatDuration(limiter.config.windowMs)}</TableCell>
            <TableCell className="text-right text-slate-300">{limiter.config.maxRequests}</TableCell>
            <TableCell className="text-right text-slate-300">{limiter.stats.totalKeys}</TableCell>
            <TableCell className="text-right text-slate-300">{limiter.stats.totalViolations}</TableCell>
            <TableCell className="text-right">
              {limiter.stats.violationsLastHour > 0 ? (
                <Badge className="bg-red-500/20 text-red-400">{limiter.stats.violationsLastHour}</Badge>
              ) : (
                <span className="text-slate-500">0</span>
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
          name: 'Ticket Scanning',
          config: scanLimiter['config'],
          stats: scanLimiter.getStats(),
        },
      ];

      // Get recent violations from all limiters
      const allViolations: RateLimitViolation[] = [];
      allViolations.push(...orderLimiter.getViolations(50));
      allViolations.push(...apiLimiter.getViolations(50));
      allViolations.push(...authLimiter.getViolations(50));
      allViolations.push(...scanLimiter.getViolations(50));

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
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const totalViolations = data.recentViolations.length;
  const violationsLastHour = data.recentViolations.filter(
    v => v.timestamp > Date.now() - 3600000
  ).length;
  const totalActiveKeys = data.limiters.reduce((sum, l) => sum + l.stats.totalKeys, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <Shield className="h-8 w-8" />
            Rate Limit Dashboard
          </h1>
          <p className="text-slate-400">
            Monitor rate limiting policies and violations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            Updated {formatTimeAgo(lastUpdated.getTime())}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
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
        />
        <StatsCard
          title="Violations (Last Hour)"
          value={violationsLastHour}
          description="Recent rate limit violations"
          icon={Clock}
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
          icon={Activity}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="violations" className="space-y-4">
        <TabsList className="bg-white/5 border-white/10">
          <TabsTrigger value="violations" className="flex items-center gap-2 data-[state=active]:bg-white/10">
            <AlertTriangle className="h-4 w-4" />
            Violations
            {violationsLastHour > 0 && (
              <Badge className="ml-1 bg-red-500/20 text-red-400">{violationsLastHour}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="limiters" className="flex items-center gap-2 data-[state=active]:bg-white/10">
            <Activity className="h-4 w-4" />
            Limiters
          </TabsTrigger>
          <TabsTrigger value="offenders" className="flex items-center gap-2 data-[state=active]:bg-white/10">
            <Ban className="h-4 w-4" />
            Top Offenders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="violations">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Recent Rate Limit Violations</CardTitle>
              <CardDescription className="text-slate-400">
                Requests that exceeded rate limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ViolationsTable violations={data.recentViolations} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limiters">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Rate Limiter Configuration</CardTitle>
              <CardDescription className="text-slate-400">
                Current rate limiting policies and their statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LimitersTable limiters={data.limiters} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offenders">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Top Offending Keys</CardTitle>
              <CardDescription className="text-slate-400">
                Keys (users/IPs) with the most rate limit violations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.topOffendingKeys.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-400" />
                  <p>No offending keys found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-slate-400">Key</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-right text-slate-400">Violations</TableHead>
                      <TableHead className="text-slate-400">Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topOffendingKeys.map((offender) => {
                      const keyType = getKeyType(offender.key);
                      const keyValue = extractKeyValue(offender.key);

                      return (
                        <TableRow key={offender.key} className="border-white/10">
                          <TableCell className="font-mono text-xs text-slate-300">
                            {keyValue.length > 40 ? `${keyValue.slice(0, 40)}...` : keyValue}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-white/10 text-slate-300">
                              {keyType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-red-500/20 text-red-400">{offender.count}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-400">{formatTimeAgo(offender.lastSeen)}</TableCell>
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
