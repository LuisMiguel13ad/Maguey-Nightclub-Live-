import { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  TrendingUp,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  getSyncHistory, 
  getFailedScans,
  type SyncStatus,
  type SyncHistoryEntry 
} from '@/lib/sync-status-service';
import { formatDistanceToNow } from 'date-fns';

interface SyncDetailsPanelProps {
  syncStatus: SyncStatus;
  onManualSync: () => void;
  isSyncing: boolean;
}

export const SyncDetailsPanel = ({ 
  syncStatus, 
  onManualSync, 
  isSyncing 
}: SyncDetailsPanelProps) => {
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [failedScans, setFailedScans] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingHistory(true);
      try {
        const [history, failed] = await Promise.all([
          getSyncHistory(20),
          getFailedScans(),
        ]);
        setSyncHistory(history);
        setFailedScans(failed);
      } catch (error) {
        console.error('[SyncDetailsPanel] Error loading data:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadData();
    
    // Refresh every 3 seconds
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never';
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const formatDuration = (ms: number | null): string => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const nextSyncCountdown = syncStatus.nextAutoSyncIn 
    ? `${syncStatus.nextAutoSyncIn}s`
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Column: Current Status */}
      <div className="space-y-4">
        {/* Connection Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {syncStatus.isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  Connection Status
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-600" />
                  Connection Status
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={syncStatus.isOnline ? 'default' : 'destructive'}>
                {syncStatus.isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            {syncStatus.lastSyncedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Synced</span>
                <span className="text-sm font-medium">
                  {formatTimeAgo(syncStatus.lastSyncedAt)}
                </span>
              </div>
            )}
            {nextSyncCountdown && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Next Auto-Sync</span>
                <span className="text-sm font-medium text-orange-600">
                  in {nextSyncCountdown}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Queue Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Queue Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pending</span>
                <Badge variant="secondary" className="bg-orange-500/20 text-orange-600">
                  {syncStatus.pending}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Syncing</span>
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                  {syncStatus.syncing}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Synced</span>
                <Badge variant="default" className="bg-green-500/20 text-green-600">
                  {syncStatus.synced}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Failed</span>
                <Badge variant="destructive">
                  {syncStatus.failed}
                </Badge>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="text-sm font-bold">{syncStatus.total}</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Sync Health</span>
                  <span className="font-medium">{syncStatus.syncHealthScore.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={syncStatus.syncHealthScore} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual Sync */}
        {syncStatus.isOnline && (syncStatus.pending > 0 || syncStatus.failed > 0) && (
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={onManualSync}
                disabled={isSyncing}
                className="w-full"
                variant="default"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column: History & Failed Scans */}
      <div className="space-y-4">
        {/* Failed Scans */}
        {failedScans.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Failed Scans ({failedScans.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {failedScans.slice(0, 10).map((scan) => (
                    <div
                      key={scan.id}
                      className="p-2 rounded-md bg-destructive/5 border border-destructive/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {scan.ticketId || scan.ticketIdString || 'Unknown'}
                          </div>
                          {scan.errorMessage && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {scan.errorMessage}
                            </div>
                          )}
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          Retry {scan.retryCount}/10
                        </Badge>
                      </div>
                      {scan.lastRetryAt && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(new Date(scan.lastRetryAt))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Sync History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4" />
              Sync History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center h-48">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : syncHistory.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                No sync history yet
              </div>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {syncHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-2 rounded-md border border-primary/10 hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                entry.status === 'success'
                                  ? 'default'
                                  : entry.status === 'partial'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                              className="text-xs"
                            >
                              {entry.syncType}
                            </Badge>
                            {entry.status === 'success' && (
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            )}
                            {entry.status === 'partial' && (
                              <AlertCircle className="h-3 w-3 text-yellow-600" />
                            )}
                            {entry.status === 'failed' && (
                              <XCircle className="h-3 w-3 text-red-600" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {entry.scansProcessed} processed • {entry.scansSucceeded} succeeded
                            {entry.scansFailed > 0 && ` • ${entry.scansFailed} failed`}
                          </div>
                          {entry.syncSpeedScansPerSec && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {entry.syncSpeedScansPerSec.toFixed(1)} scans/sec
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            {formatTimeAgo(entry.startedAt)}
                          </div>
                          {entry.durationMs && (
                            <div className="text-xs text-muted-foreground">
                              {formatDuration(entry.durationMs)}
                            </div>
                          )}
                        </div>
                      </div>
                      {entry.errorMessage && (
                        <div className="text-xs text-red-600 mt-1 line-clamp-1">
                          {entry.errorMessage}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

