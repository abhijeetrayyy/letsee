/**
 * Unified TMDB fetch for Server Components and API routes.
 * - Retry on 429, 5xx; timeout; consistent error shape.
 * - Configurable cache and revalidate for best UX and performance.
 */

export type TmdbResult<T> = {
  data: T | null;
  error?: string;
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export const tmdbKeyMissing = () => !TMDB_API_KEY;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type TmdbFetchOptions = RequestInit & {
  /** Next.js revalidate in seconds (ISR). Ignored if cache is "no-store". */
  revalidate?: number;
  /** "force-cache" (default) or "no-store". */
  cache?: "force-cache" | "no-store";
  /** Request timeout in ms. Default 12000. */
  timeoutMs?: number;
  /** Max retry attempts (including first). Default 2. */
  maxAttempts?: number;
};

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_ATTEMPTS = 2;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export async function tmdbFetchJson<T>(
  url: string,
  label: string,
  init?: TmdbFetchOptions
): Promise<TmdbResult<T>> {
  if (!TMDB_API_KEY) {
    return { data: null, error: `${label}: TMDB_API_KEY is missing.` };
  }

  const {
    revalidate,
    cache = "force-cache",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    ...restInit
  } = init ?? {};

  const nextOptions =
    cache === "no-store"
      ? { cache: "no-store" as RequestCache }
      : revalidate != null
        ? { next: { revalidate } }
        : { cache: "force-cache" as RequestCache };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...nextOptions,
        ...restInit,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (attempt < maxAttempts && RETRYABLE_STATUS.has(response.status)) {
          const retryAfter =
            Number(response.headers.get("Retry-After")) || attempt * 500;
          await sleep(retryAfter);
          continue;
        }
        return {
          data: null,
          error: `${label}: ${response.status} ${response.statusText}`,
        };
      }

      const data = (await response.json()) as T;
      return { data };
    } catch (error) {
      const err = error as Error & { cause?: { code?: string } };
      const message =
        err.name === "AbortError"
          ? "Request timed out"
          : err.message || "Fetch failed";
      const withCause = err.cause?.code
        ? `${message} (${err.cause.code})`
        : message;

      if (attempt < maxAttempts) {
        await sleep(attempt * 500);
        continue;
      }

      return { data: null, error: `${label}: ${withCause}` };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { data: null, error: `${label}: Fetch failed` };
}
