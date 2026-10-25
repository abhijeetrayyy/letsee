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
/**
 * Min ms between starting new requests, to smooth bursts: at most 40 starts a
 * second, under TMDB's ~50 per IP. It was 120ms, paid before every request —
 * Data Cache hits included — which alone held a person page's fifteen calls
 * for nearly two seconds (measured 25 Oct 2026: uncached person and title
 * pages took 2.4–3.9s to build).
 */
const MIN_GAP_MS = 25;
/**
 * Fail fast. A page waits on these, and a stalled TMDB request used to hold
 * it for up to ~38s (12s × 3 attempts, plus backoff). Now a dropped
 * connection — quick to find out, and common (ECONNRESET) — still gets three
 * tries, but a second timeout ends it: at most ~12.5s for a page's main call.
 * Optional sections pass shorter limits of their own.
 */
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_TIMEOUTS = 2;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// In-memory throttle state (shared across all TMDB calls in this process)
let inFlight = 0;
let lastStartTime = 0;
const waitQueue: Array<() => void> = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Take a slot if one is free and the gap has passed: counts the request as
 * started. Otherwise, when only the gap is in the way, come back once it has.
 */
function grant(): boolean {
  if (inFlight >= MAX_CONCURRENT) return false;
  const wait = MIN_GAP_MS - (Date.now() - lastStartTime);
  if (wait > 0) {
    if (!timer) timer = setTimeout(() => {
      timer = null;
      drain();
    }, wait);
    return false;
  }
  inFlight++;
  lastStartTime = Date.now();
  return true;
}

/**
 * Let waiting requests start, as many as the throttle allows, and keep going.
 * The old scheduler released one waiter and then stopped until some request
 * finished — so a burst meant to run eight at a time ran nearly one by one.
 */
function drain(): void {
  while (waitQueue.length > 0 && grant()) waitQueue.shift()!();
}

/** Wait for a throttle slot before starting a TMDB request. The slot is taken when this resolves. */
function waitForSlot(): Promise<void> {
  if (waitQueue.length === 0 && grant()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    waitQueue.push(resolve);
    drain();
  });
}

function releaseSlot(): void {
  inFlight = Math.max(0, inFlight - 1);
  drain();
}

export type TmdbClientOptions = RequestInit & {
  /** Request timeout in ms. Default 6000 */
  timeoutMs?: number;
  /** Max attempts (including the first). Default 3; a second timeout stops it sooner. */
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
  let timeouts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await waitForSlot();

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
      // A timeout has already cost its full wait: a second one ends it.
      if (lastError.name === "AbortError") timeouts++;
      if (attempt < maxAttempts && timeouts < MAX_TIMEOUTS) {
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
