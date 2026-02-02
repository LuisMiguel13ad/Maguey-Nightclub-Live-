/**
 * Trace List Component
 *
 * List recent traces with filtering capabilities.
 * Filter by: service, status, duration, time range.
 * Quick actions: view details, copy trace ID.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Filter,
  RefreshCw,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TraceViewer } from './TraceViewer';

// ============================================
// TYPES
// ============================================

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

// ============================================
// COMPONENTS
// ============================================

interface TraceListItemProps {
  trace: TraceSummary;
  onSelect: (traceId: string) => void;
  isSelected: boolean;
}

function TraceListItem({ trace, onSelect, isSelected }: TraceListItemProps) {
  const copyTraceId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(trace.trace_id);
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md bg-white/5 border-white/10 ${
        isSelected ? 'ring-2 ring-indigo-500' : ''
      } ${trace.has_errors ? 'border-red-500/50' : ''}`}
      onClick={() => onSelect(trace.trace_id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <code className="text-xs font-mono text-slate-400">
                {trace.trace_id.substring(0, 8)}...
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                onClick={copyTraceId}
                title="Copy Trace ID"
              >
                <Copy className="w-3 h-3" />
              </Button>
              {trace.has_errors && (
                <Badge variant="destructive" className="text-xs bg-red-500/20 text-red-400 border-red-500/50">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {trace.error_count} error{trace.error_count !== 1 ? 's' : ''}
                </Badge>
              )}
              {!trace.has_errors && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/50">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Success
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400 mb-2">
              <span>{formatTimestamp(trace.trace_start)}</span>
              <span>•</span>
              <span>{trace.span_count} span{trace.span_count !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>{trace.service_count} service{trace.service_count !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {trace.services.map((service) => (
                <Badge key={service} variant="outline" className="text-xs border-white/10 text-slate-300">
                  {service}
                </Badge>
              ))}
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="text-lg font-semibold text-white">
              {formatDuration(trace.total_duration_ms)}
            </div>
            {trace.avg_duration_ms !== null && (
              <div className="text-xs text-slate-400">
                avg: {formatDuration(trace.avg_duration_ms)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function TraceList() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch traces
  const fetchTraces = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('trace_summaries')
        .select('*')
        .order('trace_start', { ascending: false })
        .limit(100);

      // Apply filters
      if (statusFilter === 'errors') {
        query = query.eq('has_errors', true);
      }

      if (durationFilter === 'slow') {
        query = query.gte('total_duration_ms', 1000);
      } else if (durationFilter === 'fast') {
        query = query.lt('total_duration_ms', 100);
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

  // Get unique services for filter
  const uniqueServices = Array.from(
    new Set(traces.flatMap(t => t.services))
  ).sort();

  useEffect(() => {
    fetchTraces();
  }, [fetchTraces]);

  if (selectedTrace) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setSelectedTrace(null)} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          ← Back to List
        </Button>
        <TraceViewer traceId={selectedTrace} onClose={() => setSelectedTrace(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Trace List</h1>
          <p className="text-slate-400">
            View and filter distributed traces across all services
          </p>
        </div>
        <Button onClick={fetchTraces} disabled={loading} variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search traces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
              />
            </div>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
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
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="errors">Errors Only</SelectItem>
                <SelectItem value="success">Success Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={durationFilter} onValueChange={setDurationFilter}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
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
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trace List */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Recent Traces</CardTitle>
          <CardDescription className="text-slate-400">
            {traces.length} trace{traces.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 animate-pulse" />
              Loading traces...
            </div>
          ) : traces.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No traces found
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {traces.map(trace => (
                <TraceListItem
                  key={trace.trace_id}
                  trace={trace}
                  onSelect={setSelectedTrace}
                  isSelected={false}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
