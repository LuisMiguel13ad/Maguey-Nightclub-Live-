import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole, useAuth } from '@/contexts/AuthContext';
import OwnerPortalLayout from '@/components/layout/OwnerPortalLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  DoorOpen,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
} from 'lucide-react';
import {
  getAllDoorCounters,
  getActiveDoorCounters,
  createDoorCounter,
  updateDoorCounter,
  deleteDoorCounter,
  getCounterHealthStatus,
  calibrateCounter,
  type DoorCounter,
  type CounterHealthStatus,
} from '@/lib/door-counter-service';
import { formatDistanceToNow } from 'date-fns';

const DoorCounterManagement = () => {
  const navigate = useNavigate();
  const role = useRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [counters, setCounters] = useState<DoorCounter[]>([]);
  const [healthStatuses, setHealthStatuses] = useState<Record<string, CounterHealthStatus>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCounter, setSelectedCounter] = useState<DoorCounter | null>(null);
  const [formData, setFormData] = useState({
    device_id: '',
    device_name: '',
    device_type: 'wifi' as 'ir_beam' | 'thermal' | 'wifi' | 'bluetooth',
    location: '',
    api_endpoint: '',
    api_key: '',
    is_active: true,
  });

  // Redirect non-owners
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Door counter management is only available to owners.',
      });
      navigate('/scanner');
    }
  }, [role, navigate, toast]);

  const loadCounters = async () => {
    setIsLoading(true);
    try {
      const allCounters = await getAllDoorCounters();
      setCounters(allCounters);

      // Load health statuses for all counters
      const healthPromises = allCounters.map(async (counter) => {
        const health = await getCounterHealthStatus(counter.id);
        return { [counter.id]: health };
      });
      const healthResults = await Promise.all(healthPromises);
      const healthMap = Object.assign({}, ...healthResults.filter(h => h !== null));
      setHealthStatuses(healthMap as Record<string, CounterHealthStatus>);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading counters',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'owner') {
      loadCounters();
      const interval = setInterval(loadCounters, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [role]);

  const handleOpenDialog = (counter?: DoorCounter) => {
    if (counter) {
      setIsEditMode(true);
      setSelectedCounter(counter);
      setFormData({
        device_id: counter.device_id,
        device_name: counter.device_name,
        device_type: counter.device_type,
        location: counter.location || '',
        api_endpoint: counter.api_endpoint || '',
        api_key: counter.api_key || '',
        is_active: counter.is_active,
      });
    } else {
      setIsEditMode(false);
      setSelectedCounter(null);
      setFormData({
        device_id: '',
        device_name: '',
        device_type: 'wifi',
        location: '',
        api_endpoint: '',
        api_key: '',
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (isEditMode && selectedCounter) {
        await updateDoorCounter(selectedCounter.id, formData);
        toast({
          title: 'Counter updated',
          description: 'Door counter has been updated successfully.',
        });
      } else {
        await createDoorCounter(formData);
        toast({
          title: 'Counter created',
          description: 'Door counter has been registered successfully.',
        });
      }
      setIsDialogOpen(false);
      loadCounters();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const handleDelete = async (counter: DoorCounter) => {
    if (!confirm(`Are you sure you want to delete "${counter.device_name}"?`)) {
      return;
    }

    try {
      await deleteDoorCounter(counter.id);
      toast({
        title: 'Counter deleted',
        description: 'Door counter has been removed.',
      });
      loadCounters();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const handleCalibrate = async (counter: DoorCounter) => {
    if (!confirm(`Reset counter "${counter.device_name}" to zero?`)) {
      return;
    }

    try {
      await calibrateCounter(counter.id);
      toast({
        title: 'Counter calibrated',
        description: 'Counter has been reset to zero.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const getHealthBadge = (counter: DoorCounter) => {
    const health = healthStatuses[counter.id];
    if (!health) {
      return <Badge variant="secondary">Unknown</Badge>;
    }

    switch (health.health_status) {
      case 'healthy':
        return <Badge className="bg-green-500">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getDeviceTypeIcon = (type: string) => {
    switch (type) {
      case 'wifi':
      case 'bluetooth':
        return <Wifi className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (role !== 'owner') {
    return null;
  }

  if (isLoading) {
    return (
      <OwnerPortalLayout title="Door Counter Management">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading door counters...</p>
            </div>
          </div>
      </OwnerPortalLayout>
    );
  }

  const headerActions = (
          <div className="flex gap-2">
            <Button onClick={loadCounters} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Counter
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {isEditMode ? 'Edit Door Counter' : 'Register New Door Counter'}
                  </DialogTitle>
                  <DialogDescription>
                    Configure a physical door counter device for entry/exit tracking.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="device_id">Device ID *</Label>
                    <Input
                      id="device_id"
                      value={formData.device_id}
                      onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                      placeholder="e.g., COUNTER-001"
                      disabled={isEditMode}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="device_name">Device Name *</Label>
                    <Input
                      id="device_name"
                      value={formData.device_name}
                      onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                      placeholder="e.g., Main Entrance Counter"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="device_type">Device Type *</Label>
                    <Select
                      value={formData.device_type}
                      onValueChange={(value: any) => setFormData({ ...formData, device_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ir_beam">IR Beam Counter</SelectItem>
                        <SelectItem value="thermal">Thermal Sensor</SelectItem>
                        <SelectItem value="wifi">WiFi Counter</SelectItem>
                        <SelectItem value="bluetooth">Bluetooth Counter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g., Main Entrance, Side Door"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="api_endpoint">API Endpoint</Label>
                    <Input
                      id="api_endpoint"
                      value={formData.api_endpoint}
                      onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                      placeholder="https://api.example.com/counter"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="api_key">API Key</Label>
                    <Input
                      id="api_key"
                      type="password"
                      value={formData.api_key}
                      onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                      placeholder="API authentication key"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit}>
                    {isEditMode ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
  );

  return (
    <OwnerPortalLayout
      title="Door Counter Management"
      description="Register and manage physical door counter devices"
      actions={headerActions}
    >

        {/* Counters Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5" />
              Registered Counters ({counters.length})
            </CardTitle>
            <CardDescription>
              Manage physical door counter devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {counters.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No door counters registered. Click "Add Counter" to register a device.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Last Heartbeat</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {counters.map((counter) => {
                      const health = healthStatuses[counter.id];
                      return (
                        <TableRow key={counter.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{counter.device_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {counter.device_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getDeviceTypeIcon(counter.device_type)}
                              <span className="capitalize">{counter.device_type.replace('_', ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {counter.location || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={counter.is_active ? 'default' : 'secondary'}>
                              {counter.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getHealthBadge(counter)}
                            {health && health.minutes_since_heartbeat !== null && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {health.minutes_since_heartbeat}m ago
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {counter.last_heartbeat ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(counter.last_heartbeat), { addSuffix: true })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDialog(counter)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCalibrate(counter)}
                                title="Calibrate/Reset"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(counter)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
    </OwnerPortalLayout>
  );
};

export default DoorCounterManagement;

