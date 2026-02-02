/**
 * Server-side fetch with timeout and retry for API routes calling external APIs
 * (e.g. TMDB). Use tmdbFetchJson for TMDB in Server Components; use this in
 * API routes when you need a plain fetch with retry/timeout.
 */

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ServerFetchOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
};

export async function serverFetch(
  url: string,
  options: ServerFetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    ...init
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok && attempt < retries && RETRYABLE_STATUS.has(response.status)) {
        const retryAfter =
          Number(response.headers.get("Retry-After")) || attempt * 500;
        await sleep(retryAfter);
        continue;
      }

      clearTimeout(timeout);
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        await sleep(attempt * 500);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("Fetch failed");
}

/**
 * Fetch JSON from URL with timeout and retry. Throws on non-OK or parse error.
 */
export async function serverFetchJson<T>(
  url: string,
  options: ServerFetchOptions = {}
): Promise<T> {
  const response = await serverFetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}
