/**
 * Query Performance Dashboard
 *
 * Displays slow queries, index usage statistics, and optimization suggestions.
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
  Database,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  FileText,
} from 'lucide-react';
import {
  getSlowQueryStats,
  getRecentSlowQueries,
  getIndexUsageStats,
  suggestIndexes,
  type QueryPerformanceStats,
  type SlowQueryLog,
  type IndexUsageStats,
  type IndexSuggestion,
} from '@/lib/query-optimizer';

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  totalSlowQueries: number;
  avgQueryTime: number;
  maxQueryTime: number;
  unusedIndexes: number;
  highUsageIndexes: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getDurationBadgeClass(ms: number): string {
  if (ms < 100) return 'bg-green-500/20 text-green-400';
  if (ms < 500) return 'bg-yellow-500/20 text-yellow-400';
  if (ms < 1000) return 'bg-orange-500/20 text-orange-400';
  return 'bg-red-500/20 text-red-400';
}

function getUsageBadgeClass(category: string): string {
  switch (category) {
    case 'HIGH_USAGE': return 'bg-green-500/20 text-green-400';
    case 'MODERATE': return 'bg-blue-500/20 text-blue-400';
    case 'LOW_USAGE': return 'bg-yellow-500/20 text-yellow-400';
    case 'UNUSED': return 'bg-red-500/20 text-red-400';
    default: return 'bg-slate-500/20 text-slate-400';
  }
}

function getUsageIcon(category: string) {
  switch (category) {
    case 'HIGH_USAGE': return <TrendingUp className="h-4 w-4 text-green-400" />;
    case 'MODERATE': return <Activity className="h-4 w-4 text-blue-400" />;
    case 'LOW_USAGE': return <TrendingDown className="h-4 w-4 text-yellow-400" />;
    case 'UNUSED': return <XCircle className="h-4 w-4 text-red-400" />;
    default: return null;
  }
}

function truncateQuery(query: string, maxLength: number = 100): string {
  if (query.length <= maxLength) return query;
  return query.slice(0, maxLength) + '...';
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

function SlowQueriesTable({ queries }: { queries: QueryPerformanceStats[] }) {
  if (queries.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-400" />
        <p>No slow queries detected in the last 24 hours</p>
        <p className="text-sm">Your queries are performing well!</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/10">
          <TableHead className="text-slate-400">Query</TableHead>
          <TableHead className="text-slate-400">Source</TableHead>
          <TableHead className="text-right text-slate-400">Avg Time</TableHead>
          <TableHead className="text-right text-slate-400">Max Time</TableHead>
          <TableHead className="text-right text-slate-400">Count</TableHead>
          <TableHead className="text-slate-400">Last Seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {queries.map((query) => (
          <TableRow key={query.queryHash} className="border-white/10">
            <TableCell className="font-mono text-xs max-w-[300px] truncate text-slate-300">
              {truncateQuery(query.queryPreview)}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="border-white/10 text-slate-300">{query.source || 'unknown'}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <Badge className={getDurationBadgeClass(query.avgDurationMs)}>
                {formatDuration(query.avgDurationMs)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Badge className={getDurationBadgeClass(query.maxDurationMs)}>
                {formatDuration(query.maxDurationMs)}
              </Badge>
            </TableCell>
            <TableCell className="text-right text-slate-300">{query.executionCount}</TableCell>
            <TableCell className="text-slate-400">{formatTimeAgo(query.lastOccurred)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RecentQueriesTable({ queries }: { queries: SlowQueryLog[] }) {
  if (queries.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Clock className="h-12 w-12 mx-auto mb-4" />
        <p>No recent slow queries</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/10">
          <TableHead className="text-slate-400">Query</TableHead>
          <TableHead className="text-slate-400">Source</TableHead>
          <TableHead className="text-right text-slate-400">Duration</TableHead>
          <TableHead className="text-right text-slate-400">Rows</TableHead>
          <TableHead className="text-slate-400">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {queries.map((query) => (
          <TableRow key={query.id} className="border-white/10">
            <TableCell className="font-mono text-xs max-w-[300px] truncate text-slate-300">
              {truncateQuery(query.queryText)}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="border-white/10 text-slate-300">{query.source || 'unknown'}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <Badge className={getDurationBadgeClass(query.durationMs)}>
                {formatDuration(query.durationMs)}
              </Badge>
            </TableCell>
            <TableCell className="text-right text-slate-300">
              {query.rowsReturned ?? '-'}
            </TableCell>
            <TableCell className="text-slate-400">{formatTimeAgo(query.occurredAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function IndexUsageTable({ indexes }: { indexes: IndexUsageStats[] }) {
  if (indexes.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Database className="h-12 w-12 mx-auto mb-4" />
        <p>No index statistics available</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/10">
          <TableHead className="text-slate-400">Index Name</TableHead>
          <TableHead className="text-slate-400">Table</TableHead>
          <TableHead className="text-right text-slate-400">Times Used</TableHead>
          <TableHead className="text-right text-slate-400">Size</TableHead>
          <TableHead className="text-slate-400">Usage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {indexes.map((index) => (
          <TableRow key={`${index.schemaName}.${index.indexName}`} className="border-white/10">
            <TableCell className="font-mono text-sm text-slate-300">{index.indexName}</TableCell>
            <TableCell className="text-slate-300">{index.tableName}</TableCell>
            <TableCell className="text-right text-slate-300">{index.timesUsed.toLocaleString()}</TableCell>
            <TableCell className="text-right text-slate-300">{index.indexSize}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getUsageIcon(index.usageCategory)}
                <Badge className={getUsageBadgeClass(index.usageCategory)}>
                  {index.usageCategory.replace('_', ' ')}
                </Badge>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function IndexSuggestionCard({ suggestion }: { suggestion: IndexSuggestion }) {
  const [showSql, setShowSql] = useState(false);

  return (
    <Card className="mb-4 bg-white/5 border-white/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
            <Lightbulb className="h-4 w-4 text-yellow-400" />
            {suggestion.tableName}.{suggestion.columns.join('_')}
          </CardTitle>
          <Badge className={
            suggestion.estimatedImprovement === 'high' ? 'bg-green-500/20 text-green-400' :
            suggestion.estimatedImprovement === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-slate-500/20 text-slate-400'
          }>
            {suggestion.estimatedImprovement} impact
          </Badge>
        </div>
        <CardDescription className="text-slate-400">{suggestion.reason}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Type:</span>
            <Badge variant="outline" className="border-white/10 text-slate-300">{suggestion.indexType}</Badge>
            {suggestion.isPartial && <Badge variant="outline" className="border-white/10 text-slate-300">Partial</Badge>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Columns:</span>
            <span className="font-mono text-slate-300">{suggestion.columns.join(', ')}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSql(!showSql)}
            className="mt-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <FileText className="h-4 w-4 mr-2" />
            {showSql ? 'Hide SQL' : 'Show SQL'}
          </Button>
          {showSql && (
            <pre className="mt-2 p-3 bg-black/50 rounded-md text-xs font-mono overflow-x-auto text-slate-300">
              {suggestion.createStatement}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QueryPerformanceDashboard() {
  const [slowQueryStats, setSlowQueryStats] = useState<QueryPerformanceStats[]>([]);
  const [recentQueries, setRecentQueries] = useState<SlowQueryLog[]>([]);
  const [indexStats, setIndexStats] = useState<IndexUsageStats[]>([]);
  const [suggestions, setSuggestions] = useState<IndexSuggestion[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalSlowQueries: 0,
    avgQueryTime: 0,
    maxQueryTime: 0,
    unusedIndexes: 0,
    highUsageIndexes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const [slowStats, recent, indexes] = await Promise.all([
        getSlowQueryStats(24, 50),
        getRecentSlowQueries(20),
        getIndexUsageStats(),
      ]);

      setSlowQueryStats(slowStats);
      setRecentQueries(recent);
      setIndexStats(indexes);

      // Generate suggestions from slow queries
      const queryTexts = recent.map(q => q.queryText);
      const indexSuggestions = suggestIndexes(queryTexts);
      setSuggestions(indexSuggestions);

      // Calculate dashboard stats
      const totalSlowQueries = slowStats.reduce((sum, q) => sum + q.executionCount, 0);
      const avgQueryTime = slowStats.length > 0
        ? slowStats.reduce((sum, q) => sum + q.avgDurationMs, 0) / slowStats.length
        : 0;
      const maxQueryTime = slowStats.length > 0
        ? Math.max(...slowStats.map(q => q.maxDurationMs))
        : 0;
      const unusedIndexes = indexes.filter(i => i.usageCategory === 'UNUSED').length;
      const highUsageIndexes = indexes.filter(i => i.usageCategory === 'HIGH_USAGE').length;

      setStats({
        totalSlowQueries,
        avgQueryTime,
        maxQueryTime,
        unusedIndexes,
        highUsageIndexes,
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to refresh query performance data:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <Database className="h-8 w-8" />
            Query Performance
          </h1>
          <p className="text-slate-400">
            Monitor slow queries and index usage
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            Updated {formatTimeAgo(lastUpdated)}
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Slow Queries (24h)"
          value={stats.totalSlowQueries}
          description="Queries exceeding 100ms"
          icon={AlertTriangle}
        />
        <StatsCard
          title="Avg Query Time"
          value={formatDuration(stats.avgQueryTime)}
          description="Average slow query duration"
          icon={Clock}
        />
        <StatsCard
          title="Max Query Time"
          value={formatDuration(stats.maxQueryTime)}
          description="Slowest query recorded"
          icon={Clock}
        />
        <StatsCard
          title="Unused Indexes"
          value={stats.unusedIndexes}
          description="Indexes with no recent usage"
          icon={Database}
        />
        <StatsCard
          title="High Usage Indexes"
          value={stats.highUsageIndexes}
          description="Well-utilized indexes"
          icon={Zap}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="slow-queries" className="space-y-4">
        <TabsList className="bg-white/5 border-white/10">
          <TabsTrigger value="slow-queries" className="flex items-center gap-2 data-[state=active]:bg-white/10">
            <AlertTriangle className="h-4 w-4" />
            Slow Queries
          </TabsTrigger>
          <TabsTrigger value="recent" className="flex items-center gap-2 data-[state=active]:bg-white/10">
            <Clock className="h-4 w-4" />
            Recent
          </TabsTrigger>
          <TabsTrigger value="indexes" className="flex items-center gap-2 data-[state=active]:bg-white/10">
            <Database className="h-4 w-4" />
            Index Usage
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-2 data-[state=active]:bg-white/10">
            <Lightbulb className="h-4 w-4" />
            Suggestions
            {suggestions.length > 0 && (
              <Badge className="ml-1 bg-yellow-500/20 text-yellow-400">{suggestions.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="slow-queries">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Slow Query Summary</CardTitle>
              <CardDescription className="text-slate-400">
                Queries that exceeded the 100ms threshold in the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SlowQueriesTable queries={slowQueryStats} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Recent Slow Queries</CardTitle>
              <CardDescription className="text-slate-400">
                Individual slow query executions, most recent first
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentQueriesTable queries={recentQueries} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indexes">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Index Usage Statistics</CardTitle>
              <CardDescription className="text-slate-400">
                How frequently each index is being used by queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IndexUsageTable indexes={indexStats} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Index Suggestions</CardTitle>
              <CardDescription className="text-slate-400">
                Recommended indexes based on slow query analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-400" />
                  <p>No index suggestions at this time</p>
                  <p className="text-sm">Your indexes appear to be well-optimized!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((suggestion, index) => (
                    <IndexSuggestionCard key={index} suggestion={suggestion} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Legend */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-sm text-white">Performance Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <Badge className="bg-green-500/20 text-green-400">{'<100ms'}</Badge>
              <span>Fast</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Badge className="bg-yellow-500/20 text-yellow-400">100-500ms</Badge>
              <span>Acceptable</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Badge className="bg-orange-500/20 text-orange-400">500ms-1s</Badge>
              <span>Slow</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Badge className="bg-red-500/20 text-red-400">{'>1s'}</Badge>
              <span>Critical</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default QueryPerformanceDashboard;
