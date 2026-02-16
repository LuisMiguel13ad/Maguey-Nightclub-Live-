import { getBatteryStatus, type BatteryStatus } from './battery-monitoring-service';

export interface PowerSavingSettings {
  enabled: boolean;
  autoDimEnabled: boolean;
  reducedScanFrequency: boolean;
  disableNonEssential: boolean;
  dimBrightness: number; // 0-1
  scanIntervalMs: number; // milliseconds between scans
}

const DEFAULT_SETTINGS: PowerSavingSettings = {
  enabled: false,
  autoDimEnabled: true,
  reducedScanFrequency: false,
  disableNonEssential: false,
  dimBrightness: 0.3,
  scanIntervalMs: 0, // No delay by default
};

// Get power saving settings from localStorage
export const getPowerSavingSettings = (): PowerSavingSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem('power_saving_settings');
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Error loading power saving settings:', error);
  }

  return DEFAULT_SETTINGS;
};

// Save power saving settings to localStorage
export const savePowerSavingSettings = (settings: PowerSavingSettings): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('power_saving_settings', JSON.stringify(settings));
  } catch (error) {
    console.warn('Error saving power saving settings:', error);
  }
};

// Enable power saving mode
export const enablePowerSavingMode = (): void => {
  const settings = getPowerSavingSettings();
  settings.enabled = true;
  settings.autoDimEnabled = true;
  settings.reducedScanFrequency = true;
  settings.disableNonEssential = true;
  savePowerSavingSettings(settings);
  applyPowerSavingSettings(settings);
};

// Disable power saving mode
export const disablePowerSavingMode = (): void => {
  const settings = getPowerSavingSettings();
  settings.enabled = false;
  settings.autoDimEnabled = false;
  settings.reducedScanFrequency = false;
  settings.disableNonEssential = false;
  savePowerSavingSettings(settings);
  applyPowerSavingSettings(settings);
};

// Apply power saving settings to the UI
export const applyPowerSavingSettings = (settings: PowerSavingSettings): void => {
  if (typeof window === 'undefined') return;

  // Auto-dim screen
  if (settings.autoDimEnabled && settings.enabled) {
    // Note: Screen brightness API is not available in browsers
    // This would need to be implemented via CSS filters or screen overlay
    const style = document.createElement('style');
    style.id = 'power-saving-dim';
    style.textContent = `
      body {
        filter: brightness(${settings.dimBrightness});
        transition: filter 0.3s ease;
      }
    `;
    
    const existing = document.getElementById('power-saving-dim');
    if (existing) {
      existing.remove();
    }
    
    if (settings.enabled) {
      document.head.appendChild(style);
    }
  } else {
    const existing = document.getElementById('power-saving-dim');
    if (existing) {
      existing.remove();
    }
  }
};

// Check if power saving should be enabled based on battery level
export const shouldEnablePowerSaving = async (): Promise<boolean> => {
  const batteryStatus = await getBatteryStatus();
  if (!batteryStatus) return false;

  // Enable power saving if battery is below 15% and not charging
  if (batteryStatus.level <= 15 && !batteryStatus.isCharging) {
    return true;
  }

  return false;
};

// Auto-adjust power saving based on battery level
export const autoAdjustPowerSaving = async (): Promise<void> => {
  const batteryStatus = await getBatteryStatus();
  if (!batteryStatus) return;

  const settings = getPowerSavingSettings();
  const shouldEnable = await shouldEnablePowerSaving();

  if (shouldEnable && !settings.enabled) {
    enablePowerSavingMode();
  } else if (!shouldEnable && settings.enabled && batteryStatus.level > 20 && batteryStatus.isCharging) {
    // Disable if battery is above 20% and charging
    disablePowerSavingMode();
  } else if (settings.enabled) {
    // Adjust settings based on battery level
    if (batteryStatus.level <= 5) {
      // Critical: Maximum power saving
      settings.autoDimEnabled = true;
      settings.reducedScanFrequency = true;
      settings.disableNonEssential = true;
      settings.dimBrightness = 0.2;
      settings.scanIntervalMs = 2000; // 2 second delay between scans
    } else if (batteryStatus.level <= 10) {
      // Low: Moderate power saving
      settings.autoDimEnabled = true;
      settings.reducedScanFrequency = true;
      settings.disableNonEssential = false;
      settings.dimBrightness = 0.3;
      settings.scanIntervalMs = 1000; // 1 second delay
    } else if (batteryStatus.level <= 15) {
      // Warning: Light power saving
      settings.autoDimEnabled = true;
      settings.reducedScanFrequency = false;
      settings.disableNonEssential = false;
      settings.dimBrightness = 0.5;
      settings.scanIntervalMs = 0;
    }

    savePowerSavingSettings(settings);
    applyPowerSavingSettings(settings);
  }
};

// Get recommended scan interval based on battery level
export const getRecommendedScanInterval = async (): Promise<number> => {
  const batteryStatus = await getBatteryStatus();
  if (!batteryStatus) return 0;

  const settings = getPowerSavingSettings();
  
  if (!settings.enabled || !settings.reducedScanFrequency) {
    return 0;
  }

  if (batteryStatus.level <= 5) {
    return 2000; // 2 seconds
  } else if (batteryStatus.level <= 10) {
    return 1000; // 1 second
  } else if (batteryStatus.level <= 15) {
    return 500; // 0.5 seconds
  }

  return 0;
};

// Initialize power saving monitoring
export const initializePowerSaving = (): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  // Check battery level periodically and adjust power saving
  const interval = setInterval(async () => {
    await autoAdjustPowerSaving();
  }, 30000); // Check every 30 seconds

  // Apply current settings on load
  const settings = getPowerSavingSettings();
  applyPowerSavingSettings(settings);

  // Listen for battery changes
  try {
    // @ts-ignore
    const battery = navigator.getBattery?.();
    if (battery) {
      battery.then((b: any) => {
        b.addEventListener('levelchange', autoAdjustPowerSaving);
        b.addEventListener('chargingchange', autoAdjustPowerSaving);
      });
    }
  } catch (error) {
    // Battery API not available
  }

  return () => {
    clearInterval(interval);
  };
};

