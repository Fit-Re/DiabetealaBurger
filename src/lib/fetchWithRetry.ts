/**
 * Unified retry logic for external API calls with timeout and exponential backoff.
 * Used by: LibreLink sync (server-side), Gemini embeddings, PubMed, OCR.space.
 *
 * Configuration is sensible for most external APIs but can be customized per call.
 */

export interface RetryConfig {
  timeoutMs?: number;
  maxAttempts?: number;
  initialBackoffMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: Set<number>;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  timeoutMs: 30_000,
  maxAttempts: 4,
  initialBackoffMs: 1000,
  backoffMultiplier: 2,
  retryableStatuses: new Set([429, 500, 502, 503, 504]),
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry, timeout, and exponential backoff.
 *
 * Retries on:
 * - Network errors (timeout, connection reset)
 * - HTTP 429 (Rate Limit)
 * - HTTP 5xx (Server Errors)
 *
 * Does NOT retry on:
 * - HTTP 4xx except 429 (client errors are permanent)
 * - Successful responses (2xx, 3xx)
 *
 * @example
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   method: 'GET',
 *   headers: { 'Authorization': 'Bearer token' },
 * });
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  config: RetryConfig = {}
): Promise<Response> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;
  let backoffMs = cfg.initialBackoffMs;

  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs);

      let response: Response;
      try {
        response = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeoutId);
      } finally {
        clearTimeout(timeoutId);
      }

      // Non-transient response, return immediately
      if (!cfg.retryableStatuses.has(response.status)) {
        return response;
      }

      // Transient error, retry if not last attempt
      lastError = new Error(
        `HTTP ${response.status} (transient, attempt ${attempt + 1}/${cfg.maxAttempts})`
      );
      if (attempt === cfg.maxAttempts - 1) {
        return response;
      }
    } catch (e) {
      // Network error (timeout, connection reset, etc.)
      const isTimeout = e instanceof Error && e.message?.includes("AbortError");
      lastError = new Error(
        isTimeout
          ? `Timeout after ${cfg.timeoutMs / 1000}s (attempt ${attempt + 1}/${cfg.maxAttempts})`
          : `Network error (attempt ${attempt + 1}/${cfg.maxAttempts}): ${
              e instanceof Error ? e.message : String(e)
            }`
      );

      if (attempt === cfg.maxAttempts - 1) {
        throw lastError;
      }
    }

    // Exponential backoff before retry
    if (attempt < cfg.maxAttempts - 1) {
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * cfg.backoffMultiplier, 32_000);
    }
  }

  throw lastError || new Error("Fetch failed after retries");
}

/**
 * Convenience wrapper for POST requests with retry
 */
export async function postWithRetry(
  url: string,
  body: any,
  headers: HeadersInit = {},
  config?: RetryConfig
): Promise<Response> {
  const contentType =
    typeof body === "string" ? "text/plain" : "application/json";
  return fetchWithRetry(
    url,
    {
      method: "POST",
      headers: { "content-type": contentType, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
    config
  );
}

/**
 * Convenience wrapper for GET requests with retry
 */
export async function getWithRetry(
  url: string,
  headers?: HeadersInit,
  config?: RetryConfig
): Promise<Response> {
  return fetchWithRetry(
    url,
    {
      method: "GET",
      headers,
    },
    config
  );
}
