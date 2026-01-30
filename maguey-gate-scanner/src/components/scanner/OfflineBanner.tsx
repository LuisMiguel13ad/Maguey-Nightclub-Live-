/**
 * OfflineBanner - Prominent offline mode indicator
 *
 * Per context decision: "Prominent 'OFFLINE MODE' banner always visible when disconnected"
 * - Orange background for unmistakable visibility
 * - Shows pending sync count
 * - Always visible when offline (not dismissible)
 */

import { useState, useEffect, useRef } from 'react';
import { WifiOff, Upload } from 'lucide-react';
import { getSyncStatus } from '@/lib/offline-queue-service';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className }: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const mountedRef = useRef(true);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      if (mountedRef.current) {
        setIsOnline(true);
      }
    };
    const handleOffline = () => {
      if (mountedRef.current) {
        setIsOnline(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending count periodically
  useEffect(() => {
    const updatePending = async () => {
      try {
        const status = await getSyncStatus();
        if (mountedRef.current) {
          setPendingCount(status.pending + status.failed);
        }
      } catch (error) {
        console.error('[OfflineBanner] Failed to get sync status:', error);
      }
    };

    updatePending();
    const interval = setInterval(updatePending, 3000);
    return () => clearInterval(interval);
  }, []);

  // Only show when offline
  if (isOnline) return null;

  return (
    <div
      className={cn(
        'bg-orange-500 text-white px-4 py-3 flex items-center justify-center gap-3',
        'animate-pulse', // Subtle attention-grabbing animation
        className
      )}
    >
      <WifiOff className="w-5 h-5 flex-shrink-0" />
      <span className="font-bold text-lg tracking-wide">OFFLINE MODE</span>
      {pendingCount > 0 && (
        <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-sm">
          <Upload className="w-3 h-3" />
          <span>{pendingCount} pending</span>
        </div>
      )}
    </div>
  );
}

export default OfflineBanner;
