import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowUpRight, ArrowDownRight, Activity, RefreshCw } from 'lucide-react';
import {
  getActiveDoorCounters,
  getEntryExitFlow,
  type DoorCounter,
} from '@/lib/door-counter-service';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

interface EntryExitFlowVisualizationProps {
  eventId?: string;
}

export function EntryExitFlowVisualization({ eventId }: EntryExitFlowVisualizationProps) {
  const { toast } = useToast();
  const [counters, setCounters] = useState<DoorCounter[]>([]);
  const [selectedCounterId, setSelectedCounterId] = useState<string>('');
  const [flowData, setFlowData] = useState<Array<{
    time: string;
    entries: number;
    exits: number;
    net: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '4h' | '12h' | '24h'>('4h');

  const loadCounters = async () => {
    try {
      const activeCounters = await getActiveDoorCounters();
      setCounters(activeCounters);
      if (activeCounters.length > 0 && !selectedCounterId) {
        setSelectedCounterId(activeCounters[0].id);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading counters',
        description: error.message,
      });
    }
  };

  const loadFlowData = async () => {
    if (!selectedCounterId) return;

    setIsLoading(true);
    try {
      const endTime = new Date();
      const startTime = new Date();
      
      switch (timeRange) {
        case '1h':
          startTime.setHours(startTime.getHours() - 1);
          break;
        case '4h':
          startTime.setHours(startTime.getHours() - 4);
          break;
        case '12h':
          startTime.setHours(startTime.getHours() - 12);
          break;
        case '24h':
          startTime.setHours(startTime.getHours() - 24);
          break;
      }

      const data = await getEntryExitFlow(selectedCounterId, startTime, endTime, 15);
      setFlowData(data);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading flow data',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCounters();
  }, []);

  useEffect(() => {
    if (selectedCounterId) {
      loadFlowData();
      const interval = setInterval(loadFlowData, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [selectedCounterId, timeRange]);

  const selectedCounter = counters.find(c => c.id === selectedCounterId);

  const chartData = flowData.map(item => ({
    time: new Date(item.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    entries: item.entries,
    exits: item.exits,
    net: item.net,
  }));

  const totalEntries = flowData.reduce((sum, item) => sum + item.entries, 0);
  const totalExits = flowData.reduce((sum, item) => sum + item.exits, 0);
  const currentNet = flowData.length > 0 ? flowData[flowData.length - 1].net : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Entry/Exit Flow
            </CardTitle>
            <CardDescription>
              Real-time visualization of entry and exit patterns
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="4h">Last 4 Hours</SelectItem>
                <SelectItem value="12h">Last 12 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadFlowData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {counters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active door counters available
          </div>
        ) : (
          <div className="space-y-6">
            {/* Counter Selection */}
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Counter:</Label>
              <Select value={selectedCounterId} onValueChange={setSelectedCounterId}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {counters.map((counter) => (
                    <SelectItem key={counter.id} value={counter.id}>
                      {counter.device_name} {counter.location ? `(${counter.location})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Summary Stats */}
            {selectedCounter && (
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-muted-foreground">Total Entries</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{totalEntries}</div>
                </div>
                <div className="p-4 rounded-lg border bg-red-500/10 border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-muted-foreground">Total Exits</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{totalExits}</div>
                </div>
                <div className="p-4 rounded-lg border bg-blue-500/10 border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-muted-foreground">Net Count</span>
                  </div>
                  <div className={`text-2xl font-bold ${
                    currentNet > 0 ? 'text-blue-600' : currentNet < 0 ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    {currentNet > 0 ? '+' : ''}{currentNet}
                  </div>
                </div>
              </div>
            )}

            {/* Chart */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No flow data available for the selected time range
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Entry/Exit Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="entries" fill="hsl(142, 76%, 36%)" name="Entries" />
                    <Bar dataKey="exits" fill="hsl(0, 84%, 60%)" name="Exits" />
                  </BarChart>
                </ResponsiveContainer>

                <h3 className="text-sm font-medium">Net Flow</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="net"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Net Count"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

