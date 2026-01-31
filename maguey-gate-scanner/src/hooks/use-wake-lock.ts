import { useWakeLock as useWakeLockLib } from 'react-screen-wake-lock';
import { useEffect } from 'react';

/**
 * Custom wake lock hook that:
 * 1. Requests wake lock on mount when active
 * 2. Releases on unmount
 * 3. Re-acquires when tab becomes visible (per RESEARCH pitfall #3)
 */
export function useWakeLock(isActive: boolean = true) {
  const { isSupported, released, request, release } = useWakeLockLib({
    onRelease: () => console.log('[WakeLock] Released'),
    onError: (err) => console.warn('[WakeLock] Error:', err),
  });

  // Request wake lock when active
  useEffect(() => {
    if (isActive && isSupported) {
      request();
    }
    return () => {
      if (!released) {
        release();
      }
    };
  }, [isActive, isSupported, request, release, released]);

  // Re-acquire on visibility change (tab switch back)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isActive && isSupported) {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isActive, isSupported, request]);

  return {
    isSupported,
    isLocked: !released,
  };
}
