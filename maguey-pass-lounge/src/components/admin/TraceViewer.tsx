/**
 * Trace Viewer Component
 * 
 * Unified trace viewer with waterfall visualization.
 * Shows spans as horizontal bars with timing, color-coded by service.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronRight,
  ChevronDown,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Copy,
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

interface TraceTree {
  trace_id: string;
  spans: TraceSpan[];
  summary: {
    trace_start: string;
    trace_end: string | null;
    total_duration_ms: number | null;
    span_count: number;
    service_count: number;
    services: string[];
    has_errors: boolean;
  };
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
  return new Date(ts).toLocaleTimeString();
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'error': return 'bg-red-500';
    case 'ok': return 'bg-green-500';
    case 'unset': return 'bg-gray-400';
    default: return 'bg-yellow-500';
  }
}

function getServiceColor(service: string): string {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-cyan-500',
    'bg-teal-500',
  ];
  const hash = service.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
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

interface WaterfallBarProps {
  span: TraceSpan;
  startTime: number;
  totalDuration: number;
  maxDuration: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function WaterfallBar({ span, startTime, totalDuration, maxDuration, isExpanded, onToggle }: WaterfallBarProps) {
  const spanStart = new Date(span.start_time).getTime();
  const relativeStart = spanStart - startTime;
  const startPercent = (relativeStart / totalDuration) * 100;
  const widthPercent = span.duration_ms ? (span.duration_ms / maxDuration) * 100 : 0;
  const serviceColor = getServiceColor(span.service_name);
  const statusColor = getStatusColor(span.status);

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-all"
        onClick={onToggle}
        style={{ paddingLeft: `${(span.depth || 0) * 24 + 8}px` }}
      >
        <div className="flex items-center gap-2 min-w-[200px]">
          {span.parent_span_id ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-4" />
          )}
          <Badge className={`${getStatusColor(span.status)} text-white`}>
            {getStatusIcon(span.status)}
            <span className="ml-1">{span.status}</span>
          </Badge>
          <span className="font-medium text-sm">{span.span_name}</span>
          <Badge variant="outline" className="text-xs">
            {span.service_name}
          </Badge>
        </div>
        <div className="flex-1 relative h-8 bg-muted/30 rounded overflow-hidden">
          {/* Background timeline */}
          <div className="absolute inset-0 flex items-center">
            <div
              className={`h-full ${serviceColor} opacity-30`}
              style={{
                marginLeft: `${startPercent}%`,
                width: `${widthPercent}%`,
                minWidth: '2px',
              }}
            />
          </div>
          {/* Actual span bar */}
          <div
            className={`absolute h-6 ${statusColor} rounded shadow-sm flex items-center justify-end pr-2 text-white text-xs font-medium`}
            style={{
              left: `${startPercent}%`,
              width: `${Math.max(widthPercent, 0.5)}%`,
              minWidth: '20px',
            }}
            title={`${formatDuration(span.duration_ms)} - ${formatTimestamp(span.start_time)}`}
          >
            {span.duration_ms && span.duration_ms > 50 && formatDuration(span.duration_ms)}
          </div>
        </div>
        <div className="min-w-[80px] text-right text-sm text-muted-foreground">
          {formatDuration(span.duration_ms)}
        </div>
      </div>
      {isExpanded && (
        <div className="ml-8 mt-2 mb-4 p-3 bg-muted/30 rounded text-sm space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Span ID:</span>
              <code className="ml-2 text-xs">{span.span_id}</code>
            </div>
            {span.parent_span_id && (
              <div>
                <span className="text-muted-foreground">Parent:</span>
                <code className="ml-2 text-xs">{span.parent_span_id}</code>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Start:</span>
              <span className="ml-2">{formatTimestamp(span.start_time)}</span>
            </div>
            {span.end_time && (
              <div>
                <span className="text-muted-foreground">End:</span>
                <span className="ml-2">{formatTimestamp(span.end_time)}</span>
              </div>
            )}
          </div>
          {span.events.length > 0 && (
            <div>
              <div className="font-semibold mb-1">Events:</div>
              <div className="space-y-1">
                {span.events.map((event, idx) => (
                  <div key={idx} className="text-xs">
                    • <span className="font-medium">{event.name}</span>
                    {event.attributes && Object.keys(event.attributes).length > 0 && (
                      <span className="text-muted-foreground ml-2">
                        {JSON.stringify(event.attributes)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(span.attributes).length > 0 && (
            <div>
              <div className="font-semibold mb-1">Attributes:</div>
              <div className="space-y-1">
                {Object.entries(span.attributes).slice(0, 10).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <code className="text-xs">{key}</code>: {String(value)}
                  </div>
                ))}
                {Object.keys(span.attributes).length > 10 && (
                  <div className="text-xs text-muted-foreground">
                    ... and {Object.keys(span.attributes).length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface TraceViewerProps {
  traceId: string;
  onClose?: () => void;
}

export function TraceViewer({ traceId, onClose }: TraceViewerProps) {
  const [trace, setTrace] = useState<TraceTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTrace();
  }, [traceId]);

  const fetchTrace = async () => {
    setLoading(true);
    setError(null);

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

      setTrace({
        trace_id: traceId,
        spans: (spansData || []) as TraceSpan[],
        summary: summaryData as TraceTree['summary'],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trace');
      console.error('Error fetching trace:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const copyTraceId = () => {
    navigator.clipboard.writeText(traceId);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">Loading trace...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !trace) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-red-600">
            {error || 'Trace not found'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const startTime = new Date(trace.summary.trace_start).getTime();
  const endTime = trace.summary.trace_end 
    ? new Date(trace.summary.trace_end).getTime()
    : Date.now();
  const totalDuration = endTime - startTime;
  const maxDuration = trace.spans.reduce((max, span) => {
    return span.duration_ms && span.duration_ms > max ? span.duration_ms : max;
  }, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Trace Details</CardTitle>
            <CardDescription>
              <code className="text-xs">{traceId}</code>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyTraceId}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Trace ID
            </Button>
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <div className="text-sm text-muted-foreground">Total Duration</div>
            <div className="text-lg font-semibold">
              {formatDuration(trace.summary.total_duration_ms)}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Spans</div>
            <div className="text-lg font-semibold">
              {trace.summary.span_count}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Services</div>
            <div className="text-lg font-semibold">
              {trace.summary.service_count}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Status</div>
            <div>
              <Badge className={trace.summary.has_errors ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                {trace.summary.has_errors ? 'Has Errors' : 'Success'}
              </Badge>
            </div>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Services Legend */}
        <div className="mb-4">
          <div className="text-sm font-semibold mb-2">Services:</div>
          <div className="flex flex-wrap gap-2">
            {trace.summary.services.map(service => (
              <Badge key={service} variant="outline" className="text-xs">
                <div className={`w-3 h-3 rounded mr-2 ${getServiceColor(service)}`} />
                {service}
              </Badge>
            ))}
          </div>
        </div>

        {/* Waterfall Chart */}
        <div className="mb-4">
          <div className="text-sm font-semibold mb-2">Waterfall View</div>
          <div className="border rounded p-4 bg-background space-y-1 max-h-[600px] overflow-y-auto">
            {trace.spans.map(span => (
              <WaterfallBar
                key={span.span_id}
                span={span}
                startTime={startTime}
                totalDuration={totalDuration}
                maxDuration={maxDuration}
                isExpanded={expandedSpans.has(span.span_id)}
                onToggle={() => toggleSpan(span.span_id)}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
