import { useEffect, useRef, useCallback } from "react";

/**
 * Hook that debounces rapid data updates to prevent excessive re-renders.
 * Useful when syncing multiple records at once (e.g., LibreLink bulk import).
 *
 * Usage:
 * const debouncedLoad = useDebouncedData(load, 300);
 * // Call debouncedLoad() multiple times; it will batch into single execution
 */
export function useDebouncedData<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number = 300
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(fn);

  // Keep callback ref in sync
  useEffect(() => {
    callbackRef.current = fn;
  }, [fn]);

  const debouncedFn = useCallback(
    ((...args: any[]) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Schedule new execution
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delayMs);
    }) as T,
    [delayMs]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
}

/**
 * Hook that throttles updates with a minimum delay between executions.
 * For realtime listeners: fire immediately on first call, then batch subsequent
 * calls until delayMs has elapsed.
 *
 * Usage:
 * const throttledUpdate = useThrottledData(setState, 300);
 * // Call many times; actual updates fire max every 300ms
 */
export function useThrottledData<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number = 300
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(fn);
  const pendingArgsRef = useRef<any[] | null>(null);

  useEffect(() => {
    callbackRef.current = fn;
  }, [fn]);

  const throttledFn = useCallback(
    ((...args: any[]) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delayMs) {
        // Execute immediately
        lastCallRef.current = now;
        callbackRef.current(...args);
        pendingArgsRef.current = null;

        // Clear any pending execution
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      } else {
        // Schedule execution after remaining delay
        pendingArgsRef.current = args;

        if (!timeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            if (pendingArgsRef.current) {
              lastCallRef.current = Date.now();
              callbackRef.current(...pendingArgsRef.current);
            }
            timeoutRef.current = null;
            pendingArgsRef.current = null;
          }, delayMs - timeSinceLastCall);
        }
      }
    }) as T,
    [delayMs]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledFn;
}
