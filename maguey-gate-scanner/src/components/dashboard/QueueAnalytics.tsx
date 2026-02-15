import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  Download,
  Calendar,
  RefreshCw
} from "lucide-react";
import { 
  getVelocityMetrics,
  getHistoricalVelocityPatterns 
} from "@/lib/queue-metrics-service";
import { 
  getPredictionAccuracy 
} from "@/lib/queue-prediction-service";
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { useToast } from "@/hooks/use-toast";

interface QueueAnalyticsProps {
  eventId: string;
  entryPointId?: string;
  daysBack?: number;
}

export const QueueAnalytics = ({ 
  eventId, 
  entryPointId,
  daysBack = 7 
}: QueueAnalyticsProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [velocityHistory, setVelocityHistory] = useState<Array<{
    period_start: string;
    scans_per_minute: number;
    estimated_queue_depth: number;
    active_scanners: number;
  }>>([]);
  const [historicalPatterns, setHistoricalPatterns] = useState<Array<{
    hour_of_day: number;
    day_of_week: number;
    avg_scans_per_minute: number;
    avg_queue_depth: number;
    sample_count: number;
  }>>([]);
  const [predictionAccuracy, setPredictionAccuracy] = useState<{
    total_predictions: number;
    avg_accuracy: number;
    avg_error_minutes: number;
    predictions_within_20_percent: number;
  } | null>(null);
  const [selectedDays, setSelectedDays] = useState(daysBack);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - selectedDays * 24 * 60 * 60 * 1000);

      const [velocity, patterns, accuracy] = await Promise.all([
        getVelocityMetrics(eventId, startTime, endTime, entryPointId),
        getHistoricalVelocityPatterns(eventId, 30, entryPointId),
        getPredictionAccuracy(eventId, selectedDays, entryPointId)
      ]);

      setVelocityHistory(velocity.map(m => ({
        period_start: m.period_start,
        scans_per_minute: Number(m.scans_per_minute),
        estimated_queue_depth: m.estimated_queue_depth,
        active_scanners: m.active_scanners,
      })));

      setHistoricalPatterns(patterns);
      setPredictionAccuracy(accuracy);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load analytics data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId, entryPointId, selectedDays]);

  const exportData = async () => {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - selectedDays * 24 * 60 * 60 * 1000);
      const metrics = await getVelocityMetrics(eventId, startTime, endTime, entryPointId);

      // Convert to CSV
      const headers = [
        'Period Start',
        'Period End',
        'Scans/Min',
        'Avg Duration (ms)',
        'Active Scanners',
        'Queue Depth'
      ];
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
      a.download = `queue-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Analytics data exported successfully",
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export data",
      });
    }
  };

  // Group historical patterns by hour
  const patternsByHour = historicalPatterns.reduce((acc, pattern) => {
    const hour = pattern.hour_of_day;
    if (!acc[hour]) {
      acc[hour] = {
        hour,
        avg_scans_per_minute: 0,
        avg_queue_depth: 0,
        sample_count: 0,
      };
    }
    acc[hour].avg_scans_per_minute += pattern.avg_scans_per_minute;
    acc[hour].avg_queue_depth += pattern.avg_queue_depth;
    acc[hour].sample_count += pattern.sample_count;
    return acc;
  }, {} as Record<number, {
    hour: number;
    avg_scans_per_minute: number;
    avg_queue_depth: number;
    sample_count: number;
  }>);

  const patternsChartData = Object.values(patternsByHour)
    .map(p => ({
      hour: `${p.hour}:00`,
      scans_per_minute: p.avg_scans_per_minute / Math.max(1, p.sample_count),
      queue_depth: p.avg_queue_depth / Math.max(1, p.sample_count),
    }))
    .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

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
          <h3 className="text-lg font-semibold">Queue Analytics</h3>
          <p className="text-sm text-muted-foreground">Historical analysis and patterns</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1">
            {[1, 7, 30].map((days) => (
              <Button
                key={days}
                variant={selectedDays === days ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDays(days)}
              >
                {days}d
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Prediction Accuracy */}
      {predictionAccuracy && predictionAccuracy.total_predictions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prediction Accuracy</CardTitle>
            <CardDescription>Model performance over the last {selectedDays} days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Predictions</p>
                <p className="text-3xl font-bold">{predictionAccuracy.total_predictions}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Avg Accuracy</p>
                <p className="text-3xl font-bold">{predictionAccuracy.avg_accuracy.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Avg Error</p>
                <p className="text-3xl font-bold">{predictionAccuracy.avg_error_minutes.toFixed(1)} min</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Within 20%</p>
                <p className="text-3xl font-bold">
                  {predictionAccuracy.predictions_within_20_percent}
                </p>
                <p className="text-xs text-muted-foreground">
                  of {predictionAccuracy.total_predictions} predictions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Velocity Over Time */}
      {velocityHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Velocity Over Time</CardTitle>
            <CardDescription>Last {selectedDays} days of scan velocity and queue depth</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={velocityHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period_start" 
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
                  }}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="scans_per_minute" 
                  stroke="#8884d8" 
                  name="Scans/Min"
                  strokeWidth={2}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="estimated_queue_depth" 
                  stroke="#82ca9d" 
                  name="Queue Depth"
                  strokeWidth={2}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="active_scanners" 
                  stroke="#ffc658" 
                  name="Active Scanners"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Historical Patterns */}
      {patternsChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Patterns by Hour</CardTitle>
            <CardDescription>Average scan velocity and queue depth by hour of day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={patternsChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="scans_per_minute" fill="#8884d8" name="Scans/Min" />
                <Bar yAxisId="right" dataKey="queue_depth" fill="#82ca9d" name="Queue Depth" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {velocityHistory.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Peak Scan Velocity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {Math.max(...velocityHistory.map(v => v.scans_per_minute)).toFixed(1)}
                </p>
                <span className="text-sm text-muted-foreground">scans/min</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Average Scan Velocity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {(
                    velocityHistory.reduce((sum, v) => sum + v.scans_per_minute, 0) /
                    velocityHistory.length
                  ).toFixed(1)}
                </p>
                <span className="text-sm text-muted-foreground">scans/min</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Peak Queue Depth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {Math.max(...velocityHistory.map(v => v.estimated_queue_depth))}
                </p>
                <span className="text-sm text-muted-foreground">tickets</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

