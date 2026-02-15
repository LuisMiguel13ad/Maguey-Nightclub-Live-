import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/contexts/AuthContext';
import OwnerPortalLayout from '@/components/layout/OwnerPortalLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Smartphone,
  Battery,
  BatteryLow,
  BatteryWarning,
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw,
  Zap,
  Clock,
  TrendingDown,
  Plus,
} from 'lucide-react';
import {
  getAllDevices,
  getDevicesWithLowBattery,
  getOfflineDevices,
  getDeviceHealthStatus,
  type ScannerDevice,
  type DeviceHealthStatus,
} from '@/lib/device-management-service';
import { formatDistanceToNow } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getBatteryHistory } from '@/lib/battery-monitoring-service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DeviceManagement = () => {
  const navigate = useNavigate();
  const role = useRole();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [devices, setDevices] = useState<ScannerDevice[]>([]);
  const [lowBatteryDevices, setLowBatteryDevices] = useState<ScannerDevice[]>([]);
  const [offlineDevices, setOfflineDevices] = useState<Array<{ device: ScannerDevice; minutesOffline: number }>>([]);
  const [selectedDevice, setSelectedDevice] = useState<ScannerDevice | null>(null);
  const [batteryHistory, setBatteryHistory] = useState<Array<{ timestamp: string; batteryLevel: number; isCharging: boolean }>>([]);
  const [addDeviceDialogOpen, setAddDeviceDialogOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({
    deviceId: '',
    deviceName: '',
    deviceModel: '',
    osVersion: '',
    appVersion: '',
    batteryLevel: '',
    isCharging: false,
    isOnline: true,
    networkType: 'wifi',
  });
  const [addingDevice, setAddingDevice] = useState(false);

  // Redirect non-owners
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Device management is only available to owners.',
      });
      navigate('/scanner');
    }
  }, [role, navigate, toast]);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const [allDevices, lowBattery, offline] = await Promise.all([
        getAllDevices(),
        getDevicesWithLowBattery(20),
        getOfflineDevices(30),
      ]);

      setDevices(allDevices);
      setLowBatteryDevices(lowBattery);
      setOfflineDevices(offline);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading devices',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'owner') {
      loadDevices();
      const interval = setInterval(loadDevices, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [role]);

  const loadBatteryHistory = async (device: ScannerDevice) => {
    try {
      // Load battery history for the selected device using its UUID
      const history = await getBatteryHistory(24, device.id);
      setBatteryHistory(history);
    } catch (error: any) {
      console.error('Error loading battery history:', error);
    }
  };

  const getBatteryIcon = (level: number | null, isCharging: boolean) => {
    if (level === null) return <Battery className="h-4 w-4 text-muted-foreground" />;
    if (isCharging) return <Zap className="h-4 w-4 text-green-500" />;
    if (level <= 5) return <BatteryWarning className="h-4 w-4 text-red-500" />;
    if (level <= 20) return <BatteryLow className="h-4 w-4 text-yellow-500" />;
    return <Battery className="h-4 w-4 text-green-500" />;
  };

  const getBatteryColor = (level: number | null) => {
    if (level === null) return 'text-muted-foreground';
    if (level <= 5) return 'text-red-500';
    if (level <= 20) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getHealthBadge = (health: DeviceHealthStatus) => {
    switch (health.status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-500">Healthy</Badge>;
      case 'low_battery':
        return <Badge variant="default" className="bg-yellow-500">Low Battery</Badge>;
      case 'critical_battery':
        return <Badge variant="destructive">Critical</Badge>;
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (role !== 'owner') {
    return null;
  }

  if (isLoading) {
    return (
      <OwnerPortalLayout title="Device Management">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading devices...</p>
            </div>
          </div>
      </OwnerPortalLayout>
    );
  }

  const chartData = batteryHistory.map((log) => ({
    time: new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    battery: log.batteryLevel,
    charging: log.isCharging ? log.batteryLevel : null,
  }));

  const headerActions = (
          <div className="flex gap-2">
            <Button onClick={() => setAddDeviceDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </Button>
          <Button onClick={loadDevices} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          </div>
  );

  return (
    <OwnerPortalLayout
      title="Device Management"
      description="Monitor and manage all scanner devices"
      actions={headerActions}
    >

        {/* Alerts */}
        {(lowBatteryDevices.length > 0 || offlineDevices.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {lowBatteryDevices.length > 0 && (
              <Card className="border-yellow-500/20 bg-yellow-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-600">
                    <BatteryWarning className="h-4 w-4" />
                    Low Battery Devices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">{lowBatteryDevices.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Devices with battery below 20%
                  </p>
                </CardContent>
              </Card>
            )}

            {offlineDevices.length > 0 && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
                    <WifiOff className="h-4 w-4" />
                    Offline Devices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{offlineDevices.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Devices offline for more than 30 minutes
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Battery History Chart */}
        {selectedDevice && batteryHistory.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Battery History - {selectedDevice.deviceName || selectedDevice.deviceId}</CardTitle>
              <CardDescription>Last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} label={{ value: 'Battery %', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, 'Battery']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="battery"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Battery Level"
                  />
                  {chartData.some((d) => d.charging !== null) && (
                    <Line
                      type="monotone"
                      dataKey="charging"
                      stroke="hsl(var(--green-500))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Charging"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Devices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              All Devices ({devices.length})
            </CardTitle>
            <CardDescription>
              View and monitor all scanner devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No devices found. Devices will appear here once they connect.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Battery</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => {
                      const health = getDeviceHealthStatus(device);
                      return (
                        <TableRow key={device.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">
                                {device.deviceName || device.deviceId}
                              </div>
                              {device.deviceModel && (
                                <div className="text-xs text-muted-foreground">
                                  {device.deviceModel}
                                </div>
                              )}
                              {device.osVersion && (
                                <div className="text-xs text-muted-foreground">
                                  {device.osVersion}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getBatteryIcon(device.batteryLevel, device.isCharging)}
                              <span className={`font-medium ${getBatteryColor(device.batteryLevel)}`}>
                                {device.batteryLevel !== null ? `${device.batteryLevel}%` : 'N/A'}
                              </span>
                              {device.isCharging && (
                                <Badge variant="default" className="text-xs bg-green-500">
                                  Charging
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={device.isOnline ? 'default' : 'destructive'}>
                              {device.isOnline ? 'Online' : 'Offline'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {device.isOnline ? (
                                <Wifi className="h-4 w-4 text-green-500" />
                              ) : (
                                <WifiOff className="h-4 w-4 text-red-500" />
                              )}
                              <span className="text-sm">
                                {device.networkType?.toUpperCase() || 'Unknown'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                            </div>
                          </TableCell>
                          <TableCell>{getHealthBadge(health)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedDevice(device);
                                loadBatteryHistory(device);
                              }}
                            >
                              <TrendingDown className="h-4 w-4" />
                            </Button>
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

        {/* Add Device Dialog */}
        <Dialog open={addDeviceDialogOpen} onOpenChange={setAddDeviceDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
              <DialogDescription>
                Manually add a scanner device to the system. The device will appear in the device list once added.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="deviceId">Device ID *</Label>
                <Input
                  id="deviceId"
                  placeholder="e.g., SCANNER-001"
                  value={newDevice.deviceId}
                  onChange={(e) => setNewDevice({ ...newDevice, deviceId: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier for this device (required)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deviceName">Device Name</Label>
                <Input
                  id="deviceName"
                  placeholder="e.g., Main Entrance Scanner"
                  value={newDevice.deviceName}
                  onChange={(e) => setNewDevice({ ...newDevice, deviceName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deviceModel">Device Model</Label>
                  <Input
                    id="deviceModel"
                    placeholder="e.g., iPhone 14 Pro"
                    value={newDevice.deviceModel}
                    onChange={(e) => setNewDevice({ ...newDevice, deviceModel: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="osVersion">OS Version</Label>
                  <Input
                    id="osVersion"
                    placeholder="e.g., iOS 17.0"
                    value={newDevice.osVersion}
                    onChange={(e) => setNewDevice({ ...newDevice, osVersion: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appVersion">App Version</Label>
                <Input
                  id="appVersion"
                  placeholder="e.g., 1.0.0"
                  value={newDevice.appVersion}
                  onChange={(e) => setNewDevice({ ...newDevice, appVersion: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batteryLevel">Battery Level (%)</Label>
                  <Input
                    id="batteryLevel"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g., 85"
                    value={newDevice.batteryLevel}
                    onChange={(e) => setNewDevice({ ...newDevice, batteryLevel: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="networkType">Network Type</Label>
                  <Select
                    value={newDevice.networkType}
                    onValueChange={(value) => setNewDevice({ ...newDevice, networkType: value })}
                  >
                    <SelectTrigger id="networkType">
                      <SelectValue placeholder="Select network type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wifi">WiFi</SelectItem>
                      <SelectItem value="cellular">Cellular</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="isCharging">Charging</Label>
                  <p className="text-xs text-muted-foreground">
                    Is the device currently charging?
                  </p>
                </div>
                <Switch
                  id="isCharging"
                  checked={newDevice.isCharging}
                  onCheckedChange={(checked) => setNewDevice({ ...newDevice, isCharging: checked })}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="isOnline">Online Status</Label>
                  <p className="text-xs text-muted-foreground">
                    Is the device currently online?
                  </p>
                </div>
                <Switch
                  id="isOnline"
                  checked={newDevice.isOnline}
                  onCheckedChange={(checked) => setNewDevice({ ...newDevice, isOnline: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAddDeviceDialogOpen(false);
                  setNewDevice({
                    deviceId: '',
                    deviceName: '',
                    deviceModel: '',
                    osVersion: '',
                    appVersion: '',
                    batteryLevel: '',
                    isCharging: false,
                    isOnline: true,
                    networkType: 'wifi',
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!newDevice.deviceId.trim()) {
                    toast({
                      variant: 'destructive',
                      title: 'Device ID Required',
                      description: 'Please enter a device ID.',
                    });
                    return;
                  }

                  setAddingDevice(true);
                  try {
                    const { data, error } = await supabase
                      .from('scanner_devices')
                      .insert({
                        device_id: newDevice.deviceId.trim(),
                        device_name: newDevice.deviceName.trim() || null,
                        device_model: newDevice.deviceModel.trim() || null,
                        os_version: newDevice.osVersion.trim() || null,
                        app_version: newDevice.appVersion.trim() || null,
                        battery_level: newDevice.batteryLevel ? parseInt(newDevice.batteryLevel) : null,
                        is_charging: newDevice.isCharging,
                        is_online: newDevice.isOnline,
                        network_type: newDevice.networkType || null,
                        last_seen: new Date().toISOString(),
                      })
                      .select()
                      .single();

                    if (error) {
                      if (error.code === '23505') {
                        // Unique constraint violation
                        toast({
                          variant: 'destructive',
                          title: 'Device Already Exists',
                          description: 'A device with this ID already exists.',
                        });
                      } else {
                        throw error;
                      }
                      return;
                    }

                    toast({
                      title: 'Device Added',
                      description: `Device "${newDevice.deviceName || newDevice.deviceId}" has been added successfully.`,
                    });

                    setAddDeviceDialogOpen(false);
                    setNewDevice({
                      deviceId: '',
                      deviceName: '',
                      deviceModel: '',
                      osVersion: '',
                      appVersion: '',
                      batteryLevel: '',
                      isCharging: false,
                      isOnline: true,
                      networkType: 'wifi',
                    });

                    // Reload devices
                    loadDevices();
                  } catch (error: any) {
                    toast({
                      variant: 'destructive',
                      title: 'Error Adding Device',
                      description: error.message || 'Failed to add device.',
                    });
                  } finally {
                    setAddingDevice(false);
                  }
                }}
                disabled={addingDevice || !newDevice.deviceId.trim()}
              >
                {addingDevice ? 'Adding...' : 'Add Device'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </OwnerPortalLayout>
  );
};

export default DeviceManagement;

