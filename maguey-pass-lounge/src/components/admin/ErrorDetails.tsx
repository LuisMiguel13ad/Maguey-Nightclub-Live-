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
  Clock,
  Users,
  Activity,
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
    [ErrorCategory.VALIDATION]: 'bg-blue-100 text-blue-800',
    [ErrorCategory.PAYMENT]: 'bg-red-100 text-red-800',
    [ErrorCategory.INVENTORY]: 'bg-orange-100 text-orange-800',
    [ErrorCategory.DATABASE]: 'bg-purple-100 text-purple-800',
    [ErrorCategory.NETWORK]: 'bg-yellow-100 text-yellow-800',
    [ErrorCategory.AUTHENTICATION]: 'bg-pink-100 text-pink-800',
    [ErrorCategory.AUTHORIZATION]: 'bg-indigo-100 text-indigo-800',
    [ErrorCategory.EXTERNAL_SERVICE]: 'bg-cyan-100 text-cyan-800',
    [ErrorCategory.UNKNOWN]: 'bg-gray-100 text-gray-800',
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
      const groups = await storage.getErrorGroups({ limit: 1 });
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
        <Button variant="outline" onClick={() => setSelectedTraceId(null)}>
          ← Back to Error Details
        </Button>
        <TraceViewer traceId={selectedTraceId} onClose={() => setSelectedTraceId(null)} />
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">Loading error details...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !errorGroup) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-red-600">
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
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                Error Details
              </CardTitle>
              <CardDescription>
                <code className="text-xs">{fingerprint}</code>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {errorGroup.status === 'open' && (
                <>
                  <Button variant="outline" onClick={handleResolve}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Resolve
                  </Button>
                  <Button variant="outline" onClick={handleIgnore}>
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
              <div className="text-lg font-semibold mb-2">{errorGroup.message}</div>
              <div className="flex items-center gap-2">
                <Badge className={getSeverityColor(errorGroup.severity as ErrorSeverity)}>
                  {errorGroup.severity}
                </Badge>
                <Badge variant="outline" className={getCategoryColor(errorGroup.category as ErrorCategory)}>
                  {errorGroup.category}
                </Badge>
                <Badge variant={errorGroup.status === 'open' ? 'destructive' : 'outline'}>
                  {errorGroup.status}
                </Badge>
                <Badge variant="outline">{errorGroup.service_name}</Badge>
              </div>
            </div>

            <Separator />

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Occurrences</div>
                <div className="text-2xl font-bold">{errorGroup.occurrence_count}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Affected Users</div>
                <div className="text-2xl font-bold">{errorGroup.affected_users}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">First Seen</div>
                <div className="text-sm">{formatTimestamp(errorGroup.first_seen)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Last Seen</div>
                <div className="text-sm">{formatTimestamp(errorGroup.last_seen)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Events */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Recent Events ({errorEvents.length})</TabsTrigger>
          {traceIds.length > 0 && (
            <TabsTrigger value="traces">Related Traces ({traceIds.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Occurrences</CardTitle>
              <CardDescription>
                Recent occurrences of this error
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {errorEvents.map((event, idx) => (
                  <Card key={idx} className="border-l-4 border-l-red-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium">{event.message}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {formatTimestamp(event.timestamp)}
                          </div>
                        </div>
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                      </div>
                      
                      {event.stack && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-muted-foreground">
                            Stack Trace
                          </summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                            {event.stack}
                          </pre>
                        </details>
                      )}

                      {Object.keys(event.context).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-muted-foreground">
                            Context
                          </summary>
                          <div className="mt-2 text-xs space-y-1">
                            {Object.entries(event.context).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span>{' '}
                                <span className="text-muted-foreground">
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
            <Card>
              <CardHeader>
                <CardTitle>Related Traces</CardTitle>
                <CardDescription>
                  Distributed traces associated with this error
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {traceIds.map(traceId => (
                    <Card key={traceId} className="cursor-pointer hover:shadow-md" onClick={() => setSelectedTraceId(traceId)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <code className="text-sm">{traceId}</code>
                          <Button variant="ghost" size="sm">
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
