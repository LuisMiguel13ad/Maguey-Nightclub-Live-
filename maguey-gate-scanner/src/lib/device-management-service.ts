import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import type { DeviceStatus } from './battery-monitoring-service';

export interface ScannerDevice {
  id: string;
  deviceId: string;
  deviceName: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  appVersion: string | null;
  userId: string | null;
  lastSeen: string;
  batteryLevel: number | null;
  isCharging: boolean;
  isOnline: boolean;
  networkType: string | null;
  storageUsedMB: number | null;
  storageTotalMB: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceHealthStatus {
  device: ScannerDevice;
  status: 'healthy' | 'low_battery' | 'offline' | 'critical_battery';
  minutesOffline?: number;
  lastSeenAgo?: string;
}

// Get all devices (admin only)
export const getAllDevices = async (): Promise<ScannerDevice[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('scanner_devices')
      .select('*')
      .order('last_seen', { ascending: false });

    if (error) {
      console.error('Error fetching devices:', error);
      return [];
    }

    return (data || []).map((device: any) => ({
      id: device.id,
      deviceId: device.device_id,
      deviceName: device.device_name,
      deviceModel: device.device_model,
      osVersion: device.os_version,
      appVersion: device.app_version,
      userId: device.user_id,
      lastSeen: device.last_seen,
      batteryLevel: device.battery_level,
      isCharging: device.is_charging,
      isOnline: device.is_online,
      networkType: device.network_type,
      storageUsedMB: device.storage_used_mb,
      storageTotalMB: device.storage_total_mb,
      createdAt: device.created_at,
      updatedAt: device.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching devices:', error);
    return [];
  }
};

// Get devices with low battery
export const getDevicesWithLowBattery = async (threshold: number = 20): Promise<ScannerDevice[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase.rpc('get_devices_with_low_battery', {
      p_threshold: threshold,
    });

    if (error) {
      console.error('Error fetching low battery devices:', error);
      return [];
    }

    return (data || []).map((device: any) => ({
      id: device.id,
      deviceId: device.device_id,
      deviceName: device.device_name,
      deviceModel: device.device_model,
      osVersion: null,
      appVersion: null,
      userId: device.user_id,
      lastSeen: device.last_seen,
      batteryLevel: device.battery_level,
      isCharging: device.is_charging,
      isOnline: device.is_online,
      networkType: null,
      storageUsedMB: null,
      storageTotalMB: null,
      createdAt: '',
      updatedAt: '',
    }));
  } catch (error) {
    console.error('Error fetching low battery devices:', error);
    return [];
  }
};

// Get offline devices
export const getOfflineDevices = async (minutesOffline: number = 30): Promise<Array<{
  device: ScannerDevice;
  minutesOffline: number;
}>> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase.rpc('get_offline_devices', {
      p_minutes_offline: minutesOffline,
    });

    if (error) {
      console.error('Error fetching offline devices:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      device: {
        id: item.id,
        deviceId: item.device_id,
        deviceName: item.device_name,
        deviceModel: item.device_model,
        osVersion: null,
        appVersion: null,
        userId: item.user_id,
        lastSeen: item.last_seen,
        batteryLevel: null,
        isCharging: false,
        isOnline: false,
        networkType: null,
        storageUsedMB: null,
        storageTotalMB: null,
        createdAt: '',
        updatedAt: '',
      },
      minutesOffline: item.minutes_offline,
    }));
  } catch (error) {
    console.error('Error fetching offline devices:', error);
    return [];
  }
};

// Get device health status
export const getDeviceHealthStatus = (device: ScannerDevice): DeviceHealthStatus => {
  const now = new Date();
  const lastSeen = new Date(device.lastSeen);
  const minutesSinceLastSeen = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);

  let status: 'healthy' | 'low_battery' | 'offline' | 'critical_battery' = 'healthy';

  if (!device.isOnline || minutesSinceLastSeen > 30) {
    status = 'offline';
  } else if (device.batteryLevel !== null) {
    if (device.batteryLevel <= 5) {
      status = 'critical_battery';
    } else if (device.batteryLevel <= 20) {
      status = 'low_battery';
    }
  }

  const lastSeenAgo = minutesSinceLastSeen < 1
    ? 'Just now'
    : minutesSinceLastSeen < 60
    ? `${minutesSinceLastSeen} min ago`
    : `${Math.floor(minutesSinceLastSeen / 60)}h ${minutesSinceLastSeen % 60}m ago`;

  return {
    device,
    status,
    minutesOffline: !device.isOnline ? minutesSinceLastSeen : undefined,
    lastSeenAgo,
  };
};

// Update device name
export const updateDeviceName = async (deviceId: string, deviceName: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('scanner_devices')
      .update({ device_name: deviceName })
      .eq('device_id', deviceId);

    if (error) {
      console.error('Error updating device name:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating device name:', error);
    return false;
  }
};

// Get device by ID
export const getDeviceById = async (deviceId: string): Promise<ScannerDevice | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('scanner_devices')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching device:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      deviceId: data.device_id,
      deviceName: data.device_name,
      deviceModel: data.device_model,
      osVersion: data.os_version,
      appVersion: data.app_version,
      userId: data.user_id,
      lastSeen: data.last_seen,
      batteryLevel: data.battery_level,
      isCharging: data.is_charging,
      isOnline: data.is_online,
      networkType: data.network_type,
      storageUsedMB: data.storage_used_mb,
      storageTotalMB: data.storage_total_mb,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error fetching device:', error);
    return null;
  }
};

