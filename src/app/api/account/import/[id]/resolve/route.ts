import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { fetchTmdbJson } from "@/utils/tmdbClient";
import { applyRows } from "@/utils/importApply";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const TMDB_BASE = "https://api.themoviedb.org/3";

type TmdbDetail = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  genres?: { id: number; name: string }[];
};

/**
 * POST /api/account/import/[id]/resolve — match one unresolved film by hand,
 * or skip it.
 *
 * This is the escape hatch that lets the resolver stay conservative. Because a
 * wrong automatic match is worse than no match, everything ambiguous lands
 * here, and this endpoint is what makes that cheap: one tap on a suggestion.
 *
 * Body: { rowId, tmdbId, tmdbType? }  → match and apply
 *       { rowId, skip: true }         → leave it out of the library for good
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const { id } = await ctx.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return jsonError("Invalid import id", 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const rowId = Number(body.rowId);
  if (!Number.isInteger(rowId)) return jsonError("rowId is required", 400);

  const supabase = await createClient();

  // Scoped by job_id as well as row id, so a row from someone else's import
  // can't be driven through this endpoint even if the id were guessed. RLS
  // covers it too; this is the cheap second lock.
  const { data: row } = await supabase
    .from("import_rows")
    .select("id, title, year, watched, watchlist, favorite, rating, review_text, watched_date, status")
    .eq("id", rowId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (!row) return jsonError("Row not found", 404);

  if (body.skip === true) {
    await supabase.from("import_rows").update({ status: "skipped" }).eq("id", rowId);
    return jsonSuccess({ ok: true, skipped: true });
  }

  const tmdbId = body.tmdbId != null ? String(body.tmdbId) : null;
  const tmdbType = body.tmdbType === "tv" ? "tv" : "movie";
  if (!tmdbId) return jsonError("tmdbId is required", 400);

  // Fetch the real record rather than trusting the client's title/poster: the
  // id is the only part of that payload worth believing.
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return jsonError("TMDB is not configured", 500);

  let detail: TmdbDetail;
  try {
    detail = await fetchTmdbJson<TmdbDetail>(
      `${TMDB_BASE}/${tmdbType}/${encodeURIComponent(tmdbId)}?api_key=${apiKey}`,
      { timeoutMs: 8000 },
    );
  } catch {
    return jsonError("Couldn't look that title up. Try again.", 502);
  }

  const matchedTitle = detail.title ?? detail.name ?? row.title;

  await applyRows(supabase, userId, [
    {
      id: row.id,
      tmdbId: String(detail.id),
      tmdbType,
      matchedTitle,
      posterPath: detail.poster_path ?? null,
      genres: (detail.genres ?? []).map((g) => g.name),
      watched: row.watched,
      watchlist: row.watchlist,
      favorite: row.favorite,
      rating: row.rating,
      reviewText: row.review_text,
      watchedDate: row.watched_date,
    },
  ]);

  await supabase
    .from("import_rows")
    .update({
      status: "applied",
      tmdb_id: String(detail.id),
      tmdb_type: tmdbType,
      matched_title: matchedTitle,
    })
    .eq("id", rowId);

  // A manual match is a resolution too — keep the job's tally honest.
  const { data: job } = await supabase
    .from("import_jobs")
    .select("resolved_rows")
    .eq("id", jobId)
    .maybeSingle();

  if (job) {
    await supabase
      .from("import_jobs")
      .update({ resolved_rows: (job.resolved_rows ?? 0) + 1 })
      .eq("id", jobId);
  }

  // Counters are maintained by 069/078's statement triggers on
  // user_media_status, favorite_items and watched_episodes — the write above
  // already recounted inside its own transaction. An explicit recount here is a
  // second cross-region round trip for a number that is already correct.

  return jsonSuccess({ ok: true, matchedTitle });
}
