import { backfillTitleMetadata, type BackfillEvent } from "@/utils/jobs/titleMetadataBackfill";
import { guardLocalOnly } from "@/utils/localOnly";

export const dynamic = "force-dynamic";

/**
 * GET /api/dev/backfill-titles — fill `title_metadata` from TMDB, locally,
 * with a log you watch as it happens.
 *
 *   npm run dev
 *   curl -N localhost:3000/api/dev/backfill-titles
 *
 * `-N` matters: without it curl buffers and you get the whole log at the end
 * instead of a line per title as it lands.
 *
 * Query parameters, all optional:
 *   batch=100        titles claimed per round (1–500)
 *   max=250          stop after this many titles; omit to drain the queue
 *   concurrency=4    titles in flight at once (1–8)
 *   refresh=0        skip the stale-refresh pass — what you want on a cold queue
 *   refreshDays=30   re-fetch scores older than this many days (floored at 1 in
 *                    SQL — a vote average does not move meaningfully in hours)
 *   refreshLimit=25  cap on how many stale titles one run re-queues
 *   quiet=1          totals only, no per-title lines
 *   json=1           one NDJSON event per line instead of prose
 *
 * ── Why this is not a cron, and not protected by a secret ──────────────────
 * It cannot run anywhere it would need protecting. The guard below refuses on
 * two independent grounds — a production build, and a request whose Host is
 * not loopback — so shipping this file to Vercel deploys an endpoint that
 * answers 403 to everyone including its author. A shared secret would be
 * guarding a door that is already bricked up.
 *
 * The upside of being local is not just convenience. There is no 60s function
 * ceiling here, so the job drains the entire queue in one run rather than
 * being chopped into daily batches, and it can afford to narrate every title
 * instead of returning a summary and discarding what it did.
 *
 * The cost is that nothing fills the queue automatically. New titles land in
 * `title_metadata` as 'pending' the moment anyone watches them — the stats RPC
 * reports coverage and the profile says so out loud — and they stay that way
 * until someone runs this. That is the trade: no scheduled infrastructure, and
 * a command to remember.
 */

export async function GET(request: Request) {
  const refused = guardLocalOnly(request);
  if (refused) return refused;

  const { searchParams } = new URL(request.url);
  // `Number(null)` is 0, not NaN, and 0 is finite — so a `Number.isFinite`
  // guard alone treats every *absent* parameter as the number zero, which then
  // clamps up to the minimum. That turned a bare call with no query string
  // into "batch=1, concurrency=1, max=1": a drain that fetched one title and
  // reported success. Absent has to be checked before parsing, not after.
  const bounded = (raw: string | null, min: number, max: number): number | undefined => {
    if (raw === null || raw.trim() === "") return undefined;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.min(Math.max(Math.trunc(parsed), min), max);
  };

  const quiet = searchParams.get("quiet") === "1";
  const asJson = searchParams.get("json") === "1";
  const maxTitles = bounded(searchParams.get("max"), 1, 100_000);

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (line: string) => {
        try {
          controller.enqueue(encoder.encode(`${line}\n`));
        } catch {
          // The reader hung up (curl was interrupted). The run keeps going to
          // its natural stop so the database is left consistent — the work is
          // already claimed, and abandoning it mid-batch would leave those
          // titles leased with nothing recorded.
        }
      };

      try {
        await backfillTitleMetadata({
          drain: maxTitles == null,
          maxTitles,
          batchSize: bounded(searchParams.get("batch"), 1, 500),
          concurrency: bounded(searchParams.get("concurrency"), 1, 8),
          skipRefresh: searchParams.get("refresh") === "0",
          // 0 is a legitimate value here — "everything is stale, re-fetch it
          // all" — so this cannot go through `bounded`, whose floor is 1.
          refreshAfterDays: bounded(searchParams.get("refreshDays"), 0, 3650),
          refreshLimit: bounded(searchParams.get("refreshLimit"), 1, 5000),
          onEvent: (event) => {
            if (asJson) {
              if (quiet && event.type === "title") return;
              write(JSON.stringify(event));
              return;
            }
            const line = render(event, startedAt, quiet);
            if (line !== null) write(line);
          },
        });
      } catch (err) {
        write("");
        write(`FATAL  ${err instanceof Error ? err.message : "unknown error"}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": asJson ? "application/x-ndjson; charset=utf-8" : "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Without this a proxy may buffer the whole body and defeat the point.
      "X-Accel-Buffering": "no",
    },
  });
}

/** One event, one human-readable line. `null` means "don't print this one". */
function render(event: BackfillEvent, startedAt: number, quiet: boolean): string | null {
  const elapsed = () => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`.padStart(7);

  switch (event.type) {
    case "start":
      return [
        "TMDB title metadata backfill",
        "════════════════════════════",
        `mode        ${event.drain ? "drain the queue" : "bounded run"}`,
        `batch size  ${event.batchSize}`,
        `concurrency ${event.concurrency} (under the shared ~8 req/s TMDB throttle)`,
        "",
      ].join("\n");

    case "enqueue":
      return [
        `queued      ${event.added} title${event.added === 1 ? "" : "s"} newly discovered`,
        `re-queued   ${event.requeued} stale (scores older than the refresh window)`,
        `pending     ${event.pending ?? "?"} total waiting`,
        "",
      ].join("\n");

    case "batch":
      return `── batch ${event.index}: claimed ${event.claimed}, ${event.pending ?? "?"} still pending ──`;

    case "title": {
      if (quiet) return null;
      const counter = `${String(event.index).padStart(3)}/${String(event.total).padEnd(3)}`;
      const id = `${event.itemType}/${event.itemId}`.padEnd(14);
      if (event.outcome === "ok") {
        const name = (event.title ?? "—").slice(0, 44).padEnd(44);
        const score = event.score == null ? "  —  " : event.score.toFixed(2).padStart(5);
        const votes = event.votes == null ? "" : `${event.votes} votes`;
        return `${elapsed()}  ${counter} PASS  ${id} ${name} ${score}  ${String(event.year ?? "").padEnd(4)} ${votes}`;
      }
      if (event.outcome === "missing") {
        return `${elapsed()}  ${counter} GONE  ${id} 404 from TMDB — recorded, never retried`;
      }
      return `${elapsed()}  ${counter} FAIL  ${id} ${event.error ?? "unknown"} — back on the queue with backoff`;
    }

    case "write":
      return event.error
        ? `        write FAILED after ${event.written}/${event.attempted}: ${event.error}`
        : `        wrote ${event.written}/${event.attempted} rows to title_metadata`;

    case "notice":
      return `        note: ${event.message}`;

    case "done": {
      const r = event.result;
      const seconds = r.durationMs / 1000;
      const rate = seconds > 0 ? (r.claimed / seconds).toFixed(1) : "0";
      return [
        "",
        "════════════════════════════",
        "SUMMARY",
        `  passed      ${r.passed}   fetched from TMDB and stored`,
        `  missing     ${r.missing}   404 — dead ids, recorded so they are never asked again`,
        `  failed      ${r.failed}   errored; back on the queue with exponential backoff`,
        `  deferred    ${r.deferred}   claimed but not attempted (the breaker tripped)`,
        `  ─────────────`,
        `  claimed     ${r.claimed}   across ${r.batches} batch${r.batches === 1 ? "" : "es"}`,
        `  written     ${r.written}   rows that reached the database`,
        "",
        `  newly queued  ${r.enqueued}`,
        `  re-queued     ${r.requeuedStale} (stale refresh)`,
        `  still pending ${r.remaining ?? "?"}`,
        "",
        `  took        ${seconds.toFixed(1)}s  (${rate} titles/sec)`,
        `  stopped     ${explain(r.stoppedBecause)}`,
        "",
      ].join("\n");
    }
  }
}

function explain(reason: string): string {
  switch (reason) {
    case "queue-empty": return "queue-empty — nothing left to fetch";
    case "no-work": return "no-work — the queue was already empty or fully backed off";
    case "max-titles": return "max-titles — hit the limit you asked for";
    case "max-batches": return "max-batches — safety backstop, run again to continue";
    case "circuit-breaker": return "circuit-breaker — too many consecutive failures, or TMDB rate limiting";
    case "not-configured": return "not-configured — TMDB_API_KEY is missing";
    default: return reason;
  }
}
