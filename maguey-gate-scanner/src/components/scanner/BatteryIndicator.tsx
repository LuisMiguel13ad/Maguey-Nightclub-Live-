import { useState, useEffect } from "react";
import { Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryCharging } from "lucide-react";
import { cn } from "@/lib/utils";

interface BatteryStatus {
  level: number; // 0-1
  charging: boolean;
}

/**
 * Battery indicator for scanner UI.
 * Uses Navigator Battery API (where available).
 * Falls back to hidden state if API not supported.
 */
export function BatteryIndicator() {
  const [battery, setBattery] = useState<BatteryStatus | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const getBattery = async () => {
      try {
        // Battery API is available on some browsers
        if ('getBattery' in navigator) {
          const batteryManager = await (navigator as any).getBattery();

          const updateBattery = () => {
            setBattery({
              level: batteryManager.level,
              charging: batteryManager.charging,
            });
          };

          updateBattery();
          batteryManager.addEventListener('levelchange', updateBattery);
          batteryManager.addEventListener('chargingchange', updateBattery);

          cleanup = () => {
            batteryManager.removeEventListener('levelchange', updateBattery);
            batteryManager.removeEventListener('chargingchange', updateBattery);
          };
        }
      } catch (err) {
        console.warn('[Battery] API not available:', err);
      }
    };

    getBattery();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  if (!battery) return null;

  const percentage = Math.round(battery.level * 100);
  const isLow = percentage <= 20;
  const isMedium = percentage > 20 && percentage <= 50;

  const Icon = battery.charging
    ? BatteryCharging
    : isLow
    ? BatteryLow
    : isMedium
    ? BatteryMedium
    : BatteryFull;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        isLow && "text-red-500",
        !isLow && !battery.charging && "text-white/70",
        battery.charging && "text-green-500"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{percentage}%</span>
    </div>
  );
}
