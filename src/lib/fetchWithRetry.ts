// Shared retry + timeout logic for resilient network requests
// Used by: gemini.ts, sync-health-data Edge Function, and other API clients

export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000; // 60 seconds
export const DEFAULT_MAX_ATTEMPTS = 4;
export const DEFAULT_INITIAL_BACKOFF_MS = 1_000;
export const DEFAULT_BACKOFF_MULTIPLIER = 2;
export const DEFAULT_MAX_BACKOFF_MS = 32_000;

// HTTP status codes that are transient (safe to retry)
export const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchWithRetryOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  initialBackoffMs?: number;
  backoffMultiplier?: number;
  maxBackoffMs?: number;
  retryableStatuses?: Set<number>;
}

export interface FetchRetryError extends Error {
  lastHttpStatus?: number;
  attemptsExhausted: boolean;
}

/**
 * Fetch with automatic retry on transient errors and timeout handling.
 *
 * Retries on:
 * - Network timeouts (AbortController signal)
 * - Transient HTTP errors (429, 5xx)
 *
 * Does NOT retry on:
 * - Non-transient errors (400, 401, 403, 404)
 * - Fatal errors (auth, malformed request)
 *
 * @param url Request URL
 * @param options Request init options
 * @param config Retry configuration
 * @returns Response object
 * @throws FetchRetryError if all retries exhausted or non-transient error occurs
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: FetchWithRetryOptions = {}
): Promise<Response> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialBackoffMs = config.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
  const backoffMultiplier = config.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;
  const maxBackoffMs = config.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  const retryableStatuses = config.retryableStatuses ?? TRANSIENT_STATUS;

  let lastError: FetchRetryError | null = null;
  let backoffMs = initialBackoffMs;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter to avoid thundering herd
      const jitter = Math.random() * 400;
      const delay = Math.min(backoffMs + jitter, maxBackoffMs);
      await sleep(delay);
      backoffMs = Math.min(backoffMs * backoffMultiplier, maxBackoffMs);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Non-transient error: fail immediately without retrying
      if (!retryableStatuses.has(response.status)) {
        return response;
      }

      // Transient error: prepare to retry if attempts remain
      const error: FetchRetryError = new Error(
        `HTTP ${response.status} (transient, attempt ${attempt + 1}/${maxAttempts})`
      ) as FetchRetryError;
      error.lastHttpStatus = response.status;
      error.attemptsExhausted = attempt === maxAttempts - 1;
      lastError = error;

      if (attempt === maxAttempts - 1) {
        return response; // Return the last response after all retries
      }
    } catch (e) {
      clearTimeout(timeoutId);

      const message =
        e instanceof Error
          ? `Network error (attempt ${attempt + 1}/${maxAttempts}): ${e.message}`
          : `Network error (attempt ${attempt + 1}/${maxAttempts})`;

      const error: FetchRetryError = new Error(message) as FetchRetryError;
      error.attemptsExhausted = attempt === maxAttempts - 1;
      lastError = error;

      if (attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }

  throw (
    lastError ||
    new Error(`Fetch failed after ${maxAttempts} attempts`)
  );
}
