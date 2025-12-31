import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Smartphone,
  Battery,
  Wifi,
  HardDrive,
  Clock,
  Zap,
  Signal,
  WifiOff,
} from 'lucide-react';
import {
  getCurrentDeviceStatus,
  getDeviceInfo,
  type DeviceStatus,
} from '@/lib/battery-monitoring-service';
import { formatDistanceToNow } from 'date-fns';

export const DeviceInfoCard = () => {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDeviceStatus = async () => {
      setIsLoading(true);
      const status = await getCurrentDeviceStatus();
      if (!status) {
        // Fallback to local device info
        const info = getDeviceInfo();
        setDeviceStatus({
          ...info,
          batteryLevel: 100,
          isCharging: false,
          isOnline: navigator.onLine,
          lastSeen: new Date().toISOString(),
        });
      } else {
        setDeviceStatus(status);
      }
      setIsLoading(false);
    };

    loadDeviceStatus();

    // Update every 30 seconds
    const interval = setInterval(loadDeviceStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Device Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!deviceStatus) {
    return null;
  }

  const getBatteryColor = () => {
    if (deviceStatus.batteryLevel <= 5) return 'text-red-500';
    if (deviceStatus.batteryLevel <= 20) return 'text-yellow-500';
    if (deviceStatus.isCharging) return 'text-green-500';
    return 'text-muted-foreground';
  };

  const getNetworkIcon = () => {
    if (!deviceStatus.isOnline) {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
    if (deviceStatus.networkType === 'wifi') {
      return <Wifi className="h-4 w-4 text-green-500" />;
    }
    if (deviceStatus.networkType === 'cellular') {
      return <Signal className="h-4 w-4 text-blue-500" />;
    }
    return <WifiOff className="h-4 w-4 text-muted-foreground" />;
  };

  const storagePercentage =
    deviceStatus.storageUsedMB && deviceStatus.storageTotalMB
      ? Math.round((deviceStatus.storageUsedMB / deviceStatus.storageTotalMB) * 100)
      : null;

  return (
    <Card className="w-full">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" />
          Device Information
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">Current device status and details</CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 space-y-3 sm:space-y-4">
        {/* Device Name/Model */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground">Device</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-xs sm:text-sm truncate">
              {deviceStatus.deviceName || deviceStatus.deviceModel || 'Unknown Device'}
            </span>
            {deviceStatus.deviceModel && (
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {deviceStatus.deviceModel}
              </Badge>
            )}
          </div>
        </div>

        {/* OS Version */}
        {deviceStatus.osVersion && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">OS Version</span>
            <span className="text-xs sm:text-sm font-medium">{deviceStatus.osVersion}</span>
          </div>
        )}

        {/* App Version */}
        {deviceStatus.appVersion && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">App Version</span>
            <Badge variant="secondary" className="text-xs w-fit">
              {deviceStatus.appVersion}
            </Badge>
          </div>
        )}

        {/* Battery Level */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
            <Battery className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Battery
          </span>
          <div className="flex items-center gap-2">
            {deviceStatus.isCharging && <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />}
            <span className={`text-xs sm:text-sm font-medium ${getBatteryColor()}`}>
              {deviceStatus.batteryLevel}%
            </span>
            {deviceStatus.isCharging && (
              <Badge variant="default" className="text-xs bg-green-500">
                Charging
              </Badge>
            )}
          </div>
        </div>

        {/* Network Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
            {getNetworkIcon()}
            Network
          </span>
          <div className="flex items-center gap-2">
            <Badge
              variant={deviceStatus.isOnline ? 'default' : 'destructive'}
              className="text-xs w-fit"
            >
              {deviceStatus.isOnline
                ? deviceStatus.networkType?.toUpperCase() || 'ONLINE'
                : 'OFFLINE'}
            </Badge>
          </div>
        </div>

        {/* Storage Usage */}
        {storagePercentage !== null && (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                <HardDrive className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Storage
              </span>
              <span className="text-xs sm:text-sm font-medium">
                {deviceStatus.storageUsedMB} MB / {deviceStatus.storageTotalMB} MB
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  storagePercentage > 80
                    ? 'bg-red-500'
                    : storagePercentage > 60
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Last Sync */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 pt-2 sm:pt-3 border-t">
          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Last Sync
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(deviceStatus.lastSeen), { addSuffix: true })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

