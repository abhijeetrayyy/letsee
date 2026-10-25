/**
 * Unified TMDB fetch for Server Components and API routes.
 * Uses central tmdbClient (throttle + retry) for all TMDB calls.
 */

import { fetchTmdb, tmdbConfigured } from "@/utils/tmdbClient";

export type TmdbResult<T> = {
  data: T | null;
  error?: string;
  /** TMDB's HTTP status when it answered with an error; absent on a timeout or network failure. */
  status?: number;
};

/**
 * Whether TMDB said the thing doesn't exist — the one failure a page may show
 * as "not found" and let be cached. Anything else (a timeout, a 5xx, a 429)
 * is passing, and a page should throw on it: Next caches neither a thrown
 * render nor its error page, so the next visit simply tries again.
 */
export function tmdbMissing(result: TmdbResult<unknown>): boolean {
  return result.status === 404;
}

export type TmdbFetchOptions = RequestInit & {
  /** Next.js revalidate in seconds (ISR). Ignored if cache is "no-store". */
  revalidate?: number;
  /** "force-cache" (default) or "no-store". */
  cache?: "force-cache" | "no-store";
  /** Request timeout in ms. Default 6000 (tmdbClient). */
  timeoutMs?: number;
  /** Max attempts (including the first). Default 3, and a second timeout ends it (tmdbClient). */
  maxAttempts?: number;
};

export async function tmdbFetchJson<T>(
  url: string,
  label: string,
  init?: TmdbFetchOptions
): Promise<TmdbResult<T>> {
  if (!tmdbConfigured()) {
    return { data: null, error: `${label}: TMDB_READ_TOKEN is missing.` };
  }

  try {
    const response = await fetchTmdb(url, {
      ...init,
      revalidate: init?.revalidate,
      cache: init?.cache,
      timeoutMs: init?.timeoutMs,
      maxAttempts: init?.maxAttempts,
    });

    if (!response.ok) {
      return {
        data: null,
        error: `${label}: ${response.status} ${response.statusText}`,
        status: response.status,
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
    return { data: null, error: `${label}: ${withCause}` };
  }
}
