import { useEffect, useState } from 'react';
import { Battery, BatteryLow, BatteryWarning, Zap } from 'lucide-react';
import { getBatteryStatus, type BatteryStatus } from '@/lib/battery-monitoring-service';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BatteryIndicatorProps {
  className?: string;
}

export const BatteryIndicator = ({ className }: BatteryIndicatorProps) => {
  const [batteryStatus, setBatteryStatus] = useState<BatteryStatus | null>(null);
  const [isCharging, setIsCharging] = useState(false);

  useEffect(() => {
    const updateBatteryStatus = async () => {
      const status = await getBatteryStatus();
      setBatteryStatus(status);
      setIsCharging(status?.isCharging ?? false);
    };

    updateBatteryStatus();

    // Update every 30 seconds
    const interval = setInterval(updateBatteryStatus, 30000);

    // Listen for battery changes
    let batteryCleanup: (() => void) | null = null;
    
    (async () => {
      try {
        // @ts-ignore
        const battery = await navigator.getBattery?.();
        if (battery) {
          const handleChange = () => {
            updateBatteryStatus();
          };
          battery.addEventListener('chargingchange', handleChange);
          battery.addEventListener('levelchange', handleChange);
          
          batteryCleanup = () => {
            battery.removeEventListener('chargingchange', handleChange);
            battery.removeEventListener('levelchange', handleChange);
          };
        }
      } catch (error) {
        // Battery API not available
      }
    })();

    return () => {
      if (batteryCleanup) {
        batteryCleanup();
      }
      clearInterval(interval);
    };
  }, []);

  if (!batteryStatus) {
    return null; // Battery API not available
  }

  const { level, estimatedTimeRemaining } = batteryStatus;
  const isLow = level <= 20;
  const isCritical = level <= 5;

  const getBatteryColor = () => {
    if (isCritical) return 'text-red-500';
    if (isLow) return 'text-yellow-500';
    if (isCharging) return 'text-green-500';
    return 'text-muted-foreground';
  };

  const getBatteryIcon = () => {
    if (isCharging) {
      return <Zap className={`h-4 w-4 ${getBatteryColor()}`} />;
    }
    if (isCritical) {
      return <BatteryWarning className={`h-4 w-4 ${getBatteryColor()}`} />;
    }
    if (isLow) {
      return <BatteryLow className={`h-4 w-4 ${getBatteryColor()}`} />;
    }
    return <Battery className={`h-4 w-4 ${getBatteryColor()}`} />;
  };

  const getTooltipText = () => {
    if (isCharging) {
      return `Charging: ${level}%`;
    }
    if (estimatedTimeRemaining) {
      const hours = Math.floor(estimatedTimeRemaining / 60);
      const minutes = estimatedTimeRemaining % 60;
      return `${level}% - ${hours > 0 ? `${hours}h ` : ''}${minutes}m remaining`;
    }
    return `${level}% battery`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 ${className}`}>
            {getBatteryIcon()}
            <span className={`text-xs font-medium ${getBatteryColor()}`}>
              {level}%
            </span>
            {isLow && !isCharging && (
              <Badge variant="destructive" className="text-xs px-1 py-0">
                Low
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

