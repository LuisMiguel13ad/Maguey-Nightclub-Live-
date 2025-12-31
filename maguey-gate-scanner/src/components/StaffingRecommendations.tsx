import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  Clock,
  RefreshCw,
  Bell,
  BellOff
} from "lucide-react";
import { 
  getStaffingRecommendation,
  checkScannerNeeds,
  getLoadBalanceInfo
} from "@/lib/queue-management-service";
import { useToast } from "@/hooks/use-toast";

interface StaffingRecommendationsProps {
  eventId: string;
  entryPointId?: string;
  autoRefresh?: boolean;
  onAlert?: (alert: {
    needsMoreScanners: boolean;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }) => void;
}

export const StaffingRecommendations = ({ 
  eventId, 
  entryPointId,
  autoRefresh = true,
  onAlert
}: StaffingRecommendationsProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<{
    current_scanners: number;
    recommended_scanners: number;
    reason: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    estimated_wait_time: number;
    queue_depth: number;
  } | null>(null);
  const [scannerNeeds, setScannerNeeds] = useState<{
    needsMoreScanners: boolean;
    currentScanners: number;
    recommendedScanners: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  } | null>(null);
  const [loadBalanceInfo, setLoadBalanceInfo] = useState<Array<{
    entry_point_id: string;
    entry_point_name: string;
    current_wait_minutes: number;
    queue_depth: number;
    active_scanners: number;
    scans_per_minute: number;
  }>>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const [rec, needs, loadInfo] = await Promise.all([
        getStaffingRecommendation(eventId, entryPointId),
        checkScannerNeeds(eventId, entryPointId),
        getLoadBalanceInfo(eventId)
      ]);

      setRecommendation(rec);
      setScannerNeeds(needs);
      setLoadBalanceInfo(loadInfo);

      // Trigger alert callback if needed
      if (needs && needs.needsMoreScanners && alertsEnabled && onAlert) {
        onAlert({
          needsMoreScanners: needs.needsMoreScanners,
          urgency: needs.urgency,
          message: needs.message,
        });
      }
    } catch (error) {
      console.error('Error loading staffing recommendations:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load staffing recommendations",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (autoRefresh) {
      const interval = setInterval(loadData, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [eventId, entryPointId, autoRefresh]);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <CheckCircle2 className="h-5 w-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Staffing Recommendations</h3>
          <p className="text-sm text-muted-foreground">Dynamic staffing analysis</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAlertsEnabled(!alertsEnabled)}
          >
            {alertsEnabled ? (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Alerts On
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4 mr-2" />
                Alerts Off
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alert */}
      {scannerNeeds?.needsMoreScanners && (
        <Alert variant={getUrgencyColor(scannerNeeds.urgency) === 'destructive' ? 'destructive' : 'default'}>
          {getUrgencyIcon(scannerNeeds.urgency)}
          <AlertTitle>Additional Scanners Needed</AlertTitle>
          <AlertDescription>
            {scannerNeeds.message}
            <div className="mt-2 flex gap-2">
              <Badge variant="outline">
                Current: {scannerNeeds.currentScanners}
              </Badge>
              <Badge variant={getUrgencyColor(scannerNeeds.urgency)}>
                Recommended: {scannerNeeds.recommendedScanners}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Recommendation Card */}
      {recommendation && (
        <Card>
          <CardHeader>
            <CardTitle>Current Recommendation</CardTitle>
            <CardDescription>Based on real-time queue metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Scanners</p>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-2xl font-bold">{recommendation.current_scanners}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Recommended</p>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <Badge 
                      variant={getUrgencyColor(recommendation.urgency)}
                      className="text-lg"
                    >
                      {recommendation.recommended_scanners}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Urgency Level</span>
                <Badge variant={getUrgencyColor(recommendation.urgency)}>
                  {recommendation.urgency.toUpperCase()}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Estimated Wait</span>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-bold">{recommendation.estimated_wait_time} min</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Queue Depth</span>
                <span className="font-bold">{recommendation.queue_depth} tickets</span>
              </div>

              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Load Balance Info */}
      {loadBalanceInfo.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Entry Point Load Balance</CardTitle>
            <CardDescription>Wait times across all entry points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {loadBalanceInfo.map((entry) => (
                <div
                  key={entry.entry_point_id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <p className="font-medium">{entry.entry_point_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.active_scanners} scanners • {entry.scans_per_minute.toFixed(1)} scans/min
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={entry.current_wait_minutes <= 5 ? 'default' : 'secondary'}>
                      {entry.current_wait_minutes} min
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.queue_depth} in queue
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

