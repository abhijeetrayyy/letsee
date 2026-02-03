/**
 * Unified TMDB fetch for Server Components and API routes.
 * Uses central tmdbClient (throttle + retry) for all TMDB calls.
 */

import { fetchTmdb } from "@/utils/tmdbClient";

export type TmdbResult<T> = {
  data: T | null;
  error?: string;
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export const tmdbKeyMissing = () => !TMDB_API_KEY;

export type TmdbFetchOptions = RequestInit & {
  /** Next.js revalidate in seconds (ISR). Ignored if cache is "no-store". */
  revalidate?: number;
  /** "force-cache" (default) or "no-store". */
  cache?: "force-cache" | "no-store";
  /** Request timeout in ms. Default 12000. */
  timeoutMs?: number;
  /** Max retry attempts (including first). Default 3 (via tmdbClient). */
  maxAttempts?: number;
};

export async function tmdbFetchJson<T>(
  url: string,
  label: string,
  init?: TmdbFetchOptions
): Promise<TmdbResult<T>> {
  if (!TMDB_API_KEY) {
    return { data: null, error: `${label}: TMDB_API_KEY is missing.` };
  }

  try {
    const response = await fetchTmdb(url, {
      ...init,
      revalidate: init?.revalidate,
      cache: init?.cache,
      timeoutMs: init?.timeoutMs ?? 12000,
      maxAttempts: init?.maxAttempts ?? 3,
    });

    if (!response.ok) {
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
    return { data: null, error: `${label}: ${withCause}` };
  }
}
