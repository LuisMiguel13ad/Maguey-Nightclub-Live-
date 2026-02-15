import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Layers,
  Volume2,
  VolumeX,
  Vibrate,
  AlertTriangle,
} from "lucide-react";
import { ManualEntry } from "./ManualEntry";

interface ScannerSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  // Manual Entry
  onManualEntry: (ticketId: string) => void;
  isProcessing: boolean;
  manualEntryRef?: React.RefObject<HTMLDivElement>;
  // Batch Mode
  batchMode: boolean;
  onBatchModeChange: (enabled: boolean) => void;
  // Re-entry Mode
  reEntryMode: "single" | "reentry" | "exit_tracking";
  onReEntryModeChange: (mode: "single" | "reentry" | "exit_tracking") => void;
  // Audio Settings
  soundEnabled: boolean;
  hapticEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
  onHapticChange: (enabled: boolean) => void;
  // Override (Owner Only)
  isOwner: boolean;
  overrideActive: boolean;
  onActivateOverride: () => void;
  onDeactivateOverride: () => void;
  // Capacity
  capacityStatus?: {
    currentCount: number;
    totalCapacity: number;
    percentageFull: number;
    isAtCapacity: boolean;
    isNearCapacity: boolean;
  };
}

export function ScannerSettingsPanel({
  open,
  onClose,
  onManualEntry,
  isProcessing,
  manualEntryRef,
  batchMode,
  onBatchModeChange,
  reEntryMode,
  onReEntryModeChange,
  soundEnabled,
  hapticEnabled,
  onSoundChange,
  onHapticChange,
  isOwner,
  overrideActive,
  onActivateOverride,
  onDeactivateOverride,
  capacityStatus,
}: ScannerSettingsPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Panel */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Handle bar */}
          <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6" />

          <h2 className="text-xl font-bold text-white mb-6">Scanner Settings</h2>

          {/* Manual Entry Section */}
          <div ref={manualEntryRef} className="mb-6">
            <ManualEntry onSubmit={onManualEntry} disabled={isProcessing} />
          </div>

          {/* Batch Mode Toggle */}
          <div className="flex items-center justify-between py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <Label className="text-white">Batch Scanning</Label>
                <p className="text-xs text-gray-400">Queue multiple tickets</p>
              </div>
            </div>
            <Switch checked={batchMode} onCheckedChange={onBatchModeChange} />
          </div>

          {/* Re-entry Mode */}
          <div className="flex items-center justify-between py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-primary" />
              <div>
                <Label className="text-white">Re-entry Mode</Label>
                <p className="text-xs text-gray-400">
                  {reEntryMode === "single"
                    ? "Single entry only"
                    : reEntryMode === "reentry"
                    ? "Allow re-entry"
                    : "Track entry/exit"}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={reEntryMode === "single" ? "default" : "outline"}
                onClick={() => onReEntryModeChange("single")}
                className="text-xs"
              >
                Single
              </Button>
              <Button
                size="sm"
                variant={reEntryMode === "reentry" ? "default" : "outline"}
                onClick={() => onReEntryModeChange("reentry")}
                className="text-xs"
              >
                Re-entry
              </Button>
            </div>
          </div>

          {/* Audio Settings */}
          <div className="flex items-center justify-between py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 className="h-5 w-5 text-primary" />
              ) : (
                <VolumeX className="h-5 w-5 text-gray-400" />
              )}
              <Label className="text-white">Sound Feedback</Label>
            </div>
            <Switch checked={soundEnabled} onCheckedChange={onSoundChange} />
          </div>

          <div className="flex items-center justify-between py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Vibrate
                className={`h-5 w-5 ${
                  hapticEnabled ? "text-primary" : "text-gray-400"
                }`}
              />
              <Label className="text-white">Haptic Feedback</Label>
            </div>
            <Switch checked={hapticEnabled} onCheckedChange={onHapticChange} />
          </div>

          {/* Override Mode (Owner Only) */}
          {isOwner && (
            <div className="py-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <div>
                    <Label className="text-red-500 font-semibold">
                      Emergency Override
                    </Label>
                    <p className="text-xs text-gray-400">
                      Bypass validation checks
                    </p>
                  </div>
                </div>
                {overrideActive && <Badge variant="destructive">ACTIVE</Badge>}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={overrideActive ? onDeactivateOverride : onActivateOverride}
                className="w-full mt-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              >
                {overrideActive ? "Deactivate Override" : "Activate Override"}
              </Button>
            </div>
          )}

          {/* Capacity Status */}
          {capacityStatus && (
            <div className="py-4">
              <div className="flex items-center gap-3 mb-3">
                <Users className="h-5 w-5 text-primary" />
                <Label className="text-white">Venue Capacity</Label>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-baseline gap-2 mb-2">
                  <span
                    className={`text-2xl font-bold ${
                      capacityStatus.isAtCapacity ? "text-red-500" : "text-white"
                    }`}
                  >
                    {capacityStatus.currentCount}
                  </span>
                  <span className="text-gray-400">
                    / {capacityStatus.totalCapacity}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      capacityStatus.isAtCapacity
                        ? "bg-red-500"
                        : capacityStatus.isNearCapacity
                        ? "bg-yellow-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${capacityStatus.percentageFull}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Close Button */}
          <Button onClick={onClose} className="w-full mt-4 rounded-full">
            Close Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
