/**
 * Central TMDB fetch with rate limiting and robust retry.
 * All TMDB requests across the app should go through fetchTmdb so we:
 * - Authenticate with a bearer header, never a key in the URL
 * - Stay under ~40 req/s (throttle: max concurrent + min gap between starts)
 * - Retry on 429/5xx with backoff and Respect Retry-After
 * - Use consistent timeout and error handling
 */

const TMDB_BASE = "https://api.themoviedb.org";

/**
 * TMDB's "API Read Access Token" (themoviedb.org → Settings → API), sent as
 * `Authorization: Bearer`. It authenticates every v3 endpoint exactly as the
 * old `?api_key=` did.
 *
 * The key used to ride in the query string, and a URL is not a place a secret
 * survives. Next prints the full fetch URL whenever it can't write a response
 * to the data cache — anything over 2MB as Next measures it, which `/tv/2734`
 * with `aggregate_credits` was at 3.7MB — so the key went into the server log
 * and, on Vercel, into production logs. Headers are never printed there; Next
 * only hashes them into the fetch cache key, which stays stable for as long as
 * the token does.
 */
function readToken(): string | undefined {
  return process.env.TMDB_READ_TOKEN?.trim() || undefined;
}

/** Whether TMDB can be called at all. Replaces checks on the old key. */
export function tmdbConfigured(): boolean {
  return readToken() !== undefined;
}

let warnedUnconfigured = false;

/**
 * Drop an `api_key` a caller still put in the URL. Nothing in the app builds
 * one any more; this keeps a stale call site from reintroducing the leak.
 */
function withoutApiKey(url: string): string {
  if (!url.includes("api_key")) return url;
  const parsed = new URL(url);
  parsed.searchParams.delete("api_key");
  return parsed.toString();
}

/** Throttle: max concurrent TMDB requests (stay under ~40/s per IP) */
const MAX_CONCURRENT = 8;
/** Min ms between starting new requests to smooth bursts */
const MIN_GAP_MS = 120;
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// In-memory throttle state (shared across all TMDB calls in this process)
let inFlight = 0;
let lastStartTime = 0;
const waitQueue: Array<() => void> = [];

function scheduleNext(): void {
  if (waitQueue.length === 0 || inFlight >= MAX_CONCURRENT) return;
  const now = Date.now();
  const elapsed = now - lastStartTime;
  if (elapsed < MIN_GAP_MS) {
    setTimeout(scheduleNext, MIN_GAP_MS - elapsed);
    return;
  }
  const next = waitQueue.shift();
  if (next) next();
}

/** Wait for a throttle slot before starting a TMDB request */
function waitForSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT && (lastStartTime === 0 || Date.now() - lastStartTime >= MIN_GAP_MS)) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(resolve);
    scheduleNext();
  });
}

function releaseSlot(): void {
  inFlight = Math.max(0, inFlight - 1);
  scheduleNext();
}

export type TmdbClientOptions = RequestInit & {
  /** Request timeout in ms. Default 12000 */
  timeoutMs?: number;
  /** Max retry attempts (including first). Default 3 */
  maxAttempts?: number;
  /** Next.js revalidate in seconds (ISR). Omit for API routes. */
  revalidate?: number;
  /** Next.js cache. Default "force-cache" when revalidate set, else no-store for API routes */
  cache?: "force-cache" | "no-store";
};

export function isTmdbUrl(url: string): boolean {
  try {
    return new URL(url).origin === "https://api.themoviedb.org";
  } catch {
    return url.includes(TMDB_BASE);
  }
}

/**
 * Perform a single TMDB request with throttle, retry, and timeout.
 * Use this (or tmdbFetchJson in tmdb.ts) for all TMDB calls site-wide.
 */
export async function fetchTmdb(
  url: string,
  options: TmdbClientOptions = {}
): Promise<Response> {
  if (!isTmdbUrl(url)) {
    return fetch(url, options);
  }

  const token = readToken();
  if (!token) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.error("TMDB_READ_TOKEN is not set; TMDB requests are disabled.");
    }
    // Answered here rather than sent unauthenticated: every caller already
    // handles a non-OK response, and TMDB would only say 401 anyway.
    return new Response(null, { status: 401, statusText: "TMDB_READ_TOKEN is not set" });
  }

  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    revalidate,
    cache = revalidate != null ? "force-cache" : "no-store",
    ...restInit
  } = options;

  const target = withoutApiKey(url);
  // Built the same way on every call so Next's fetch cache key — URL plus
  // headers — is identical for identical requests.
  const headers = new Headers(restInit.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const nextOptions: RequestInit =
    cache === "no-store"
      ? { cache: "no-store" as RequestCache }
      : revalidate != null
        ? { next: { revalidate } }
        : { cache: "force-cache" as RequestCache };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await waitForSlot();
    inFlight++;
    lastStartTime = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(target, {
        ...nextOptions,
        ...restInit,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      releaseSlot();

      if (!response.ok) {
        if (attempt < maxAttempts && RETRYABLE_STATUS.has(response.status)) {
          const retryAfter =
            response.status === 429
              ? Number(response.headers.get("Retry-After")) || 1
              : attempt * 500;
          const delayMs = Math.min(retryAfter * 1000, 5000);
          await sleep(delayMs);
          continue;
        }
        return response;
      }

      return response;
    } catch (err) {
      clearTimeout(timeout);
      releaseSlot();
      lastError = err as Error;
      if (attempt < maxAttempts) {
        await sleep(attempt * 500);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("TMDB fetch failed");
}

/**
 * Fetch TMDB JSON with throttle and retry. Returns parsed data or throws.
 * Use in API routes when you need JSON and want to throw on error.
 */
export async function fetchTmdbJson<T>(
  url: string,
  options: TmdbClientOptions = {}
): Promise<T> {
  const res = await fetchTmdb(url, options);
  if (!res.ok) {
    throw new Error(`TMDB ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
