import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WifiOff,
  Settings,
  Keyboard,
  Camera,
  Radio,
  RefreshCw,
  Cloud,
  ChevronLeft,
} from "lucide-react";
import { QrScanner } from "@/components/QrScanner";
import { NFCScanner } from "@/components/NFCScanner";
import { ScannerInput } from "@/components/ScannerInput";
import { BatchQueue } from "@/components/BatchQueue";
import { ScanResultOverlay } from "./ScanResultOverlay";
import { ScannerSettingsPanel } from "./ScannerSettingsPanel";
import { useToast } from "@/hooks/use-toast";

interface FullScreenScannerProps {
  // Event Data
  events: any[];
  selectedEventId: string;
  onEventChange: (eventId: string) => void;
  currentEventName: string;
  // Capacity
  capacityStatus?: {
    currentCount: number;
    totalCapacity: number;
    percentageFull: number;
    available: number;
    isAtCapacity: boolean;
    isNearCapacity: boolean;
  };
  // Scan Mode
  scanMode: "camera" | "scanner";
  onScanModeChange: (mode: "camera" | "scanner") => void;
  scanMethod: "qr" | "nfc";
  onScanMethodChange: (method: "qr" | "nfc") => void;
  nfcAvailable: boolean;
  // Scan Handlers
  onScanSuccess: (data: string) => void;
  onNFCScanSuccess: (data: string) => void;
  onManualEntry: (ticketId: string) => void;
  // Scan State
  isScanning: boolean;
  isProcessing: boolean;
  scanResult: {
    status: "valid" | "used" | "invalid" | "vip";
    message: string;
    ticket?: any;
    overrideUsed?: boolean;
  } | null;
  onResetScan: () => void;
  // Network & Sync
  isOnline: boolean;
  syncStatus: { pending: number; failed: number };
  isSyncing: boolean;
  onManualSync: () => void;
  // Batch Mode
  batchMode: boolean;
  onBatchModeChange: (enabled: boolean) => void;
  queuedTickets: any[];
  onApproveBatch: () => void;
  onClearQueue: () => void;
  onRemoveFromQueue: (ticketId: string) => void;
  isProcessingBatch: boolean;
  // Re-entry Mode
  reEntryMode: "single" | "reentry" | "exit_tracking";
  onReEntryModeChange: (mode: "single" | "reentry" | "exit_tracking") => void;
  // Audio Settings
  soundEnabled: boolean;
  hapticEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
  onHapticChange: (enabled: boolean) => void;
  // Override (Owner)
  isOwner: boolean;
  overrideActive: boolean;
  onActivateOverride: () => void;
  onDeactivateOverride: () => void;
  // Navigation
  dashboardPath: string;
}

export function FullScreenScanner({
  events,
  selectedEventId,
  onEventChange,
  currentEventName,
  capacityStatus,
  scanMode,
  onScanModeChange,
  scanMethod,
  onScanMethodChange,
  nfcAvailable,
  onScanSuccess,
  onNFCScanSuccess,
  onManualEntry,
  isScanning,
  isProcessing,
  scanResult,
  onResetScan,
  isOnline,
  syncStatus,
  isSyncing,
  onManualSync,
  batchMode,
  onBatchModeChange,
  queuedTickets,
  onApproveBatch,
  onClearQueue,
  onRemoveFromQueue,
  isProcessingBatch,
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
  dashboardPath,
}: FullScreenScannerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const manualEntryRef = useRef<HTMLDivElement>(null);

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 via-black/50 to-transparent p-4 pb-12">
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <button
            onClick={() => navigate(dashboardPath)}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Center: Event Info */}
          <div className="flex-1 text-center px-4">
            <h1 className="text-white font-semibold text-lg truncate">
              {currentEventName || "Select Event"}
            </h1>
            {capacityStatus && (
              <p
                className={`text-sm ${
                  capacityStatus.isAtCapacity
                    ? "text-red-400"
                    : capacityStatus.isNearCapacity
                    ? "text-yellow-400"
                    : "text-green-400"
                }`}
              >
                {capacityStatus.currentCount}/{capacityStatus.totalCapacity}{" "}
                checked in
              </p>
            )}
          </div>

          {/* Right: Status Badges */}
          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                Offline
              </div>
            )}
            {syncStatus.pending > 0 && (
              <div className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
                {syncStatus.pending} pending
              </div>
            )}
          </div>
        </div>

        {/* Event Selector */}
        {events && events.length > 1 && (
          <div className="mt-3">
            <Select value={selectedEventId} onValueChange={onEventChange}>
              <SelectTrigger className="w-full bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((event: any) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name} -{" "}
                    {new Date(event.event_date).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Full-Screen Camera View */}
      <div className="flex-1 relative">
        {/* Scan Result Overlay */}
        {scanResult && (
          <ScanResultOverlay
            status={scanResult.status}
            message={scanResult.message}
            ticket={scanResult.ticket}
            onReset={onResetScan}
            overrideUsed={scanResult.overrideUsed}
          />
        )}

        {/* Camera/Scanner Component */}
        {!scanResult && (
          <>
            {scanMode === "camera" ? (
              scanMethod === "nfc" ? (
                <div className="absolute inset-0">
                  <NFCScanner
                    onScanSuccess={onNFCScanSuccess}
                    isScanning={isScanning && !isProcessing}
                    onError={(error) => {
                      toast({
                        variant: "destructive",
                        title: "NFC Error",
                        description: error,
                      });
                    }}
                  />
                </div>
              ) : (
                <div className="absolute inset-0">
                  <QrScanner
                    onScanSuccess={onScanSuccess}
                    isScanning={isScanning && !isProcessing}
                    onError={(error) => {
                      toast({
                        variant: "destructive",
                        title: "Camera Error",
                        description: error,
                      });
                    }}
                  />
                </div>
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center text-white p-6">
                  <Keyboard className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <h3 className="text-xl font-semibold mb-2">USB Scanner Mode</h3>
                  <p className="text-gray-400 mb-4">
                    Scan a barcode or QR code with your USB scanner
                  </p>
                  <ScannerInput
                    onScanSuccess={onScanSuccess}
                    disabled={isProcessing}
                  />
                </div>
              </div>
            )}

            {/* QR Frame Overlay */}
            {scanMode === "camera" && scanMethod === "qr" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-white/30 rounded-2xl relative">
                  <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-xl" />
                </div>
                <p className="absolute bottom-32 text-white/60 text-sm">
                  Point camera at QR code
                </p>
              </div>
            )}
          </>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="absolute inset-0 z-25 bg-black/50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        )}
      </div>

      {/* Batch Queue */}
      {batchMode && queuedTickets.length > 0 && (
        <div className="absolute bottom-32 left-4 right-4 z-15">
          <BatchQueue
            queuedTickets={queuedTickets}
            onApproveBatch={onApproveBatch}
            onClearQueue={onClearQueue}
            onRemoveTicket={onRemoveFromQueue}
            isProcessing={isProcessingBatch}
          />
        </div>
      )}

      {/* Floating Bottom Actions */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 pt-12">
        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 max-w-lg mx-auto">
          {/* Manual Entry Button */}
          <Button
            onClick={() => setShowSettings(true)}
            className="flex-1 bg-white/10 backdrop-blur text-white hover:bg-white/20 rounded-full h-12"
          >
            <Keyboard className="w-5 h-5 mr-2" />
            Manual Entry
          </Button>

          {/* Settings Button */}
          <Button
            onClick={() => setShowSettings(!showSettings)}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20 p-0"
          >
            <Settings className="w-5 h-5" />
          </Button>

          {/* Sync Button */}
          {(syncStatus.pending > 0 || !isOnline) && (
            <Button
              onClick={onManualSync}
              disabled={isSyncing || !isOnline}
              className="w-12 h-12 rounded-full bg-primary text-primary-foreground p-0"
            >
              {isSyncing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Cloud className="w-5 h-5" />
              )}
            </Button>
          )}
        </div>

        {/* Mode Toggle Pills */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <button
            onClick={() => onScanModeChange("camera")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              scanMode === "camera"
                ? "bg-primary text-primary-foreground"
                : "bg-white/10 text-white"
            }`}
          >
            <Camera className="w-4 h-4 inline mr-1" />
            Camera
          </button>
          <button
            onClick={() => onScanModeChange("scanner")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              scanMode === "scanner"
                ? "bg-primary text-primary-foreground"
                : "bg-white/10 text-white"
            }`}
          >
            <Keyboard className="w-4 h-4 inline mr-1" />
            USB
          </button>
          {nfcAvailable && (
            <button
              onClick={() =>
                onScanMethodChange(scanMethod === "nfc" ? "qr" : "nfc")
              }
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                scanMethod === "nfc"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/10 text-white"
              }`}
            >
              <Radio className="w-4 h-4 inline mr-1" />
              NFC
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      <ScannerSettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onManualEntry={onManualEntry}
        isProcessing={isProcessing}
        manualEntryRef={manualEntryRef}
        batchMode={batchMode}
        onBatchModeChange={onBatchModeChange}
        reEntryMode={reEntryMode}
        onReEntryModeChange={onReEntryModeChange}
        soundEnabled={soundEnabled}
        hapticEnabled={hapticEnabled}
        onSoundChange={onSoundChange}
        onHapticChange={onHapticChange}
        isOwner={isOwner}
        overrideActive={overrideActive}
        onActivateOverride={onActivateOverride}
        onDeactivateOverride={onDeactivateOverride}
        capacityStatus={capacityStatus}
      />
    </div>
  );
}
