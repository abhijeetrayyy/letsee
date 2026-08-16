import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { resolveTitle } from "@/utils/titleResolver";
import { GenreList } from "@/staticData/genreList";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Unresolved rows shown at once. More than this is a list, not a task. */
const UNRESOLVED_PAGE = 25;

const GENRE_NAME_BY_ID = new Map<number, string>(
  GenreList.genres.map((g: { id: number; name: string }) => [g.id, g.name]),
);

/**
 * GET /api/account/import/[id] — progress, and the films we couldn't place.
 *
 * `?suggestions=1` re-runs the search for the unresolved page so each row can
 * offer a one-tap match. It's off by default because it costs one TMDB call per
 * row and the polling loop doesn't need it — only the final screen does.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const { id } = await ctx.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return jsonError("Invalid import id", 400);

  const supabase = await createClient();

  const { data: job } = await supabase
    .from("import_jobs")
    .select("id, source, status, total_rows, processed_rows, resolved_rows, error, created_at, completed_at")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return jsonError("Import not found", 404);

  const { data: unresolved } = await supabase
    .from("import_rows")
    .select("id, title, year, letterboxd_uri, watched, watchlist, rating")
    .eq("job_id", jobId)
    .eq("status", "unresolved")
    .order("title")
    .limit(UNRESOLVED_PAGE);

  const wantSuggestions = req.nextUrl.searchParams.get("suggestions") === "1";

  let rows = (unresolved ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    year: r.year,
    letterboxdUri: r.letterboxd_uri,
    watched: r.watched,
    watchlist: r.watchlist,
    rating: r.rating,
    suggestions: [] as { tmdbId: string; title: string; year: number | null; posterPath: string | null }[],
  }));

  if (wantSuggestions && rows.length > 0) {
    const withSuggestions = await Promise.all(
      rows.map(async (row) => {
        const outcome = await resolveTitle(row.title, row.year, GENRE_NAME_BY_ID);
        // A row here is unresolved by definition, so only the candidate list
        // matters; a "resolved" verdict on a retry just becomes the top pick.
        const candidates =
          outcome.status === "unresolved" ? outcome.candidates : [outcome.match];
        return {
          ...row,
          suggestions: candidates.map((c) => ({
            tmdbId: c.tmdbId,
            title: c.matchedTitle,
            year: c.releaseYear,
            posterPath: c.posterPath,
          })),
        };
      }),
    );
    rows = withSuggestions;
  }

  const { count: totalUnresolved } = await supabase
    .from("import_rows")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", "unresolved");

  return jsonSuccess({
    job: {
      id: Number(job.id),
      source: job.source,
      status: job.status,
      total: job.total_rows,
      processed: job.processed_rows,
      resolved: job.resolved_rows,
      error: job.error,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    },
    unresolved: rows,
    unresolvedTotal: totalUnresolved ?? 0,
  });
}
