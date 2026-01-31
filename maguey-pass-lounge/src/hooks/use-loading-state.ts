import { useState, useCallback } from "react";

type LoadingKey = string;

interface UseLoadingStateReturn {
  isLoading: (key: LoadingKey) => boolean;
  startLoading: (key: LoadingKey) => void;
  stopLoading: (key: LoadingKey) => void;
  withLoading: <T>(key: LoadingKey, fn: () => Promise<T>) => Promise<T>;
}

/**
 * useLoadingState Hook
 *
 * Centralized loading state management that supports multiple named loading states.
 * Prevents duplicate submissions and provides consistent loading feedback.
 *
 * Usage:
 * ```tsx
 * const { isLoading, withLoading } = useLoadingState();
 *
 * // Check loading state
 * <LoadingButton isLoading={isLoading('payment')}>Pay</LoadingButton>
 *
 * // Auto-manage loading state for async function
 * await withLoading('payment', async () => {
 *   await processPayment();
 * });
 * ```
 */
export function useLoadingState(): UseLoadingStateReturn {
  const [loadingStates, setLoadingStates] = useState<Set<LoadingKey>>(new Set());

  const isLoading = useCallback(
    (key: LoadingKey) => loadingStates.has(key),
    [loadingStates]
  );

  const startLoading = useCallback((key: LoadingKey) => {
    setLoadingStates((prev) => new Set(prev).add(key));
  }, []);

  const stopLoading = useCallback((key: LoadingKey) => {
    setLoadingStates((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const withLoading = useCallback(
    async <T>(key: LoadingKey, fn: () => Promise<T>): Promise<T> => {
      startLoading(key);
      try {
        return await fn();
      } finally {
        stopLoading(key);
      }
    },
    [startLoading, stopLoading]
  );

  return { isLoading, startLoading, stopLoading, withLoading };
}
