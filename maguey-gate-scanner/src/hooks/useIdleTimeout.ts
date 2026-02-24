import { useCallback, useEffect, useRef, useState } from 'react';

interface UseIdleTimeoutConfig {
  timeoutMinutes: number;
  warningMinutes?: number;
  enabled: boolean;
  onIdle: () => void;
}

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;
const CHECK_INTERVAL_MS = 15_000;
const COUNTDOWN_INTERVAL_MS = 1_000;
const DEBOUNCE_MS = 1_000;
const STORAGE_KEY = 'maguey_idle_last_activity';

export function useIdleTimeout({ timeoutMinutes, warningMinutes = 5, enabled, onIdle }: UseIdleTimeoutConfig) {
  const [isWarningShown, setIsWarningShown] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const lastActivityRef = useRef(Date.now());
  const lastDebounceRef = useRef(0);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onIdleRef = useRef(onIdle);
  const firedRef = useRef(false);

  onIdleRef.current = onIdle;

  const timeoutMs = timeoutMinutes * 60 * 1_000;
  const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1_000;

  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastDebounceRef.current < DEBOUNCE_MS) return;
    lastDebounceRef.current = now;
    lastActivityRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  const resetTimer = useCallback(() => {
    recordActivity();
    setIsWarningShown(false);
    setRemainingSeconds(0);
    firedRef.current = false;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [recordActivity]);

  const dismissWarning = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Start per-second countdown when warning appears
  useEffect(() => {
    if (isWarningShown && !countdownIntervalRef.current) {
      countdownIntervalRef.current = setInterval(() => {
        const idleMs = Date.now() - lastActivityRef.current;
        const left = Math.max(0, Math.ceil((timeoutMs - idleMs) / 1_000));
        setRemainingSeconds(left);
        if (left <= 0 && !firedRef.current) {
          firedRef.current = true;
          onIdleRef.current();
        }
      }, COUNTDOWN_INTERVAL_MS);
    }
    if (!isWarningShown && countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [isWarningShown, timeoutMs]);

  // Main effect: attach listeners and start check interval
  useEffect(() => {
    if (!enabled) {
      // Clean up everything when disabled
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      checkIntervalRef.current = null;
      countdownIntervalRef.current = null;
      setIsWarningShown(false);
      firedRef.current = false;
      return;
    }

    // Reset baseline when enabling
    lastActivityRef.current = Date.now();
    firedRef.current = false;

    // Attach passive activity listeners
    const handler = () => recordActivity();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handler, { passive: true });
    }

    // Listen for activity from other tabs
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const ts = Number(e.newValue);
        if (ts > lastActivityRef.current) {
          lastActivityRef.current = ts;
          lastDebounceRef.current = ts;
          // If we were showing warning but another tab had activity, dismiss it
          setIsWarningShown(false);
          firedRef.current = false;
        }
      }
    };
    window.addEventListener('storage', storageHandler);

    // Visibility change: check if timed out while tab was hidden
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        const idleMs = Date.now() - lastActivityRef.current;
        if (idleMs >= timeoutMs && !firedRef.current) {
          firedRef.current = true;
          onIdleRef.current();
        }
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    // 15-second check interval
    checkIntervalRef.current = setInterval(() => {
      if (firedRef.current) return;
      const idleMs = Date.now() - lastActivityRef.current;

      if (idleMs >= timeoutMs) {
        firedRef.current = true;
        onIdleRef.current();
      } else if (idleMs >= warningMs) {
        setIsWarningShown(true);
        const left = Math.max(0, Math.ceil((timeoutMs - idleMs) / 1_000));
        setRemainingSeconds(left);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handler);
      }
      window.removeEventListener('storage', storageHandler);
      document.removeEventListener('visibilitychange', visibilityHandler);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [enabled, timeoutMs, warningMs, recordActivity]);

  return { resetTimer, dismissWarning, isWarningShown, remainingSeconds };
}
