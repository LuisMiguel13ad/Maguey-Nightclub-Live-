import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Clock, 
  Users, 
  TrendingUp, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download
} from "lucide-react";
import { 
  calculateCurrentScanVelocity, 
  estimateQueueDepth, 
  getLatestVelocityMetrics,
  getVelocityMetrics,
  startMetricsCollection 
} from "@/lib/queue-metrics-service";
import { 
  predictWaitTime, 
  getLatestWaitTimePrediction,
  getPredictionAccuracy 
} from "@/lib/queue-prediction-service";
import { 
  getStaffingRecommendation,
  getLoadBalanceInfo,
  checkScannerNeeds,
  getCapacityFillRateForecast
} from "@/lib/queue-management-service";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface QueueDashboardProps {
  eventId: string;
  entryPointId?: string;
}

export const QueueDashboard = ({ eventId, entryPointId }: QueueDashboardProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [currentVelocity, setCurrentVelocity] = useState<{
    scans_per_minute: number;
    avg_scan_duration_ms: number | null;
    active_scanners: number;
    scan_count: number;
  } | null>(null);
  const [queueDepth, setQueueDepth] = useState<number>(0);
  const [waitTimePrediction, setWaitTimePrediction] = useState<{
    predicted_wait_minutes: number;
    confidence_score: number;
    factors: any;
  } | null>(null);
  const [staffingRecommendation, setStaffingRecommendation] = useState<{
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
  const [capacityForecast, setCapacityForecast] = useState<{
    currentCapacity: number;
    forecastCapacity: number;
    fillRate: number;
    estimatedFullTime: Date | null;
  } | null>(null);
  const [velocityHistory, setVelocityHistory] = useState<Array<{
    period_start: string;
    scans_per_minute: number;
    estimated_queue_depth: number;
  }>>([]);
  const [predictionAccuracy, setPredictionAccuracy] = useState<{
    total_predictions: number;
    avg_accuracy: number;
    avg_error_minutes: number;
    predictions_within_20_percent: number;
  } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load all metrics in parallel
      const [
        velocity,
        depth,
        prediction,
        staffing,
        needs,
        forecast,
        accuracy
      ] = await Promise.all([
        calculateCurrentScanVelocity(eventId, 5, entryPointId),
        estimateQueueDepth(eventId, entryPointId),
        getLatestWaitTimePrediction(eventId, entryPointId),
        getStaffingRecommendation(eventId, entryPointId),
        checkScannerNeeds(eventId, entryPointId),
        getCapacityFillRateForecast(eventId, 2),
        getPredictionAccuracy(eventId, 30, entryPointId)
      ]);

      setCurrentVelocity(velocity);
      setQueueDepth(depth);
      
      if (prediction) {
        setWaitTimePrediction({
          predicted_wait_minutes: prediction.predicted_wait_minutes,
          confidence_score: prediction.confidence_score,
          factors: prediction.factors,
        });
      }

      setStaffingRecommendation(staffing);
      setScannerNeeds(needs);
      setCapacityForecast(forecast);
      setPredictionAccuracy(accuracy);

      // Load velocity history for chart
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 2 * 60 * 60 * 1000); // Last 2 hours
      const history = await getVelocityMetrics(eventId, startTime, endTime, entryPointId);
      setVelocityHistory(history.map(m => ({
        period_start: m.period_start,
        scans_per_minute: Number(m.scans_per_minute),
        estimated_queue_depth: m.estimated_queue_depth,
      })));

    } catch (error) {
      console.error('Error loading queue dashboard data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load queue metrics",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);

    // Start metrics collection
    cleanupRef.current = startMetricsCollection(eventId, entryPointId, 60000);

    return () => {
      clearInterval(interval);
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [eventId, entryPointId]);

  const exportMetrics = async () => {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      const metrics = await getVelocityMetrics(eventId, startTime, endTime, entryPointId);

      // Convert to CSV
      const headers = ['Period Start', 'Period End', 'Scans/Min', 'Avg Duration (ms)', 'Active Scanners', 'Queue Depth'];
      const rows = metrics.map(m => [
        m.period_start,
        m.period_end,
        m.scans_per_minute,
        m.avg_scan_duration_ms || '',
        m.active_scanners,
        m.estimated_queue_depth,
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `queue-metrics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Metrics exported successfully",
      });
    } catch (error) {
      console.error('Error exporting metrics:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export metrics",
      });
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Queue Dashboard</h2>
          <p className="text-muted-foreground">Real-time entry queue metrics and predictions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportMetrics}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {scannerNeeds?.needsMoreScanners && (
        <Alert variant={getUrgencyColor(scannerNeeds.urgency) === 'destructive' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Staffing Alert</AlertTitle>
          <AlertDescription>
            {scannerNeeds.message}. Current: {scannerNeeds.currentScanners} scanners, 
            Recommended: {scannerNeeds.recommendedScanners} scanners.
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Wait Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {waitTimePrediction?.predicted_wait_minutes || 0} min
            </div>
            <p className="text-xs text-muted-foreground">
              Confidence: {waitTimePrediction?.confidence_score.toFixed(0) || 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Depth</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueDepth}</div>
            <p className="text-xs text-muted-foreground">Tickets waiting</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scan Velocity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentVelocity?.scans_per_minute.toFixed(1) || 0}
            </div>
            <p className="text-xs text-muted-foreground">Scans per minute</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Scanners</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentVelocity?.active_scanners || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg duration: {currentVelocity?.avg_scan_duration_ms 
                ? `${(currentVelocity.avg_scan_duration_ms / 1000).toFixed(1)}s`
                : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Staffing Recommendation */}
      {staffingRecommendation && (
        <Card>
          <CardHeader>
            <CardTitle>Staffing Recommendation</CardTitle>
            <CardDescription>Dynamic staffing analysis based on current queue metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Current Scanners</span>
                <Badge variant="outline">{staffingRecommendation.current_scanners}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Recommended Scanners</span>
                <Badge variant={getUrgencyColor(staffingRecommendation.urgency)}>
                  {staffingRecommendation.recommended_scanners}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Urgency</span>
                <Badge variant={getUrgencyColor(staffingRecommendation.urgency)}>
                  {staffingRecommendation.urgency.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{staffingRecommendation.reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capacity Forecast */}
      {capacityForecast && (
        <Card>
          <CardHeader>
            <CardTitle>Capacity Forecast</CardTitle>
            <CardDescription>2-hour capacity fill rate projection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Current Capacity</span>
                <Badge>{capacityForecast.currentCapacity.toFixed(1)}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Forecast Capacity (2h)</span>
                <Badge variant="outline">{capacityForecast.forecastCapacity.toFixed(1)}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Fill Rate</span>
                <Badge variant="secondary">{capacityForecast.fillRate.toFixed(1)} scans/min</Badge>
              </div>
              {capacityForecast.estimatedFullTime && (
                <div className="flex items-center justify-between">
                  <span>Estimated Full Time</span>
                  <Badge variant="destructive">
                    {new Date(capacityForecast.estimatedFullTime).toLocaleTimeString()}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Velocity History Chart */}
      {velocityHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Velocity History</CardTitle>
            <CardDescription>Last 2 hours of scan velocity and queue depth</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={velocityHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period_start" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="scans_per_minute" 
                  stroke="#8884d8" 
                  name="Scans/Min"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="estimated_queue_depth" 
                  stroke="#82ca9d" 
                  name="Queue Depth"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Prediction Accuracy */}
      {predictionAccuracy && predictionAccuracy.total_predictions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prediction Accuracy</CardTitle>
            <CardDescription>Model performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Predictions</p>
                <p className="text-2xl font-bold">{predictionAccuracy.total_predictions}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Accuracy</p>
                <p className="text-2xl font-bold">{predictionAccuracy.avg_accuracy.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Error</p>
                <p className="text-2xl font-bold">{predictionAccuracy.avg_error_minutes.toFixed(1)} min</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Within 20%</p>
                <p className="text-2xl font-bold">
                  {predictionAccuracy.predictions_within_20_percent} / {predictionAccuracy.total_predictions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

