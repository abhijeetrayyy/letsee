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

  await applyRows(supabase, userId, applicable);

  // Mark what happened. Applied rows carry the match so the summary can show
  // what a title actually became.
  await Promise.all([
    ...applicable.map((r) =>
      supabase
        .from("import_rows")
        .update({
          status: "applied",
          tmdb_id: r.tmdbId,
          tmdb_type: r.tmdbType,
          matched_title: r.matchedTitle,
        })
        .eq("id", r.id),
    ),
    unresolvedIds.length
      ? supabase.from("import_rows").update({ status: "unresolved" }).in("id", unresolvedIds)
      : null,
  ]);

  const processed = job.processed_rows + pending.length;
  const resolved = job.resolved_rows + applicable.length;
  const done = processed >= job.total_rows;

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

  return jsonSuccess({
    done,
    processed,
    total: job.total_rows,
    resolved,
    justApplied: applicable.map((r) => r.matchedTitle),
  });
}
