import { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2,
  WifiOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  getCurrentSyncStatus, 
  subscribeToSyncStatus, 
  startSyncStatusMonitoring,
  stopSyncStatusMonitoring,
  performManualSync,
  type SyncStatus 
} from '@/lib/sync-status-service';
import { SyncDetailsPanel } from './SyncDetailsPanel';
import { useToast } from '@/hooks/use-toast';

export const SyncStatusIndicator = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Start monitoring on mount
    startSyncStatusMonitoring();

    // Subscribe to status updates
    const unsubscribe = subscribeToSyncStatus(({ status }) => {
      setSyncStatus(status);
    });

    // Initial load
    getCurrentSyncStatus().then(setSyncStatus);

    return () => {
      unsubscribe();
      stopSyncStatusMonitoring();
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncing || !syncStatus?.isOnline) return;

    setIsSyncing(true);
    try {
      const result = await performManualSync();
      
      if (result.total === 0) {
        toast({
          title: 'All Synced',
          description: 'No pending scans to sync.',
        });
      } else if (result.failed === 0) {
        toast({
          title: 'Sync Complete',
          description: `Successfully synced ${result.success} scan${result.success !== 1 ? 's' : ''}.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Partial Sync',
          description: `Synced ${result.success} of ${result.total} scans. ${result.failed} failed.`,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error.message || 'Failed to sync scans. Please try again.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!syncStatus) {
    return null;
  }

  // Determine status color and icon
  const getStatusConfig = () => {
    if (!syncStatus.isOnline) {
      return {
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/20',
        icon: WifiOff,
        label: 'Offline',
        badgeVariant: 'secondary' as const,
      };
    }

    switch (syncStatus.status) {
      case 'synced':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-500/20',
          icon: CheckCircle2,
          label: 'Synced',
          badgeVariant: 'default' as const,
        };
      case 'syncing':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-500/20',
          icon: RefreshCw,
          label: 'Syncing...',
          badgeVariant: 'secondary' as const,
        };
      case 'pending':
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-500/20',
          icon: Cloud,
          label: `${syncStatus.pending} pending`,
          badgeVariant: 'secondary' as const,
        };
      case 'failed':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-500/20',
          icon: AlertCircle,
          label: `${syncStatus.failed} failed`,
          badgeVariant: 'destructive' as const,
        };
      default:
        return {
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/20',
          icon: Cloud,
          label: 'Unknown',
          badgeVariant: 'secondary' as const,
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;
  const pendingCount = syncStatus.pending + syncStatus.failed;
  const showBadge = pendingCount > 0 || syncStatus.status === 'syncing';

  const detailsPanelHeight = isExpanded ? 'auto' : '0';

  return (
    <>
      <div className="sticky top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-primary/10 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-12 gap-4">
            {/* Status Indicator */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'h-auto p-2 hover:bg-transparent flex-shrink-0',
                'flex items-center gap-2',
                statusConfig.color
              )}
            >
              <div className={cn('p-1.5 rounded-md', statusConfig.bgColor)}>
                <StatusIcon 
                  className={cn('h-4 w-4', statusConfig.color)}
                  style={syncStatus.status === 'syncing' ? { animation: 'spin 1s linear infinite' } : undefined}
                />
              </div>
              <span className="text-sm font-medium hidden sm:inline whitespace-nowrap">
                {statusConfig.label}
              </span>
              {showBadge && (
                <Badge 
                  variant={statusConfig.badgeVariant}
                  className="text-xs h-5 px-1.5 flex-shrink-0"
                >
                  {syncStatus.status === 'syncing' 
                    ? syncStatus.syncing 
                    : pendingCount}
                </Badge>
              )}
              {syncStatus.syncHealthScore < 100 && (
                <span className="text-xs text-muted-foreground hidden lg:inline whitespace-nowrap">
                  {syncStatus.syncHealthScore.toFixed(1)}% synced
                </span>
              )}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 ml-1 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
              )}
            </Button>

            {/* Manual Sync Button */}
            {syncStatus.isOnline && pendingCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="h-8 flex-shrink-0 whitespace-nowrap"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                    <span className="hidden sm:inline">Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2" />
                    <span className="hidden sm:inline">Sync Now</span>
                    <span className="sm:hidden">Sync</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Details Panel */}
      {isExpanded && (
        <div className="sticky top-28 left-0 right-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-primary/10 shadow-lg max-h-[calc(100vh-7rem)] overflow-y-auto">
          <div className="container mx-auto px-4 py-4">
            <SyncDetailsPanel 
              syncStatus={syncStatus}
              onManualSync={handleManualSync}
              isSyncing={isSyncing}
            />
          </div>
        </div>
      )}

      {/* Spacer to prevent content overlap */}
      <div className={cn('transition-all duration-200', isExpanded ? 'h-[500px]' : 'h-12')} />
    </>
  );
};

