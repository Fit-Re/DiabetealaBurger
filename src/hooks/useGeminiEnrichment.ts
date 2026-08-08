import { useEffect, useRef, useState } from "react";
import { runBackgroundEnrichment } from "../lib/autoEnrich";
import type { PatternFinding } from "../types";

export interface UseGeminiEnrichmentState {
  isLoading: boolean;
  isTimeout: boolean;
  elapsedSeconds: number;
  error: Error | null;
}

/**
 * Hook that manages Gemini enrichment with timeout feedback.
 * Shows UI after 30s, cancels after 60s if no response.
 *
 * Usage:
 * const { isLoading, isTimeout, elapsedSeconds, retry } = useGeminiEnrichment();
 * // Show modal if isLoading and elapsedSeconds > 30
 */
export function useGeminiEnrichment() {
  const [state, setState] = useState<UseGeminiEnrichmentState>({
    isLoading: false,
    isTimeout: false,
    elapsedSeconds: 0,
    error: null,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startEnrichment = async (patterns: PatternFinding[]) => {
    setState({
      isLoading: true,
      isTimeout: false,
      elapsedSeconds: 0,
      error: null,
    });

    abortControllerRef.current = new AbortController();
    let timerStarted = false;

    timerRef.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        elapsedSeconds: prev.elapsedSeconds + 1,
        isTimeout: prev.elapsedSeconds + 1 > 60,
      }));

      // Cancel after 60s
      if (!timerStarted && timerStarted === false) {
        timerStarted = true;
      }
    }, 1000);

    try {
      // Start enrichment task
      const enrichmentPromise = runBackgroundEnrichment(patterns);

      // Race against 60s timeout
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Gemini enrichment timeout (60s)"));
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
        }, 60000);
      });

      await Promise.race([enrichmentPromise, timeoutPromise]);

      // Success
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: e instanceof Error ? e : new Error("Unknown error"),
      }));
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const retry = async (patterns: PatternFinding[]) => {
    await startEnrichment(patterns);
  };

  const dismiss = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      isLoading: false,
      isTimeout: false,
      elapsedSeconds: 0,
      error: null,
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startEnrichment,
    retry,
    dismiss,
  };
}
