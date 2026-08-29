/**
 * Fill `title_metadata` (088) from TMDB, from a terminal, with a running log.
 *
 * ── Why this is not a cron ─────────────────────────────────────────────────
 * It was one, and being one cost more than it bought. A scheduled function
 * lives inside a 60s ceiling, so the work had to be chopped into ~100-title
 * batches spread over days; it needs a shared secret to be safe to expose; and
 * it would have been a third entry in `vercel.json` against a plan that allows
 * two. All of that is scaffolding around a limit that does not exist on a
 * laptop.
 *
 * Run locally there is no function timeout, so the natural unit of work is
 * "the whole queue" rather than "whatever fits in 45 seconds", and the natural
 * output is a log you watch rather than a JSON summary you read afterwards.
 * `drain: true` keeps claiming batches until nothing is left.
 *
 * ── What is still bounded, and why ─────────────────────────────────────────
 * Removing the deadline does not mean removing the limits that protect TMDB
 * and the database. Every call still goes through `fetchTmdb`, which throttles
 * this app to 8 concurrent with a 120ms floor between starts (~8/s) and retries
 * 429 honouring Retry-After. On top of that:
 *
 *   * a worker pool, so only a handful of titles are ever in flight;
 *   * a breaker that stops the run after 8 consecutive failures, or on a 429
 *     that survived its retries — if TMDB is unhappy, asking harder is the one
 *     thing guaranteed to make it worse;
 *   * `claim_title_metadata`'s lease, so two runs at once take different
 *     titles instead of fetching the same ones twice;
 *   * writes chunked below PostgREST's 1000-row response cap.
 *
 * The queue is still the unit of progress, so a run interrupted at title 400
 * resumes at 401 rather than starting over.
 */

import { createAdminClient } from "@/utils/supabase/server";
import { fetchTmdb } from "@/utils/tmdbClient";

const TMDB_BASE = "https://api.themoviedb.org/3";

/** Titles claimed per batch. The claim RPC caps this at 500 regardless. */
const DEFAULT_BATCH = 100;
/** In flight at once, under fetchTmdb's own 8-concurrent throttle. */
const DEFAULT_CONCURRENCY = 4;
/** Give up on a title after this many attempts; the DB applies the backoff. */
const MAX_ATTEMPTS = 5;
/** Consecutive failures that trip the breaker. */
const FAILURE_STREAK_LIMIT = 8;
/** Batches a single drain will run before stopping. A runaway-loop backstop. */
const MAX_BATCHES = 200;
/** Re-check a title's score after this long. Votes move; a frozen crowd lies. */
const DEFAULT_REFRESH_DAYS = 30;
const DEFAULT_REFRESH_LIMIT = 25;
/** Rows per upsert. PostgREST caps a response at 1000; stay well under. */
const WRITE_CHUNK = 100;

export type BackfillOptions = {
  /** Keep claiming batches until the queue is empty. */
  drain?: boolean;
  /** Titles per batch. */
  batchSize?: number;
  /** Stop after this many titles, however many batches that takes. */
  maxTitles?: number;
  concurrency?: number;
  refreshAfterDays?: number;
  refreshLimit?: number;
  /** Skip the stale-refresh pass — what you want when filling a cold queue. */
  skipRefresh?: boolean;
  /** Called for every meaningful thing that happens. This is the log. */
  onEvent?: (event: BackfillEvent) => void;
};

export type TitleOutcome = "ok" | "missing" | "failed";

export type BackfillEvent =
  | { type: "start"; drain: boolean; batchSize: number; concurrency: number }
  | { type: "enqueue"; added: number; requeued: number; pending: number | null }
  | { type: "batch"; index: number; claimed: number; pending: number | null }
  | {
      type: "title";
      index: number;
      total: number;
      itemId: string;
      itemType: string;
      outcome: TitleOutcome;
      title?: string | null;
      score?: number | null;
      votes?: number | null;
      year?: number | null;
      error?: string;
    }
  | { type: "write"; written: number; attempted: number; error?: string }
  | { type: "notice"; message: string }
  | { type: "done"; result: BackfillResult };

export type BackfillResult = {
  enqueued: number;
  requeuedStale: number;
  batches: number;
  claimed: number;
  /** Fetched and stored. */
  passed: number;
  /** TMDB answered 404 — a dead id, recorded so it is never asked again. */
  missing: number;
  /** Errored; back on the queue with exponential backoff. */
  failed: number;
  /** Claimed but never attempted, because the breaker tripped. */
  deferred: number;
  /** Rows that reached the database. Below `passed + missing` means a write failed. */
  written: number;
  remaining: number | null;
  durationMs: number;
  stoppedBecause:
    | "queue-empty"
    | "max-titles"
    | "max-batches"
    | "circuit-breaker"
    | "no-work"
    | "not-configured";
};

type TmdbTitle = {
  title?: string;
  name?: string;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  original_language?: string;
  popularity?: number;
  genres?: { id: number; name: string }[];
  adult?: boolean;
};

type MetadataRow = {
  item_id: string;
  item_type: string;
  title: string | null;
  tmdb_vote_average: number | null;
  tmdb_vote_count: number | null;
  release_year: number | null;
  runtime_minutes: number | null;
  original_language: string | null;
  popularity: number | null;
  genres: string[] | null;
  adult: boolean | null;
  fetch_state: "ok" | "missing";
  attempts: number;
  last_error: null;
  fetched_at: string;
};

function yearOf(date: string | undefined): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isInteger(year) && year >= 1870 && year <= 2100 ? year : null;
}

/** Clamp into the column's CHECK, so a surprise payload can't abort the write. */
function clampScore(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(10, Math.max(0, value));
}

function toRow(item: { item_id: string; item_type: string }, data: TmdbTitle): MetadataRow {
  const isTv = item.item_type === "tv";
  return {
    item_id: item.item_id,
    item_type: item.item_type,
    title: (isTv ? data.name : data.title)?.slice(0, 300) ?? null,
    tmdb_vote_average: clampScore(data.vote_average),
    tmdb_vote_count:
      typeof data.vote_count === "number" && data.vote_count >= 0
        ? Math.trunc(data.vote_count)
        : null,
    release_year: yearOf(isTv ? data.first_air_date : data.release_date),
    runtime_minutes: isTv
      ? (data.episode_run_time?.find((n) => typeof n === "number" && n > 0) ?? null)
      : typeof data.runtime === "number" && data.runtime > 0
        ? data.runtime
        : null,
    original_language: data.original_language?.slice(0, 12) ?? null,
    popularity: typeof data.popularity === "number" ? data.popularity : null,
    genres: data.genres?.map((g) => g.name).filter(Boolean) ?? null,
    adult: typeof data.adult === "boolean" ? data.adult : null,
    fetch_state: "ok",
    attempts: 0,
    last_error: null,
    fetched_at: new Date().toISOString(),
  };
}

/** A title TMDB will never answer for. Recorded once, never retried. */
function missingRow(item: { item_id: string; item_type: string }): MetadataRow {
  return {
    ...toRow(item, {}),
    title: null,
    tmdb_vote_average: null,
    tmdb_vote_count: null,
    release_year: null,
    runtime_minutes: null,
    original_language: null,
    popularity: null,
    genres: null,
    adult: null,
    fetch_state: "missing",
  };
}

export async function backfillTitleMetadata(
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  const startedAt = Date.now();
  const emit = options.onEvent ?? (() => {});

  const totals = {
    enqueued: 0, requeuedStale: 0, batches: 0, claimed: 0,
    passed: 0, missing: 0, failed: 0, deferred: 0, written: 0,
  };
  const finish = (
    stoppedBecause: BackfillResult["stoppedBecause"],
    remaining: number | null,
  ): BackfillResult => {
    const result: BackfillResult = {
      ...totals, remaining, durationMs: Date.now() - startedAt, stoppedBecause,
    };
    emit({ type: "done", result });
    return result;
  };

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    emit({ type: "notice", message: "TMDB_API_KEY is not set — nothing to do." });
    return finish("not-configured", null);
  }

  const drain = options.drain ?? true;
  const batchSize = Math.min(Math.max(options.batchSize ?? DEFAULT_BATCH, 1), 500);
  const concurrency = Math.min(Math.max(options.concurrency ?? DEFAULT_CONCURRENCY, 1), 8);
  const maxTitles = options.maxTitles && options.maxTitles > 0 ? options.maxTitles : Infinity;

  emit({ type: "start", drain, batchSize, concurrency });

  const supabase = createAdminClient();
  const countPending = async (): Promise<number | null> => {
    const { count, error } = await supabase
      .from("title_metadata")
      .select("item_id", { count: "exact", head: true })
      .eq("fetch_state", "pending");
    if (error) {
      emit({ type: "notice", message: `count pending failed: ${error.message}` });
      return null;
    }
    return count ?? null;
  };

  // ── 1. Top up the queue ──────────────────────────────────────────────────
  // The queue fills itself here rather than at every write path in the app.
  // 069's post-mortem is what happens when a derived table depends on every
  // caller remembering to maintain it.
  const { data: added, error: enqueueError } = await supabase.rpc(
    "enqueue_missing_title_metadata",
    { p_limit: 20000 },
  );
  if (enqueueError) emit({ type: "notice", message: `enqueue failed: ${enqueueError.message}` });
  else totals.enqueued = Number(added ?? 0);

  // ── 2. Re-queue what has gone stale ──────────────────────────────────────
  // Only after new titles are in, and only a trickle, so first-time coverage
  // always wins the race against refreshing what we already have.
  if (!options.skipRefresh) {
    const { data: requeued, error: staleError } = await supabase.rpc(
      "enqueue_stale_title_metadata",
      {
        p_max_age_days: options.refreshAfterDays ?? DEFAULT_REFRESH_DAYS,
        p_limit: options.refreshLimit ?? DEFAULT_REFRESH_LIMIT,
      },
    );
    if (staleError) emit({ type: "notice", message: `refresh failed: ${staleError.message}` });
    else totals.requeuedStale = Number(requeued ?? 0);
  }

  emit({
    type: "enqueue",
    added: totals.enqueued,
    requeued: totals.requeuedStale,
    pending: await countPending(),
  });

  let tripped = false;

  for (let batchIndex = 1; ; batchIndex++) {
    if (batchIndex > MAX_BATCHES) return finish("max-batches", await countPending());
    if (totals.claimed >= maxTitles) return finish("max-titles", await countPending());

    const wanted = Math.min(batchSize, maxTitles - totals.claimed);

    // The lease is generous because a local drain has no deadline to bound it,
    // and a lease that expires mid-run would let a second terminal re-fetch
    // titles this one is already holding.
    const { data: claimed, error: claimError } = await supabase.rpc("claim_title_metadata", {
      p_limit: wanted,
      p_lease_seconds: 1800,
    });

    if (claimError) {
      emit({ type: "notice", message: `claim failed: ${claimError.message}` });
      return finish("no-work", await countPending());
    }

    const batch = (claimed ?? []) as { item_id: string; item_type: string }[];
    if (batch.length === 0) {
      // Not necessarily "done": titles inside their backoff window are pending
      // but not yet claimable, and that is the difference between an empty
      // queue and a queue that is merely quiet right now.
      const pending = await countPending();
      if (pending && pending > 0) {
        emit({
          type: "notice",
          message:
            `${pending} title${pending === 1 ? "" : "s"} still pending but inside a ` +
            `retry backoff window — run again in a few minutes to pick them up.`,
        });
      }
      return finish(batchIndex === 1 ? "no-work" : "queue-empty", pending);
    }

    totals.batches++;
    totals.claimed += batch.length;
    emit({
      type: "batch",
      index: batchIndex,
      claimed: batch.length,
      pending: await countPending(),
    });

    // ── 3. Fetch, with a pool and a breaker ────────────────────────────────
    const succeeded: MetadataRow[] = [];
    const failures: { item_id: string; item_type: string; error: string }[] = [];
    let cursor = 0;
    let failureStreak = 0;
    let done = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        if (tripped) return;
        const index = cursor++;
        if (index >= batch.length) return;
        const item = batch[index];

        const url =
          `${TMDB_BASE}/${item.item_type === "tv" ? "tv" : "movie"}/` +
          `${encodeURIComponent(item.item_id)}?api_key=${apiKey}&language=en-US`;

        const report = (
          outcome: TitleOutcome,
          extra: Partial<Extract<BackfillEvent, { type: "title" }>> = {},
        ) => {
          done++;
          emit({
            type: "title",
            index: done,
            total: batch.length,
            itemId: item.item_id,
            itemType: item.item_type,
            outcome,
            ...extra,
          });
        };

        try {
          // no-store: this is a backfill writing to a cache we own. A second
          // copy in Next's fetch cache would waste memory and could serve a
          // stale body straight back into the table we are refreshing.
          const response = await fetchTmdb(url, { cache: "no-store", timeoutMs: 10_000 });

          if (response.status === 404) {
            // Not a failure. A dead id stays dead, and retrying it forever is
            // how a queue never drains.
            succeeded.push(missingRow(item));
            failureStreak = 0;
            report("missing");
            continue;
          }

          if (response.status === 429) {
            // fetchTmdb already retried this honouring Retry-After. Still 429
            // means the budget is genuinely gone.
            failures.push({ ...item, error: "429 after retries" });
            report("failed", { error: "429 after retries" });
            tripped = true;
            emit({ type: "notice", message: "TMDB is rate limiting after retries — stopping." });
            return;
          }

          if (!response.ok) {
            const error = `${response.status} ${response.statusText}`;
            failures.push({ ...item, error });
            report("failed", { error });
            if (++failureStreak >= FAILURE_STREAK_LIMIT) {
              tripped = true;
              emit({
                type: "notice",
                message: `${FAILURE_STREAK_LIMIT} failures in a row — stopping.`,
              });
              return;
            }
            continue;
          }

          const data = (await response.json()) as TmdbTitle;
          const row = toRow(item, data);
          succeeded.push(row);
          failureStreak = 0;
          report("ok", {
            title: row.title,
            score: row.tmdb_vote_average,
            votes: row.tmdb_vote_count,
            year: row.release_year,
          });
        } catch (err) {
          const error = err instanceof Error ? err.message.slice(0, 200) : "fetch failed";
          failures.push({ ...item, error });
          report("failed", { error });
          if (++failureStreak >= FAILURE_STREAK_LIMIT) {
            tripped = true;
            emit({
              type: "notice",
              message: `${FAILURE_STREAK_LIMIT} failures in a row — stopping.`,
            });
            return;
          }
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, batch.length) }, () => worker()),
    );

    // ── 4. Write back ──────────────────────────────────────────────────────
    // Chunked, and a chunk that fails does not take the run's other results
    // with it — those titles stay claimed until the lease expires and get
    // picked up again. Losing some work is cheap; losing all of it is not.
    let written = 0;
    for (let i = 0; i < succeeded.length; i += WRITE_CHUNK) {
      const chunk = succeeded.slice(i, i + WRITE_CHUNK);
      const { error } = await supabase
        .from("title_metadata")
        .upsert(chunk, { onConflict: "item_id,item_type" });
      if (error) {
        emit({ type: "write", written, attempted: succeeded.length, error: error.message });
      } else {
        written += chunk.length;
      }
    }
    if (succeeded.length > 0) {
      emit({ type: "write", written, attempted: succeeded.length });
    }

    // Failures go through the RPC so the backoff schedule is decided in one
    // place — the database — rather than by whichever caller got there first.
    for (const failure of failures) {
      const { error } = await supabase.rpc("record_title_metadata_failure", {
        p_item_id: failure.item_id,
        p_item_type: failure.item_type,
        p_error: failure.error,
        p_max_attempts: MAX_ATTEMPTS,
      });
      if (error) {
        emit({ type: "notice", message: `recording failure failed: ${error.message}` });
      }
    }

    totals.written += written;
    totals.missing += succeeded.filter((row) => row.fetch_state === "missing").length;
    totals.passed += succeeded.filter((row) => row.fetch_state === "ok").length;
    totals.failed += failures.length;
    totals.deferred += batch.length - (succeeded.length + failures.length);

    if (tripped) return finish("circuit-breaker", await countPending());
    if (!drain) return finish("max-titles", await countPending());
  }
}
