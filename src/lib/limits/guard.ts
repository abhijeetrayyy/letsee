import { headers } from "next/headers";
import { createHash } from "node:crypto";

/**
 * Fair use for the routes that cost something — server work, database reads,
 * TMDB calls — without costing anything itself.
 *
 * Counts live in the function's own memory: no Redis, no database write per
 * request, no middleware invocation in front of every API call (each of those
 * would be the bill this exists to keep down). A Vercel instance is reused for
 * the requests that reach it in a burst, which is exactly when counting
 * matters; a quiet minute later it may be a fresh instance with fresh counts,
 * and that's fine — nobody browsing comes near these numbers.
 *
 * Keyed by address (Vercel's `x-real-ip`): it can't be forged from the client,
 * unlike anything in a cookie, and it covers signed-out callers too. The
 * limits are generous enough for a shared address (a family, an office).
 *
 * Going over a bucket's limit answers 429 with when to try again. Doing it
 * three times inside ten minutes puts the address in the penalty box for ten
 * minutes, across every bucket — the nuisance stops, everyone else carries
 * on — and that moment is logged, which is the monitoring (lib/limits/report).
 * A bucket gives at most one strike a window, so it takes three separate
 * minutes over the line, not three refused taps in a row.
 */

type Bucket = { limit: number; windowMs: number; label: string };

const MINUTE = 60_000;

export const BUCKETS = {
  /** TMDB proxies: search, browse, title extras. Typing a search is a few a second at most. */
  tmdb: { limit: 180, windowMs: MINUTE, label: "looking things up" },
  /** Uncached reads that do real work: stats, series progress, year reviews, feeds.
   *  A page can make several of these at once; 90 a minute is ~20 page views. */
  heavy: { limit: 90, windowMs: MINUTE, label: "loading profiles and stats" },
  /** Changes: logging, rating, saving, lists. Quick-add in bulk is one request. */
  write: { limit: 150, windowMs: MINUTE, label: "saving changes" },
  /** Looking people up, blocking, reporting. */
  people: { limit: 40, windowMs: MINUTE, label: "looking people up" },
  /** Starting an import; its processing steps have their own, larger bucket. */
  importStart: { limit: 6, windowMs: 60 * MINUTE, label: "starting imports" },
  importStep: { limit: 120, windowMs: MINUTE, label: "importing" },
  /** Downloads of your data: also once per 15 days each (lib/limits/quota). */
  export: { limit: 5, windowMs: MINUTE, label: "downloading your data" },
  /** Server-rendered pages: a profile, a recap, a room. */
  pages: { limit: 90, windowMs: MINUTE, label: "opening pages" },
  /** Deleting or bringing back an account. */
  account: { limit: 10, windowMs: 60 * MINUTE, label: "account changes" },
} satisfies Record<string, Bucket>;

export type BucketName = keyof typeof BUCKETS;

const STRIKES_TO_PENALTY = 3;
const STRIKE_WINDOW_MS = 10 * MINUTE;
const PENALTY_MS = 10 * MINUTE;
/** Bounded memory: past this many addresses, the least recently seen go first. */
const MAX_KEYS = 5000;

const hits = new Map<string, number[]>();
const strikes = new Map<string, number[]>();
/** When a bucket last cost this address a strike: at most one per window, so a
 *  person who taps a few times too many isn't paused — only going over again
 *  and again, minute after minute, is. */
const struck = new Map<string, number>();
const penalties = new Map<string, number>();

function touch<V>(map: Map<string, V>, key: string, value: V) {
  map.delete(key);
  map.set(key, value);
  if (map.size > MAX_KEYS) map.delete(map.keys().next().value as string);
}

/** The caller's address, or a stable stand-in when there isn't one (local development). */
export function clientKey(h: Headers): string {
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return ip;
}

/** An address never leaves this module in the clear: logs get a short hash. */
export function hashKey(key: string): string {
  return createHash("sha256").update(`letsee:${key}`).digest("hex").slice(0, 16);
}

export type Verdict =
  | { ok: true }
  /** `started`: this request is the one that put the address in the penalty box. */
  | { ok: false; retryAfter: number; penalty: boolean; started: boolean; bucket: BucketName };

/** The decision alone, for pages that render their own answer. Pure apart from the counters. */
export function check(key: string, bucket: BucketName, now = Date.now()): Verdict {
  const until = penalties.get(key);
  if (until && until > now) return { ok: false, retryAfter: Math.ceil((until - now) / 1000), penalty: true, started: false, bucket };
  if (until) penalties.delete(key);

  const { limit, windowMs } = BUCKETS[bucket];
  const slot = `${bucket}:${key}`;
  const recent = (hits.get(slot) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    touch(hits, slot, recent);
    const last = struck.get(slot);
    const fresh = last === undefined || now - last >= windowMs;
    if (fresh) touch(struck, slot, now);
    const marks = [...(strikes.get(key) ?? []).filter((t) => now - t < STRIKE_WINDOW_MS), ...(fresh ? [now] : [])];
    touch(strikes, key, marks);
    if (marks.length >= STRIKES_TO_PENALTY) {
      touch(penalties, key, now + PENALTY_MS);
      strikes.delete(key);
      return { ok: false, retryAfter: Math.ceil(PENALTY_MS / 1000), penalty: true, started: true, bucket };
    }
    return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)), penalty: false, started: false, bucket };
  }
  recent.push(now);
  touch(hits, slot, recent);
  return { ok: true };
}

/** For tests: forget everything. */
export function resetLimits() {
  hits.clear();
  strikes.clear();
  struck.clear();
  penalties.clear();
}

export function tooFastMessage(verdict: Extract<Verdict, { ok: false }>): string {
  const wait = verdict.retryAfter >= 90 ? `${Math.ceil(verdict.retryAfter / 60)} minutes` : `${verdict.retryAfter} seconds`;
  return verdict.penalty
    ? `Too many requests from here in a short time, so letsee is pausing them for ${wait}. Everything you've saved is safe.`
    : `You're going a bit fast with ${BUCKETS[verdict.bucket].label}. Try again in ${wait}.`;
}

/**
 * At the top of a route: `const limited = await guard("heavy"); if (limited) return limited;`
 * Returns a 429 to send, or null to carry on.
 */
export async function guard(bucket: BucketName, request?: Request): Promise<Response | null> {
  const h = request ? request.headers : await headers();
  const key = clientKey(h);
  const verdict = check(key, bucket);
  if (verdict.ok) return null;
  if (verdict.started) {
    // Once per penalty, not per refused request. Never blocks the answer.
    void import("./report").then(({ reportPenalty }) => reportPenalty(hashKey(key), bucket, request ? new URL(request.url).pathname : null));
  }
  return new Response(JSON.stringify({ error: tooFastMessage(verdict), retryAfter: verdict.retryAfter }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(verdict.retryAfter),
      "Cache-Control": "no-store",
    },
  });
}
