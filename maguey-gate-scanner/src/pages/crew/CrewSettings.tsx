/**
 * Crew Settings Page
 *
 * Consolidated settings for door staff: profile, device health, audio settings.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmployeePortalLayout from "@/components/layout/EmployeePortalLayout";
import { DeviceInfoCard } from "@/components/DeviceInfoCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/AuthContext";
import {
  getCurrentSyncStatus,
  performManualSync,
  type SyncStatus,
} from "@/lib/sync-status-service";
import {
  getPendingScans,
  type QueuedScan,
} from "@/lib/offline-queue-service";
import {
  getAudioSettings,
  saveAudioSettings,
  testSound,
  type AudioSettings,
} from "@/lib/audio-feedback-service";
import {
  User,
  Mail,
  Shield,
  Smartphone,
  RefreshCw,
  WifiOff,
  CheckCircle2,
  Volume2,
  VolumeX,
  Vibrate,
  QrCode,
  HardDrive,
} from "lucide-react";

const CrewSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const role = useRole();

  const [deviceId, setDeviceId] = useState<string>("—");
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [localQueue, setLocalQueue] = useState<QueuedScan[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(getAudioSettings());

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (role === "owner") {
      navigate("/settings");
      return;
    }
  }, [authLoading, user, role, navigate]);

  useEffect(() => {
    const localDeviceId = localStorage.getItem("scanner_device_id");
    if (localDeviceId) {
      setDeviceId(localDeviceId);
    }
  }, []);

  const loadSyncData = async () => {
    try {
      const [status, queue] = await Promise.all([getCurrentSyncStatus(), getPendingScans()]);
      setSyncStatus(status);
      setLocalQueue(queue);
    } catch (error) {
      console.error("[CrewSettings] Failed to load sync status:", error);
    }
  };

  useEffect(() => {
    loadSyncData();
    const interval = setInterval(loadSyncData, 10000);
    return () => clearInterval(interval);
  }, []);

  const queueSummary = useMemo(() => {
    return {
      pending: localQueue.filter((scan) => scan.syncStatus === "pending").length,
      failed: localQueue.filter((scan) => scan.syncStatus === "failed").length,
    };
  }, [localQueue]);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await performManualSync();
      toast({
        title: result.failed > 0 ? "Partial sync" : "Scans synced",
        description:
          result.total === 0
            ? "No queued scans were waiting."
            : `Processed ${result.success} of ${result.total} scans.`,
        variant: result.failed > 0 ? "destructive" : "default",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: error.message || "Unable to sync scans.",
      });
    } finally {
      setIsSyncing(false);
      loadSyncData();
    }
  };

  const handleAudioToggle = (enabled: boolean) => {
    const newSettings = { ...audioSettings, enabled };
    setAudioSettings(newSettings);
    saveAudioSettings(newSettings);
    if (enabled) {
      testSound("success");
    }
  };

  const handleVibrationToggle = (vibrationEnabled: boolean) => {
    const newSettings = { ...audioSettings, vibrationEnabled };
    setAudioSettings(newSettings);
    saveAudioSettings(newSettings);
    if (vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newSettings = { ...audioSettings, volume: value[0] };
    setAudioSettings(newSettings);
    saveAudioSettings(newSettings);
  };

  const headerActions = (
    <Button
      size="sm"
      variant="secondary"
      className="w-full bg-white/10 text-white hover:bg-white/20 sm:w-auto"
      onClick={() => navigate("/scanner")}
    >
      <QrCode className="mr-2 h-4 w-4" />
      Scanner
    </Button>
  );

  return (
    <EmployeePortalLayout
      title="Settings"
      subtitle="Crew Suite"
      description="Device, audio, and profile settings"
      actions={headerActions}
    >
      <div className="space-y-6">
        {/* Profile Card */}
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <User className="h-4 w-4" />
              Profile
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              Your crew identity and role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-purple-100/80">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4" />
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4" />
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Role</p>
                <Badge variant="outline" className="border-white/30 text-white">
                  {role}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4" />
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Device ID</p>
                <p className="font-mono text-xs">{deviceId}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device & Sync Status */}
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              {syncStatus?.isOnline ? (
                <CheckCircle2 className="h-4 w-4 text-green-300" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-300" />
              )}
              Device Status
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              Sync queue and connectivity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Pending</p>
                <p className="text-2xl font-semibold">{queueSummary.pending}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Failed</p>
                <p className="text-2xl font-semibold text-amber-300">{queueSummary.failed}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Health</p>
                <p className="text-2xl font-semibold">
                  {syncStatus?.syncHealthScore?.toFixed(0) || 100}%
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="w-full bg-white/10 text-white hover:bg-white/20"
              onClick={handleManualSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
          </CardContent>
        </Card>

        {/* Audio Settings */}
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Volume2 className="h-4 w-4" />
              Audio Feedback
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              Sound and vibration for scan results
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {audioSettings.enabled ? (
                  <Volume2 className="h-5 w-5 text-green-400" />
                ) : (
                  <VolumeX className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="audio-toggle" className="text-sm font-medium">
                    Sound Effects
                  </Label>
                  <p className="text-xs text-purple-100/70">
                    Play sounds for scan results
                  </p>
                </div>
              </div>
              <Switch
                id="audio-toggle"
                checked={audioSettings.enabled}
                onCheckedChange={handleAudioToggle}
              />
            </div>

            {audioSettings.enabled && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Volume</Label>
                <Slider
                  value={[audioSettings.volume]}
                  onValueChange={handleVolumeChange}
                  max={1}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-xs text-purple-100/70 text-right">
                  {Math.round(audioSettings.volume * 100)}%
                </p>
              </div>
            )}

            <Separator className="border-white/10" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Vibrate className="h-5 w-5 text-purple-300" />
                <div>
                  <Label htmlFor="vibration-toggle" className="text-sm font-medium">
                    Vibration
                  </Label>
                  <p className="text-xs text-purple-100/70">
                    Haptic feedback on scan
                  </p>
                </div>
              </div>
              <Switch
                id="vibration-toggle"
                checked={audioSettings.vibrationEnabled}
                onCheckedChange={handleVibrationToggle}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                onClick={() => testSound("success")}
                disabled={!audioSettings.enabled}
              >
                Test Success
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => testSound("error")}
                disabled={!audioSettings.enabled}
              >
                Test Error
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Device Info Card */}
        <DeviceInfoCard />
      </div>
    </EmployeePortalLayout>
  );
};

export default CrewSettings;
