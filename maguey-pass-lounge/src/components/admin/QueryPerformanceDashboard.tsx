/**
 * Query Performance Dashboard
 * 
 * Displays slow queries, index usage statistics, and query plan visualization
 * for database performance monitoring and optimization.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  RefreshCw,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Activity,
  Search,
  BarChart3,
  Timer,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  FileText,
  Lightbulb,
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

function getDurationBadgeVariant(ms: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (ms < 100) return 'outline';
  if (ms < 500) return 'secondary';
  if (ms < 1000) return 'default';
  return 'destructive';
}

function getUsageBadgeVariant(category: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (category) {
    case 'HIGH_USAGE': return 'default';
    case 'MODERATE': return 'secondary';
    case 'LOW_USAGE': return 'outline';
    case 'UNUSED': return 'destructive';
    default: return 'outline';
  }
}

function getUsageIcon(category: string) {
  switch (category) {
    case 'HIGH_USAGE': return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'MODERATE': return <Activity className="h-4 w-4 text-blue-500" />;
    case 'LOW_USAGE': return <TrendingDown className="h-4 w-4 text-yellow-500" />;
    case 'UNUSED': return <XCircle className="h-4 w-4 text-red-500" />;
    default: return <Info className="h-4 w-4" />;
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
  trend,
  trendValue,
}: { 
  title: string; 
  value: string | number; 
  description?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
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
        {trend && trendValue && (
          <div className="flex items-center mt-1">
            {trend === 'up' ? (
              <ArrowUpRight className="h-3 w-3 text-red-500 mr-1" />
            ) : trend === 'down' ? (
              <ArrowDownRight className="h-3 w-3 text-green-500 mr-1" />
            ) : null}
            <span className={`text-xs ${trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-muted-foreground'}`}>
              {trendValue}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SlowQueriesTable({ queries, onSelectQuery }: { queries: QueryPerformanceStats[]; onSelectQuery?: (query: QueryPerformanceStats) => void }) {
  if (queries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
        <p>No slow queries detected in the last 24 hours</p>
        <p className="text-sm">Your queries are performing well!</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Query</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Avg Time</TableHead>
          <TableHead className="text-right">Max Time</TableHead>
          <TableHead className="text-right">P95</TableHead>
          <TableHead className="text-right">Count</TableHead>
          <TableHead>Last Seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {queries.map((query) => (
          <TableRow 
            key={query.queryHash} 
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onSelectQuery?.(query)}
          >
            <TableCell className="font-mono text-xs max-w-[300px] truncate">
              {truncateQuery(query.queryPreview)}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{query.source || 'unknown'}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <Badge variant={getDurationBadgeVariant(query.avgDurationMs)}>
                {formatDuration(query.avgDurationMs)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Badge variant={getDurationBadgeVariant(query.maxDurationMs)}>
                {formatDuration(query.maxDurationMs)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {formatDuration(query.p95DurationMs)}
            </TableCell>
            <TableCell className="text-right">{query.executionCount}</TableCell>
            <TableCell>{formatTimeAgo(query.lastOccurred)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RecentQueriesTable({ queries }: { queries: SlowQueryLog[] }) {
  if (queries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4" />
        <p>No recent slow queries</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Query</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Duration</TableHead>
          <TableHead className="text-right">Rows</TableHead>
          <TableHead>Index Used</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {queries.map((query) => (
          <TableRow key={query.id}>
            <TableCell className="font-mono text-xs max-w-[300px] truncate">
              {truncateQuery(query.queryText)}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{query.source || 'unknown'}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <Badge variant={getDurationBadgeVariant(query.durationMs)}>
                {formatDuration(query.durationMs)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {query.rowsReturned ?? '-'}
            </TableCell>
            <TableCell>
              {query.indexUsed ? (
                <Badge variant="secondary">{query.indexUsed}</Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>{formatTimeAgo(query.occurredAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function IndexUsageTable({ indexes }: { indexes: IndexUsageStats[] }) {
  if (indexes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Database className="h-12 w-12 mx-auto mb-4" />
        <p>No index statistics available</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Index Name</TableHead>
          <TableHead>Table</TableHead>
          <TableHead className="text-right">Times Used</TableHead>
          <TableHead className="text-right">Tuples Read</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead>Usage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {indexes.map((index) => (
          <TableRow key={`${index.schemaName}.${index.indexName}`}>
            <TableCell className="font-mono text-sm">{index.indexName}</TableCell>
            <TableCell>{index.tableName}</TableCell>
            <TableCell className="text-right">{index.timesUsed.toLocaleString()}</TableCell>
            <TableCell className="text-right">{index.tuplesRead.toLocaleString()}</TableCell>
            <TableCell className="text-right">{index.indexSize}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getUsageIcon(index.usageCategory)}
                <Badge variant={getUsageBadgeVariant(index.usageCategory)}>
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
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            {suggestion.tableName}.{suggestion.columns.join('_')}
          </CardTitle>
          <Badge variant={
            suggestion.estimatedImprovement === 'high' ? 'default' :
            suggestion.estimatedImprovement === 'medium' ? 'secondary' : 'outline'
          }>
            {suggestion.estimatedImprovement} impact
          </Badge>
        </div>
        <CardDescription>{suggestion.reason}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="outline">{suggestion.indexType}</Badge>
            {suggestion.isPartial && <Badge variant="outline">Partial</Badge>}
            {suggestion.includeColumns && <Badge variant="outline">Covering</Badge>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Columns:</span>
            <span className="font-mono">{suggestion.columns.join(', ')}</span>
          </div>
          {suggestion.includeColumns && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Include:</span>
              <span className="font-mono">{suggestion.includeColumns.join(', ')}</span>
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowSql(!showSql)}
            className="mt-2"
          >
            <FileText className="h-4 w-4 mr-2" />
            {showSql ? 'Hide SQL' : 'Show SQL'}
          </Button>
          {showSql && (
            <pre className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
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
  const [selectedQuery, setSelectedQuery] = useState<QueryPerformanceStats | null>(null);

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
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Query Performance Dashboard
          </h2>
          <p className="text-muted-foreground">
            Monitor slow queries, index usage, and get optimization suggestions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Updated {formatTimeAgo(lastUpdated)}
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Slow Queries (24h)"
          value={stats.totalSlowQueries}
          description="Queries exceeding 100ms"
          icon={AlertTriangle}
          trend={stats.totalSlowQueries > 100 ? 'up' : 'neutral'}
        />
        <StatsCard
          title="Avg Query Time"
          value={formatDuration(stats.avgQueryTime)}
          description="Average slow query duration"
          icon={Timer}
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
          trend={stats.unusedIndexes > 5 ? 'up' : 'neutral'}
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
        <TabsList>
          <TabsTrigger value="slow-queries" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Slow Queries
            {slowQueryStats.length > 0 && (
              <Badge variant="destructive" className="ml-1">{slowQueryStats.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recent" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent
          </TabsTrigger>
          <TabsTrigger value="indexes" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Index Usage
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Suggestions
            {suggestions.length > 0 && (
              <Badge variant="secondary" className="ml-1">{suggestions.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="slow-queries">
          <Card>
            <CardHeader>
              <CardTitle>Slow Query Summary</CardTitle>
              <CardDescription>
                Queries that exceeded the 100ms threshold in the last 24 hours, grouped by pattern
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SlowQueriesTable 
                queries={slowQueryStats} 
                onSelectQuery={setSelectedQuery}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Slow Queries</CardTitle>
              <CardDescription>
                Individual slow query executions, most recent first
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentQueriesTable queries={recentQueries} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indexes">
          <Card>
            <CardHeader>
              <CardTitle>Index Usage Statistics</CardTitle>
              <CardDescription>
                How frequently each index is being used by queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IndexUsageTable indexes={indexStats} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle>Index Suggestions</CardTitle>
              <CardDescription>
                Recommended indexes based on slow query analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
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

      {/* Query Detail Dialog */}
      {selectedQuery && (
        <AlertDialog open={!!selectedQuery} onOpenChange={() => setSelectedQuery(null)}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Query Details</AlertDialogTitle>
              <AlertDialogDescription>
                Detailed performance information for this query pattern
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Query Preview</h4>
                <pre className="p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  {selectedQuery.queryPreview}
                </pre>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium">Performance Metrics</h4>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Avg Duration:</dt>
                      <dd className="font-medium">{formatDuration(selectedQuery.avgDurationMs)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Max Duration:</dt>
                      <dd className="font-medium">{formatDuration(selectedQuery.maxDurationMs)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Min Duration:</dt>
                      <dd className="font-medium">{formatDuration(selectedQuery.minDurationMs)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">P95 Duration:</dt>
                      <dd className="font-medium">{formatDuration(selectedQuery.p95DurationMs)}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Execution Info</h4>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Executions:</dt>
                      <dd className="font-medium">{selectedQuery.executionCount}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Source:</dt>
                      <dd className="font-medium">{selectedQuery.source || 'Unknown'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Last Seen:</dt>
                      <dd className="font-medium">{formatTimeAgo(selectedQuery.lastOccurred)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Performance Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{'<100ms'}</Badge>
              <span className="text-muted-foreground">Fast</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">100-500ms</Badge>
              <span className="text-muted-foreground">Acceptable</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">500ms-1s</Badge>
              <span className="text-muted-foreground">Slow</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive">{'>1s'}</Badge>
              <span className="text-muted-foreground">Critical</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default QueryPerformanceDashboard;
