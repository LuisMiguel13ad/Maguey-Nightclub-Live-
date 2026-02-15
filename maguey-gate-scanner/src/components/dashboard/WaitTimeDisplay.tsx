import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, QrCode, RefreshCw } from "lucide-react";
import { getLatestWaitTimePrediction } from "@/lib/queue-prediction-service";
import { estimateQueueDepth } from "@/lib/queue-metrics-service";
import { suggestOptimalEntryPoint, getLoadBalanceInfo } from "@/lib/queue-management-service";

interface WaitTimeDisplayProps {
  eventId: string;
  entryPointId?: string;
  showQRCode?: boolean;
  compact?: boolean;
}

export const WaitTimeDisplay = ({ 
  eventId, 
  entryPointId,
  showQRCode = true,
  compact = false 
}: WaitTimeDisplayProps) => {
  const [waitTime, setWaitTime] = useState<number | null>(null);
  const [queueDepth, setQueueDepth] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadBalanceInfo, setLoadBalanceInfo] = useState<Array<{
    entry_point_id: string;
    entry_point_name: string;
    current_wait_minutes: number;
    queue_depth: number;
    active_scanners: number;
    scans_per_minute: number;
  }>>([]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const [prediction, depth, loadInfo] = await Promise.all([
        getLatestWaitTimePrediction(eventId, entryPointId),
        estimateQueueDepth(eventId, entryPointId),
        getLoadBalanceInfo(eventId)
      ]);

      if (prediction) {
        setWaitTime(prediction.predicted_wait_minutes);
        setConfidence(prediction.confidence_score);
      } else {
        setWaitTime(0);
        setConfidence(0);
      }

      setQueueDepth(depth);
      setLoadBalanceInfo(loadInfo);
    } catch (error) {
      console.error('Error loading wait time:', error);
      setWaitTime(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);

    return () => clearInterval(interval);
  }, [eventId, entryPointId]);

  const getWaitTimeColor = (minutes: number) => {
    if (minutes <= 5) return 'text-green-500';
    if (minutes <= 10) return 'text-yellow-500';
    if (minutes <= 15) return 'text-orange-500';
    return 'text-red-500';
  };

  const getWaitTimeLabel = (minutes: number) => {
    if (minutes === 0) return 'No wait';
    if (minutes === 1) return '1 minute';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4 text-center sm:text-left">
        <div className="flex flex-1 items-center justify-center gap-2 sm:justify-start">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Estimated Wait</p>
            <p className={`text-2xl font-bold ${getWaitTimeColor(waitTime || 0)}`}>
              {isLoading ? '...' : getWaitTimeLabel(waitTime || 0)}
            </p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center gap-2 sm:justify-start">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">In Queue</p>
            <p className="text-2xl font-bold">{queueDepth}</p>
          </div>
        </div>
        {showQRCode && (
          <div className="ml-auto">
            <QrCode className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Wait Time Display */}
      <Card className="border-2">
        <CardContent className="p-5 sm:p-8">
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-6 w-6" />
              <span className="text-lg">Estimated Wait Time</span>
            </div>
            <div className={`text-4xl font-bold sm:text-6xl lg:text-7xl ${getWaitTimeColor(waitTime || 0)}`}>
              {isLoading ? (
                <RefreshCw className="h-16 w-16 animate-spin mx-auto" />
              ) : (
                getWaitTimeLabel(waitTime || 0)
              )}
            </div>
            {confidence > 0 && (
              <div className="flex items-center justify-center gap-2">
                <Badge variant="secondary">Confidence: {confidence.toFixed(0)}%</Badge>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg">{queueDepth} in queue</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Load Balance Info (if multiple entry points) */}
      {loadBalanceInfo.length > 1 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Entry Point Wait Times</h3>
            <div className="space-y-3">
              {loadBalanceInfo.map((entry) => (
                <div
                  key={entry.entry_point_id}
                  className="flex flex-col gap-2 rounded-lg bg-muted p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{entry.entry_point_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.queue_depth} in queue • {entry.active_scanners} scanners
                    </p>
                  </div>
                  <Badge 
                    variant={entry.current_wait_minutes <= 5 ? 'default' : 'secondary'}
                    className="text-lg"
                  >
                    {entry.current_wait_minutes} min
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code for Wait Time Lookup */}
      {showQRCode && (
        <Card>
          <CardContent className="p-4 text-center sm:p-6">
            <QrCode className="h-32 w-32 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Scan QR code to check wait time on your phone
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

