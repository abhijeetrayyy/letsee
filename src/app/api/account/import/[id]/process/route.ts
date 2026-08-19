import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { resolveTitle } from "@/utils/titleResolver";
import { applyRows, type ApplicableRow } from "@/utils/importApply";
import { GenreList } from "@/staticData/genreList";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Titles resolved per call.
 *
 * The TMDB client throttles to a 120ms gap between request starts (~8/s), so a
 * chunk of 25 takes roughly three seconds — comfortably inside the serverless
 * limit, and short enough that the progress bar moves often enough to look
 * alive rather than hung.
 */
const CHUNK = 25;

const GENRE_NAME_BY_ID = new Map<number, string>(
  GenreList.genres.map((g: { id: number; name: string }) => [g.id, g.name]),
);

/**
 * POST /api/account/import/[id]/process — resolve and apply the next chunk.
 *
 * Called repeatedly by the client until `done`. Each call is independent and
 * idempotent: it claims whatever is still pending, so a dropped connection or a
 * closed tab costs at most one chunk, and reopening the page resumes.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const { id } = await ctx.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return jsonError("Invalid import id", 400);

  const supabase = await createClient();

  // RLS restricts import_jobs to the owner, so a miss here is either a bad id
  // or someone else's job — indistinguishable on purpose.
  const { data: job } = await supabase
    .from("import_jobs")
    .select("id, status, total_rows, processed_rows, resolved_rows")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return jsonError("Import not found", 404);

  const { data: pending, error: pendingError } = await supabase
    .from("import_rows")
    .select("id, title, year, watched, watchlist, favorite, rating, review_text, watched_date")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .order("id")
    .limit(CHUNK);

  if (pendingError) {
    console.error("import process fetch:", pendingError);
    return jsonError("Couldn't read the import", 500);
  }

  if (!pending || pending.length === 0) {
    await supabase
      .from("import_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", jobId);

    const { count: unresolved } = await supabase
      .from("import_rows")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "unresolved");

    return jsonSuccess({
      done: true,
      processed: job.processed_rows,
      total: job.total_rows,
      resolved: job.resolved_rows,
      unresolved: unresolved ?? 0,
    });
  }

  // Resolve the chunk in parallel — the TMDB client's own throttle is what
  // paces this, so there's nothing to gain from serialising here.
  const outcomes = await Promise.all(
    pending.map(async (row) => ({
      row,
      outcome: await resolveTitle(row.title, row.year, GENRE_NAME_BY_ID),
    })),
  );

  const applicable: ApplicableRow[] = [];
  const unresolvedIds: number[] = [];

  for (const { row, outcome } of outcomes) {
    if (outcome.status === "resolved") {
      applicable.push({
        id: row.id,
        tmdbId: outcome.match.tmdbId,
        tmdbType: outcome.match.tmdbType,
        matchedTitle: outcome.match.matchedTitle,
        posterPath: outcome.match.posterPath,
        genres: outcome.match.genres,
        watched: row.watched,
        watchlist: row.watchlist,
        favorite: row.favorite,
        rating: row.rating,
        reviewText: row.review_text,
        watchedDate: row.watched_date,
      });
    } else {
      unresolvedIds.push(row.id);
    }
  }

  const { errors: applyErrors } = await applyRows(supabase, userId, applicable);
  const applyFailed = applyErrors.length > 0;

  /**
   * A row is only `applied` if its write actually landed.
   *
   * This used to mark every resolved row applied unconditionally, because
   * applyRows swallowed its errors and had nothing to report. A single
   * rejected statement — two CSV lines resolving to one TMDB id was enough —
   * left a whole chunk of films with no status and no watched_items row, all
   * stamped `applied`, all counted in the progress bar, and unreachable by a
   * re-run because the importer skips anything already applied.
   *
   * Leaving them `pending` is the repair: this route selects on
   * `status = 'pending'`, so the next attempt picks up exactly the rows that
   * did not make it. Every write is an upsert or DO NOTHING, so retrying rows
   * that partially succeeded is a no-op rather than a duplicate.
   */
  await Promise.all([
    ...(applyFailed
      ? []
      : applicable.map((r) =>
          supabase
            .from("import_rows")
            .update({
              status: "applied",
              tmdb_id: r.tmdbId,
              tmdb_type: r.tmdbType,
              matched_title: r.matchedTitle,
            })
            .eq("id", r.id),
        )),
    unresolvedIds.length
      ? supabase.from("import_rows").update({ status: "unresolved" }).in("id", unresolvedIds)
      : null,
  ]);

  // Counters advance only over rows that were actually settled. Counting a
  // failed chunk as processed would let `done` arrive with rows still pending,
  // and the job would report itself completed having skipped them.
  const settled = applyFailed ? unresolvedIds.length : pending.length;
  const processed = job.processed_rows + settled;
  const resolved = job.resolved_rows + (applyFailed ? 0 : applicable.length);
  const done = !applyFailed && processed >= job.total_rows;

  await supabase
    .from("import_jobs")
    .update({
      processed_rows: processed,
      resolved_rows: resolved,
      ...(done ? { status: "completed", completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", jobId);

  // Counts are only meaningful once, at the end, so skip the extra query while
  // the loop is still running.
  try {
    if (done) await supabase.rpc("recount_user_stats", { p_user_id: userId });
  } catch {
    // Non-critical; stats are eventually consistent.
  }

  /**
   * Stop the client's loop rather than spinning on rows that cannot advance.
   *
   * ImportFlow drives /process in a `for (;;)` until `done`, and bails on a
   * non-ok response — so surfacing the failure here ends the run with a real
   * message instead of hammering a chunk that will keep failing. The job row
   * above has already been updated, so nothing is lost: reopening the import
   * resumes from the rows still marked pending.
   */
  if (applyFailed) {
    return jsonError(`The import could not save part of this batch. ${applyErrors[0]}`, 500);
  }

  return jsonSuccess({
    done,
    processed,
    total: job.total_rows,
    resolved,
    justApplied: applicable.map((r) => r.matchedTitle),
  });
}
