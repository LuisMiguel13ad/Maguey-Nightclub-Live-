/**
 * Trace Dashboard Component
 * 
 * Displays distributed traces for debugging and performance monitoring.
 * Shows recent traces, filters by service/status/duration, and visualizes trace waterfalls.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, 
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  ChevronRight,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

interface TraceSpan {
  span_id: string;
  parent_span_id: string | null;
  service_name: string;
  span_name: string;
  duration_ms: number | null;
  status: string;
  start_time: string;
  end_time: string | null;
  attributes: Record<string, unknown>;
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
  }>;
  depth?: number;
}

interface TraceSummary {
  trace_id: string;
  trace_start: string;
  trace_end: string | null;
  span_count: number;
  service_count: number;
  services: string[];
  total_duration_ms: number | null;
  avg_duration_ms: number | null;
  max_duration_ms: number | null;
  has_errors: boolean;
  error_count: number;
}

interface TraceTree {
  trace_id: string;
  spans: TraceSpan[];
  summary: TraceSummary;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDuration(ms: number | null): string {
  if (ms === null) return 'N/A';
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'error': return 'bg-red-100 text-red-800 border-red-300';
    case 'ok': return 'bg-green-100 text-green-800 border-green-300';
    case 'unset': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'error': return <AlertTriangle className="w-4 h-4" />;
    case 'ok': return <CheckCircle2 className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
}

// ============================================
// COMPONENTS
// ============================================

interface TraceListItemProps {
  trace: TraceSummary;
  onSelect: (traceId: string) => void;
  isSelected: boolean;
}

function TraceListItem({ trace, onSelect, isSelected }: TraceListItemProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      } ${trace.has_errors ? 'border-red-300' : ''}`}
      onClick={() => onSelect(trace.trace_id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <code className="text-xs font-mono text-muted-foreground">
                {trace.trace_id.substring(0, 8)}...
              </code>
              {trace.has_errors && (
                <Badge variant="destructive" className="text-xs">
                  {trace.error_count} error{trace.error_count !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{formatTimestamp(trace.trace_start)}</span>
              <span>•</span>
              <span>{trace.span_count} span{trace.span_count !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>{trace.service_count} service{trace.service_count !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {trace.services.map((service) => (
                <Badge key={service} variant="outline" className="text-xs">
                  {service}
                </Badge>
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">
              {formatDuration(trace.total_duration_ms)}
            </div>
            <div className="text-xs text-muted-foreground">
              {trace.avg_duration_ms !== null && `avg: ${formatDuration(trace.avg_duration_ms)}`}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SpanTreeItemProps {
  span: TraceSpan;
  level: number;
  isExpanded: boolean;
  onToggle: () => void;
  maxDuration: number;
}

function SpanTreeItem({ span, level, isExpanded, onToggle, maxDuration }: SpanTreeItemProps) {
  const hasChildren = false; // Would need to check if any spans have this as parent
  const indent = level * 24;
  const durationPercent = span.duration_ms && maxDuration > 0 
    ? (span.duration_ms / maxDuration) * 100 
    : 0;

  return (
    <div className="border-l-2 border-border/50 pl-4 py-2">
      <div 
        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
        onClick={onToggle}
        style={{ marginLeft: `${indent}px` }}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )
        ) : (
          <div className="w-4" />
        )}
        <Badge className={getStatusColor(span.status)}>
          {getStatusIcon(span.status)}
          <span className="ml-1">{span.status}</span>
        </Badge>
        <span className="font-medium">{span.span_name}</span>
        <span className="text-sm text-muted-foreground">({span.service_name})</span>
        <div className="flex-1" />
        <span className="text-sm font-mono">{formatDuration(span.duration_ms)}</span>
      </div>
      {isExpanded && (
        <div className="ml-8 mt-2 space-y-1">
          <div className="text-xs text-muted-foreground">
            <div>Span ID: <code>{span.span_id}</code></div>
            {span.parent_span_id && (
              <div>Parent: <code>{span.parent_span_id}</code></div>
            )}
            <div>Start: {formatTimestamp(span.start_time)}</div>
            {span.end_time && <div>End: {formatTimestamp(span.end_time)}</div>}
          </div>
          {span.events.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold mb-1">Events:</div>
              {span.events.map((event, idx) => (
                <div key={idx} className="text-xs text-muted-foreground ml-2">
                  • {event.name}
                </div>
              ))}
            </div>
          )}
          {Object.keys(span.attributes).length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold mb-1">Attributes:</div>
              <div className="text-xs text-muted-foreground space-y-1">
                {Object.entries(span.attributes).slice(0, 5).map(([key, value]) => (
                  <div key={key} className="ml-2">
                    <code className="text-xs">{key}</code>: {String(value)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {durationPercent > 0 && (
        <div className="ml-8 mt-1">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${durationPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function TraceDashboard() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Expanded spans
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());

  // Fetch traces
  const fetchTraces = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('trace_summaries')
        .select('*')
        .order('trace_start', { ascending: false })
        .limit(50);

      // Apply filters
      if (serviceFilter !== 'all') {
        // Note: This would need a more complex query or application-side filtering
        // For now, we'll filter client-side
      }

      if (statusFilter === 'errors') {
        query = query.eq('has_errors', true);
      }

      if (durationFilter === 'slow') {
        query = query.gte('total_duration_ms', 1000);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      let filtered = data || [];

      // Client-side filtering for service
      if (serviceFilter !== 'all') {
        filtered = filtered.filter((trace: TraceSummary) =>
          trace.services.includes(serviceFilter)
        );
      }

      // Client-side search
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        filtered = filtered.filter((trace: TraceSummary) =>
          trace.trace_id.toLowerCase().includes(queryLower) ||
          trace.services.some(s => s.toLowerCase().includes(queryLower))
        );
      }

      setTraces(filtered as TraceSummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch traces');
      console.error('Error fetching traces:', err);
    } finally {
      setLoading(false);
    }
  }, [serviceFilter, statusFilter, durationFilter, searchQuery]);

  // Fetch trace details
  const fetchTraceDetails = useCallback(async (traceId: string) => {
    try {
      // Get trace summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('trace_summaries')
        .select('*')
        .eq('trace_id', traceId)
        .single();

      if (summaryError) throw summaryError;

      // Get trace tree using the function
      const { data: treeData, error: treeError } = await supabase
        .rpc('get_trace_tree', { p_trace_id: traceId });

      if (treeError) throw treeError;

      // Get full span details
      const { data: spansData, error: spansError } = await supabase
        .from('traces')
        .select('*')
        .eq('trace_id', traceId)
        .order('start_time', { ascending: true });

      if (spansError) throw spansError;

      setSelectedTrace({
        trace_id: traceId,
        spans: (spansData || []) as TraceSpan[],
        summary: summaryData as TraceSummary,
      });
    } catch (err) {
      console.error('Error fetching trace details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trace details');
    }
  }, []);

  // Get unique services for filter
  const uniqueServices = Array.from(
    new Set(traces.flatMap(t => t.services))
  ).sort();

  useEffect(() => {
    fetchTraces();
  }, [fetchTraces]);

  const toggleSpan = (spanId: string) => {
    setExpandedSpans(prev => {
      const next = new Set(prev);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  };

  const maxDuration = selectedTrace?.spans.reduce((max, span) => {
    return span.duration_ms && span.duration_ms > max ? span.duration_ms : max;
  }, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trace Dashboard</h1>
          <p className="text-muted-foreground">
            View and analyze distributed traces for debugging and performance monitoring
          </p>
        </div>
        <Button onClick={fetchTraces} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search traces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {uniqueServices.map(service => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="errors">Errors Only</SelectItem>
                <SelectItem value="ok">Success Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={durationFilter} onValueChange={setDurationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Durations</SelectItem>
                <SelectItem value="slow">Slow (&gt;1s)</SelectItem>
                <SelectItem value="fast">Fast (&lt;100ms)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-300">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trace List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Traces</CardTitle>
            <CardDescription>
              {traces.length} trace{traces.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                Loading traces...
              </div>
            ) : traces.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No traces found
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {traces.map(trace => (
                  <TraceListItem
                    key={trace.trace_id}
                    trace={trace}
                    onSelect={fetchTraceDetails}
                    isSelected={selectedTrace?.trace_id === trace.trace_id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trace Details */}
        <Card>
          <CardHeader>
            <CardTitle>Trace Details</CardTitle>
            {selectedTrace && (
              <CardDescription>
                <code className="text-xs">{selectedTrace.trace_id}</code>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedTrace ? (
              <div className="text-center py-8 text-muted-foreground">
                Select a trace to view details
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Duration</div>
                    <div className="text-lg font-semibold">
                      {formatDuration(selectedTrace.summary.total_duration_ms)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Spans</div>
                    <div className="text-lg font-semibold">
                      {selectedTrace.summary.span_count}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Services</div>
                    <div className="text-lg font-semibold">
                      {selectedTrace.summary.service_count}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div>
                      <Badge className={selectedTrace.summary.has_errors ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                        {selectedTrace.summary.has_errors ? 'Has Errors' : 'Success'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Span Tree */}
                <div>
                  <div className="text-sm font-semibold mb-2">Span Tree</div>
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {selectedTrace.spans.map(span => (
                      <SpanTreeItem
                        key={span.span_id}
                        span={span}
                        level={span.depth || 0}
                        isExpanded={expandedSpans.has(span.span_id)}
                        onToggle={() => toggleSpan(span.span_id)}
                        maxDuration={maxDuration}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
