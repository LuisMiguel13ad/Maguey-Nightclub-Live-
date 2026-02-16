import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

export interface BatteryStatus {
  level: number; // 0-100
  isCharging: boolean;
  estimatedTimeRemaining?: number; // minutes
}

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  networkType?: 'wifi' | 'cellular' | 'offline';
  storageUsedMB?: number;
  storageTotalMB?: number;
}

export interface DeviceStatus extends DeviceInfo {
  batteryLevel: number;
  isCharging: boolean;
  isOnline: boolean;
  lastSeen: string;
  userId?: string;
}

// Generate a unique device ID (stored in localStorage)
const getOrCreateDeviceId = (): string => {
  if (typeof window === 'undefined') return 'server-device';
  
  let deviceId = localStorage.getItem('scanner_device_id');
  if (!deviceId) {
    // Generate a unique device ID
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('scanner_device_id', deviceId);
  }
  return deviceId;
};

// Get battery status from browser API
export const getBatteryStatus = async (): Promise<BatteryStatus | null> => {
  if (typeof window === 'undefined') return null;
  
  try {
    // @ts-ignore - Battery API is not in all TypeScript definitions
    const battery = await navigator.getBattery?.();
    if (!battery) return null;

    const level = Math.round(battery.level * 100);
    const isCharging = battery.charging;
    
    // Estimate time remaining (rough calculation)
    let estimatedTimeRemaining: number | undefined;
    if (!isCharging && battery.dischargingTime !== Infinity) {
      estimatedTimeRemaining = Math.round(battery.dischargingTime / 60); // Convert to minutes
    }

    return {
      level,
      isCharging,
      estimatedTimeRemaining,
    };
  } catch (error) {
    console.warn('Battery API not available:', error);
    return null;
  }
};

// Get device information
export const getDeviceInfo = (): DeviceInfo => {
  if (typeof window === 'undefined') {
    return {
      deviceId: 'server-device',
    };
  }

  const deviceId = getOrCreateDeviceId();
  const userAgent = navigator.userAgent;
  
  // Try to detect device model/name
  let deviceModel: string | undefined;
  let deviceName: string | undefined;
  
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    deviceModel = /iPhone|iPad|iPod/.exec(userAgent)?.[0];
  } else if (/Android/.test(userAgent)) {
    deviceModel = 'Android Device';
  } else {
    deviceModel = 'Desktop';
  }

  // Get OS version (simplified)
  let osVersion: string | undefined;
  if (/iPhone OS/.test(userAgent)) {
    const match = userAgent.match(/OS (\d+)_(\d+)/);
    if (match) osVersion = `iOS ${match[1]}.${match[2]}`;
  } else if (/Android/.test(userAgent)) {
    const match = userAgent.match(/Android (\d+(\.\d+)?)/);
    if (match) osVersion = `Android ${match[1]}`;
  }

  // Get app version from package.json or env
  const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';

  // Get network type
  let networkType: 'wifi' | 'cellular' | 'offline' = 'offline';
  if (navigator.onLine) {
    // @ts-ignore - Connection API may not be available
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const effectiveType = connection.effectiveType || connection.type;
      if (effectiveType === 'wifi' || connection.type === 'wifi') {
        networkType = 'wifi';
      } else {
        networkType = 'cellular';
      }
    } else {
      // Fallback: assume online means wifi
      networkType = 'wifi';
    }
  }

  // Get storage info (localStorage size estimate)
  let storageUsedMB: number | undefined;
  let storageTotalMB: number | undefined;
  
  try {
    // Estimate localStorage usage
    let totalSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length + key.length;
      }
    }
    storageUsedMB = Math.round((totalSize / 1024 / 1024) * 100) / 100; // Round to 2 decimals
    
    // Most browsers allow ~5-10MB for localStorage
    storageTotalMB = 10;
  } catch (error) {
    console.warn('Could not calculate storage:', error);
  }

  return {
    deviceId,
    deviceName: deviceName || deviceModel,
    deviceModel,
    osVersion,
    appVersion,
    networkType,
    storageUsedMB,
    storageTotalMB,
  };
};

// Update device status in database
export const updateDeviceStatus = async (
  batteryStatus?: BatteryStatus,
  deviceInfo?: DeviceInfo
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // Store locally in development mode
    if (typeof window !== 'undefined') {
      const status = {
        batteryLevel: batteryStatus?.level,
        isCharging: batteryStatus?.isCharging,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem('device_status', JSON.stringify(status));
    }
    return;
  }

  try {
    const info = deviceInfo || getDeviceInfo();
    const battery = batteryStatus || await getBatteryStatus();

    const { error } = await supabase.rpc('update_device_status', {
      p_device_id: info.deviceId,
      p_battery_level: battery?.level ?? null,
      p_is_charging: battery?.isCharging ?? false,
      p_is_online: navigator.onLine,
      p_network_type: info.networkType ?? null,
      p_storage_used_mb: info.storageUsedMB ?? null,
      p_storage_total_mb: info.storageTotalMB ?? null,
    });

    if (error) {
      console.error('Error updating device status:', error);
    }
  } catch (error) {
    console.error('Error updating device status:', error);
  }
};

// Get current device status from database
export const getCurrentDeviceStatus = async (): Promise<DeviceStatus | null> => {
  if (!isSupabaseConfigured()) {
    // Return local status in development mode
    if (typeof window !== 'undefined') {
      const localStatus = localStorage.getItem('device_status');
      if (localStatus) {
        const parsed = JSON.parse(localStatus);
        const info = getDeviceInfo();
        return {
          ...info,
          batteryLevel: parsed.batteryLevel ?? 100,
          isCharging: parsed.isCharging ?? false,
          isOnline: navigator.onLine,
          lastSeen: parsed.lastUpdated ?? new Date().toISOString(),
        };
      }
    }
    return null;
  }

  try {
    const deviceId = getOrCreateDeviceId();
    const { data, error } = await supabase
      .from('scanner_devices')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching device status:', error);
      return null;
    }

    if (!data) return null;

    return {
      deviceId: data.device_id,
      deviceName: data.device_name,
      deviceModel: data.device_model,
      osVersion: data.os_version,
      appVersion: data.app_version,
      networkType: data.network_type as 'wifi' | 'cellular' | 'offline' | undefined,
      storageUsedMB: data.storage_used_mb,
      storageTotalMB: data.storage_total_mb,
      batteryLevel: data.battery_level ?? 100,
      isCharging: data.is_charging ?? false,
      isOnline: data.is_online ?? true,
      lastSeen: data.last_seen,
      userId: data.user_id,
    };
  } catch (error) {
    console.error('Error fetching device status:', error);
    return null;
  }
};

// Get battery history for a device
export const getBatteryHistory = async (hours: number = 24, deviceUuid?: string): Promise<Array<{
  timestamp: string;
  batteryLevel: number;
  isCharging: boolean;
}>> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    let deviceUuidToUse = deviceUuid;
    
    // If no device UUID provided, get current device UUID
    if (!deviceUuidToUse) {
      const deviceId = getOrCreateDeviceId();
      
      // First get the device UUID
      const { data: device, error: deviceError } = await supabase
        .from('scanner_devices')
        .select('id')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (deviceError || !device) {
        console.error('Error fetching device:', deviceError);
        return [];
      }
      
      deviceUuidToUse = device.id;
    }

    // Get battery history
    const { data, error } = await supabase.rpc('get_device_battery_history', {
      p_device_id: deviceUuidToUse,
      p_hours: hours,
    });

    if (error) {
      console.error('Error fetching battery history:', error);
      return [];
    }

    return (data || []).map((log: any) => ({
      timestamp: log.timestamp,
      batteryLevel: log.battery_level,
      isCharging: log.is_charging,
    }));
  } catch (error) {
    console.error('Error fetching battery history:', error);
    return [];
  }
};

// Initialize battery monitoring (call on app start)
export const initializeBatteryMonitoring = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  // Update device status immediately
  await updateDeviceStatus();

  // Set up periodic updates (every 30 seconds)
  const updateInterval = setInterval(async () => {
    await updateDeviceStatus();
  }, 30000);

  // Listen for battery changes
  try {
    // @ts-ignore
    const battery = await navigator.getBattery?.();
    if (battery) {
      battery.addEventListener('chargingchange', () => {
        updateDeviceStatus();
      });
      battery.addEventListener('levelchange', () => {
        updateDeviceStatus();
      });
      battery.addEventListener('chargingtimechange', () => {
        updateDeviceStatus();
      });
      battery.addEventListener('dischargingtimechange', () => {
        updateDeviceStatus();
      });
    }
  } catch (error) {
    console.warn('Battery API not available:', error);
  }

  // Listen for online/offline changes
  window.addEventListener('online', () => {
    updateDeviceStatus();
  });
  window.addEventListener('offline', () => {
    updateDeviceStatus();
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(updateInterval);
  });
};

