/**
 * Error Details Component
 *
 * Shows detailed information about a specific error group.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ErrorStorage, ErrorGroup } from '@/lib/errors/error-storage';
import { CapturedError, ErrorSeverity, ErrorCategory } from '@/lib/errors/error-types';
import { TraceViewer } from './TraceViewer';

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatTimestamp(ts: string | Date): string {
  return new Date(ts).toLocaleString();
}

function getSeverityColor(severity: ErrorSeverity): string {
  switch (severity) {
    case ErrorSeverity.CRITICAL: return 'bg-red-600 text-white';
    case ErrorSeverity.HIGH: return 'bg-orange-500 text-white';
    case ErrorSeverity.MEDIUM: return 'bg-yellow-500 text-white';
    case ErrorSeverity.LOW: return 'bg-blue-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
}

function getCategoryColor(category: ErrorCategory): string {
  const colors: Record<ErrorCategory, string> = {
    [ErrorCategory.VALIDATION]: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    [ErrorCategory.PAYMENT]: 'bg-red-500/20 text-red-400 border-red-500/50',
    [ErrorCategory.INVENTORY]: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    [ErrorCategory.DATABASE]: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    [ErrorCategory.NETWORK]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    [ErrorCategory.AUTHENTICATION]: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
    [ErrorCategory.AUTHORIZATION]: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
    [ErrorCategory.EXTERNAL_SERVICE]: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
    [ErrorCategory.UNKNOWN]: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  };
  return colors[category] || colors[ErrorCategory.UNKNOWN];
}

// ============================================
// MAIN COMPONENT
// ============================================

interface ErrorDetailsProps {
  fingerprint: string;
}

export function ErrorDetails({ fingerprint }: ErrorDetailsProps) {
  const [errorGroup, setErrorGroup] = useState<ErrorGroup | null>(null);
  const [errorEvents, setErrorEvents] = useState<CapturedError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  const storage = new ErrorStorage(supabase);

  useEffect(() => {
    fetchErrorDetails();
  }, [fingerprint]);

  const fetchErrorDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch error group
      const groups = await storage.getErrorGroups({ limit: 100 });
      const group = groups.find(g => g.fingerprint === fingerprint);

      if (!group) {
        setError('Error group not found');
        return;
      }

      setErrorGroup(group);

      // Fetch error events
      const events = await storage.getErrorEvents(fingerprint, 50);
      setErrorEvents(events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch error details');
      console.error('Error fetching error details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!errorGroup) return;

    try {
      await storage.updateErrorGroupStatus(fingerprint, 'resolved');
      await fetchErrorDetails();
    } catch (err) {
      console.error('Error resolving error group:', err);
    }
  };

  const handleIgnore = async () => {
    if (!errorGroup) return;

    try {
      await storage.updateErrorGroupStatus(fingerprint, 'ignored');
      await fetchErrorDetails();
    } catch (err) {
      console.error('Error ignoring error group:', err);
    }
  };

  if (selectedTraceId) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setSelectedTraceId(null)} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          ← Back to Error Details
        </Button>
        <TraceViewer traceId={selectedTraceId} onClose={() => setSelectedTraceId(null)} />
      </div>
    );
  }

  if (loading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-8 text-center">
          <div className="text-slate-400">Loading error details...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !errorGroup) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-8">
          <div className="text-red-400">
            {error || 'Error group not found'}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get unique trace IDs from events
  const traceIds = Array.from(
    new Set(
      errorEvents
        .map(e => e.context.traceId)
        .filter((id): id is string => typeof id === 'string')
    )
  );

  return (
    <div className="space-y-6">
      {/* Error Group Header */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                Error Details
              </CardTitle>
              <CardDescription className="text-slate-400">
                <code className="text-xs">{fingerprint}</code>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {errorGroup.status === 'open' && (
                <>
                  <Button variant="outline" onClick={handleResolve} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Resolve
                  </Button>
                  <Button variant="outline" onClick={handleIgnore} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                    <XCircle className="w-4 h-4 mr-2" />
                    Ignore
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Error Message */}
            <div>
              <div className="text-lg font-semibold mb-2 text-white">{errorGroup.message}</div>
              <div className="flex items-center gap-2">
                <Badge className={getSeverityColor(errorGroup.severity as ErrorSeverity)}>
                  {errorGroup.severity}
                </Badge>
                <Badge variant="outline" className={getCategoryColor(errorGroup.category as ErrorCategory)}>
                  {errorGroup.category}
                </Badge>
                <Badge variant={errorGroup.status === 'open' ? 'destructive' : 'outline'} className={errorGroup.status === 'open' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'border-white/10 text-slate-300'}>
                  {errorGroup.status}
                </Badge>
                <Badge variant="outline" className="border-white/10 text-slate-300">{errorGroup.service_name}</Badge>
              </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-slate-400">Occurrences</div>
                <div className="text-2xl font-bold text-white">{errorGroup.occurrence_count}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Affected Users</div>
                <div className="text-2xl font-bold text-white">{errorGroup.affected_users}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">First Seen</div>
                <div className="text-sm text-white">{formatTimestamp(errorGroup.first_seen)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Last Seen</div>
                <div className="text-sm text-white">{formatTimestamp(errorGroup.last_seen)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Events */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList className="bg-white/5 border-white/10">
          <TabsTrigger value="events" className="data-[state=active]:bg-white/10">Recent Events ({errorEvents.length})</TabsTrigger>
          {traceIds.length > 0 && (
            <TabsTrigger value="traces" className="data-[state=active]:bg-white/10">Related Traces ({traceIds.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Error Occurrences</CardTitle>
              <CardDescription className="text-slate-400">
                Recent occurrences of this error
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {errorEvents.map((event, idx) => (
                  <Card key={idx} className="border-l-4 border-l-red-500 bg-white/5 border-white/10">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-white">{event.message}</div>
                          <div className="text-sm text-slate-400 mt-1">
                            {formatTimestamp(event.timestamp)}
                          </div>
                        </div>
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                      </div>

                      {event.stack && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300">
                            Stack Trace
                          </summary>
                          <pre className="mt-2 text-xs bg-black/50 p-2 rounded overflow-auto max-h-64 text-slate-300">
                            {event.stack}
                          </pre>
                        </details>
                      )}

                      {Object.keys(event.context).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300">
                            Context
                          </summary>
                          <div className="mt-2 text-xs space-y-1">
                            {Object.entries(event.context).map(([key, value]) => (
                              <div key={key} className="text-slate-400">
                                <span className="font-medium text-slate-300">{key}:</span>{' '}
                                <span>
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {event.context.traceId && (
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedTraceId(event.context.traceId as string)}
                            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                          >
                            <ExternalLink className="w-3 h-3 mr-2" />
                            View Trace
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {traceIds.length > 0 && (
          <TabsContent value="traces" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Related Traces</CardTitle>
                <CardDescription className="text-slate-400">
                  Distributed traces associated with this error
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {traceIds.map(traceId => (
                    <Card key={traceId} className="cursor-pointer hover:shadow-md bg-white/5 border-white/10" onClick={() => setSelectedTraceId(traceId)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <code className="text-sm text-slate-300">{traceId}</code>
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
