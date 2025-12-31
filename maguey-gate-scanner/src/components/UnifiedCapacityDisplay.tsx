import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Activity,
} from 'lucide-react';
import {
  getUnifiedCapacity,
  detectDiscrepancy,
  type UnifiedCapacity,
} from '@/lib/door-counter-service';
import { supabase } from '@/integrations/supabase/client';

interface UnifiedCapacityDisplayProps {
  eventId: string;
  eventName?: string;
  refreshInterval?: number; // in milliseconds
}

export function UnifiedCapacityDisplay({
  eventId,
  eventName,
  refreshInterval = 30000, // 30 seconds default
}: UnifiedCapacityDisplayProps) {
  const { toast } = useToast();
  const [capacity, setCapacity] = useState<UnifiedCapacity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadCapacity = async () => {
    try {
      const data = await getUnifiedCapacity(eventId);
      setCapacity(data);
    } catch (error: any) {
      console.error('Error loading unified capacity:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load capacity data',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCapacity();
  };

  const handleDetectDiscrepancy = async () => {
    try {
      const discrepancyId = await detectDiscrepancy(eventId, 5);
      if (discrepancyId) {
        toast({
          title: 'Discrepancy Detected',
          description: 'A discrepancy has been logged for investigation.',
        });
      } else {
        toast({
          title: 'No Discrepancy',
          description: 'Physical and digital counts are within acceptable range.',
        });
      }
      await loadCapacity();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  useEffect(() => {
    loadCapacity();

    // Set up auto-refresh
    const interval = setInterval(loadCapacity, refreshInterval);
    return () => clearInterval(interval);
  }, [eventId, refreshInterval]);

  // Subscribe to real-time updates
  useEffect(() => {
    const physicalCountsSubscription = supabase
      .channel('physical_counts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'physical_counts',
        },
        () => {
          loadCapacity();
        }
      )
      .subscribe();

    const ticketsSubscription = supabase
      .channel('tickets_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: 'is_used=eq.true',
        },
        () => {
          loadCapacity();
        }
      )
      .subscribe();

    return () => {
      physicalCountsSubscription.unsubscribe();
      ticketsSubscription.unsubscribe();
    };
  }, [eventId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Unified Capacity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!capacity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Unified Capacity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No capacity data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const discrepancyAbs = Math.abs(capacity.discrepancy);
  const hasDiscrepancy = discrepancyAbs >= 5; // Threshold of 5

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Unified Capacity
            </CardTitle>
            <CardDescription>
              {eventName || capacity.event_name} - Combined physical + digital count
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDetectDiscrepancy}
            >
              <Activity className="h-4 w-4 mr-2" />
              Check Discrepancy
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Main Unified Count */}
          <div className="text-center">
            <div className="text-5xl font-bold text-primary mb-2">
              {capacity.unified_count}
            </div>
            <p className="text-muted-foreground">Total Occupancy</p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-muted-foreground">Physical</span>
              </div>
              <div className="text-2xl font-bold">{capacity.physical_count}</div>
              {capacity.last_physical_update && (
                <p className="text-xs text-muted-foreground mt-1">
                  Updated {new Date(capacity.last_physical_update).toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="p-4 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-muted-foreground">Digital</span>
              </div>
              <div className="text-2xl font-bold">{capacity.digital_count}</div>
              {capacity.last_digital_update && (
                <p className="text-xs text-muted-foreground mt-1">
                  Updated {new Date(capacity.last_digital_update).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* Discrepancy Alert */}
          {hasDiscrepancy && (
            <div className={`p-4 rounded-lg border ${
              capacity.discrepancy > 0
                ? 'border-yellow-500/50 bg-yellow-500/10'
                : 'border-red-500/50 bg-red-500/10'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`h-5 w-5 ${
                  capacity.discrepancy > 0 ? 'text-yellow-500' : 'text-red-500'
                }`} />
                <span className="font-semibold">Discrepancy Detected</span>
              </div>
              <div className="flex items-center gap-2">
                {capacity.discrepancy > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-yellow-500" />
                    <span>
                      Physical count is <strong>{discrepancyAbs} higher</strong> than digital scans.
                      Possible walk-ins or scanner issues.
                    </span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span>
                      Digital scans are <strong>{discrepancyAbs} higher</strong> than physical count.
                      Possible duplicate scans or counter issues.
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Status Badge */}
          {!hasDiscrepancy && discrepancyAbs > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Counts are within acceptable range ({discrepancyAbs} difference)</span>
            </div>
          )}

          {discrepancyAbs === 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Perfect match between physical and digital counts</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

