import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BatteryWarning, Zap, AlertTriangle } from 'lucide-react';
import { getBatteryStatus, type BatteryStatus } from '@/lib/battery-monitoring-service';

interface LowBatteryModalProps {
  open: boolean;
  onClose: () => void;
  batteryLevel: number;
  isCharging: boolean;
}

export const LowBatteryModal = ({
  open,
  onClose,
  batteryLevel,
  isCharging,
}: LowBatteryModalProps) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const isCritical = batteryLevel <= 5;
  const isLow = batteryLevel <= 10;
  const isWarning = batteryLevel <= 20;

  const handleDontShowAgain = () => {
    if (dontShowAgain) {
      localStorage.setItem('low_battery_warning_disabled', 'true');
    }
    onClose();
  };

  const getTitle = () => {
    if (isCritical) return 'Critical Battery Level';
    if (isLow) return 'Low Battery Warning';
    return 'Battery Warning';
  };

  const getDescription = () => {
    if (isCritical) {
      return 'Your device battery is critically low. Please charge immediately or enable power-saving mode.';
    }
    if (isLow) {
      return 'Your device battery is running low. Consider charging soon or enabling power-saving mode.';
    }
    return 'Your device battery is below 20%. Consider charging soon.';
  };

  const getSeverity = () => {
    if (isCritical) return 'destructive';
    if (isLow) return 'destructive';
    return 'default';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCritical ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : (
              <BatteryWarning className="h-5 w-5 text-yellow-500" />
            )}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div
                className={`text-6xl font-bold ${
                  isCritical ? 'text-red-500' : isLow ? 'text-yellow-500' : 'text-orange-500'
                }`}
              >
                {batteryLevel}%
              </div>
              {isCharging && (
                <Zap className="absolute -top-2 -right-2 h-6 w-6 text-green-500" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Battery Level</span>
              <Badge variant={getSeverity()}>{batteryLevel}%</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={isCharging ? 'default' : 'secondary'}>
                {isCharging ? 'Charging' : 'Discharging'}
              </Badge>
            </div>
          </div>

          {(isCritical || isLow) && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                <strong>Recommendations:</strong>
              </p>
              <ul className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 space-y-1 list-disc list-inside">
                {isCritical && (
                  <>
                    <li>Enable power-saving mode immediately</li>
                    <li>Reduce screen brightness</li>
                    <li>Disable non-essential features</li>
                  </>
                )}
                {isLow && !isCritical && (
                  <>
                    <li>Consider enabling power-saving mode</li>
                    <li>Reduce scan frequency if possible</li>
                    <li>Charge device when convenient</li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded"
              />
              Don't show again
            </label>
            <Button onClick={handleDontShowAgain} className="ml-auto">
              {isCharging ? 'Continue' : 'Enable Power Saving'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

