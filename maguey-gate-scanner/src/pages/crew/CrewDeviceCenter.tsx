import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmployeePortalLayout from "@/components/layout/EmployeePortalLayout";
import { DeviceInfoCard } from "@/components/settings/DeviceInfoCard";
import { SyncDetailsPanel } from "@/components/dashboard/SyncDetailsPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  clearOldSyncedScans,
} from "@/lib/offline-queue-service";
import {
  AlertTriangle,
  HardDrive,
  RefreshCw,
  WifiOff,
  CheckCircle2,
  QrCode,
} from "lucide-react";

const CrewDeviceCenter = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const role = useRole();

  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [localQueue, setLocalQueue] = useState<QueuedScan[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (role === "owner") {
      navigate("/devices");
      return;
    }
  }, [authLoading, user, role, navigate]);

  const loadSyncData = async () => {
    try {
      const [status, queue] = await Promise.all([getCurrentSyncStatus(), getPendingScans()]);
      setSyncStatus(status);
      setLocalQueue(queue);
    } catch (error) {
      console.error("[CrewDeviceCenter] Failed to load sync status:", error);
    }
  };

  useEffect(() => {
    loadSyncData();
    const interval = setInterval(loadSyncData, 5000);
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
        description: error.message || "Unable to sync scans. Try again once online.",
      });
    } finally {
      setIsSyncing(false);
      loadSyncData();
    }
  };

  const handleCleanup = async () => {
    setClearing(true);
    try {
      const cleared = await clearOldSyncedScans();
      toast({
        title: "Queue trimmed",
        description: `Removed ${cleared} old synced scans.`,
      });
    } catch (error) {
      console.error("[CrewDeviceCenter] Failed to clear queue:", error);
    } finally {
      setClearing(false);
      loadSyncData();
    }
  };

  const heroSection =
    syncStatus && (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white shadow-lg">
        <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-purple-200/70">Pending</p>
            <p className="text-3xl font-semibold">{syncStatus.pending}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-purple-200/70">Failed</p>
            <p className="text-3xl font-semibold">{syncStatus.failed}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-purple-200/70">Synced</p>
            <p className="text-3xl font-semibold">{syncStatus.synced}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-purple-200/70">Health</p>
            <p className="text-3xl font-semibold">{syncStatus.syncHealthScore.toFixed(0)}%</p>
          </div>
        </div>
      </div>
    );

  const headerActions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Button
        size="sm"
        variant="secondary"
        className="w-full bg-white/10 text-white hover:bg-white/20 sm:w-auto"
        onClick={() => navigate("/scanner")}
      >
        <QrCode className="mr-2 h-4 w-4" />
        Scanner
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="w-full border-white/30 text-white hover:bg-white/10 sm:w-auto"
        onClick={handleManualSync}
        disabled={isSyncing}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing ? "Syncing..." : "Sync now"}
      </Button>
    </div>
  );

  return (
    <EmployeePortalLayout
      title="Device & Sync Center"
      subtitle="Crew suite • Device readiness"
      description="Monitor your scanner health, offline queue, and sync history."
      actions={headerActions}
      hero={heroSection}
    >
      <div className="space-y-6">
        <DeviceInfoCard />

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <HardDrive className="h-4 w-4" />
              Offline queue
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              These scans live locally until we hit the network.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Pending</p>
                <p className="text-2xl font-semibold">{queueSummary.pending}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Failed</p>
                <p className="text-2xl font-semibold text-amber-300">{queueSummary.failed}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Total stored</p>
                <p className="text-2xl font-semibold">{localQueue.length}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/10 text-white hover:bg-white/20"
                onClick={handleManualSync}
                disabled={isSyncing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync now"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={handleCleanup}
                disabled={clearing}
              >
                {clearing ? "Clearing..." : "Trim synced scans"}
              </Button>
            </div>

            {localQueue.length > 0 ? (
              <ScrollArea className="h-40 rounded-lg border border-white/10 bg-white/5">
                <div className="divide-y divide-white/5">
                  {localQueue.slice(0, 6).map((scan) => (
                    <div key={scan.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{scan.ticketId || scan.ticketIdString}</span>
                        <Badge
                          variant={scan.syncStatus === "failed" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {scan.syncStatus}
                        </Badge>
                      </div>
                      <p className="text-xs text-purple-100/70">
                        Added {new Date(scan.scannedAt).toLocaleTimeString()}
                      </p>
                      {scan.errorMessage && (
                        <p className="text-xs text-red-300">{scan.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-purple-100/80">No queued scans. Great job staying synced.</p>
            )}
          </CardContent>
        </Card>

        {syncStatus && (
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                {syncStatus.isOnline ? (
                  <CheckCircle2 className="h-4 w-4 text-green-300" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-300" />
                )}
                Sync diagnostics
              </CardTitle>
              <CardDescription className="text-purple-100/70">
                Detailed feed of sync history, failures, and cadence.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-foreground">
              <SyncDetailsPanel
                syncStatus={syncStatus}
                onManualSync={handleManualSync}
                isSyncing={isSyncing}
              />
            </CardContent>
          </Card>
        )}

        {!syncStatus && (
          <Card className="border-white/10 bg-white/5 text-white">
            <CardContent className="flex items-center gap-3 py-6">
              <AlertTriangle className="h-6 w-6 text-amber-300" />
              <div>
                <p className="font-semibold">Waiting for sync metrics</p>
                <p className="text-sm text-purple-100/80">
                  Keep the app open for a moment while we gather device telemetry.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </EmployeePortalLayout>
  );
};

export default CrewDeviceCenter;


