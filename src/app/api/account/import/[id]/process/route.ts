import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import {
  resolveByExternalId,
  resolveByTmdbId,
  resolveEpisodeNumbers,
  resolveTitle,
  type ResolvedTitle,
} from "@/utils/titleResolver";
import { applyRows, type ApplicableRow } from "@/utils/importApply";
import { GenreList } from "@/staticData/genreList";
import type { ImportEpisode } from "@/utils/letterboxd";

import { guard } from "@/lib/limits/guard";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Titles resolved per call.
 *
 * The TMDB client throttles to a 120ms gap between request starts (~8/s), so a
 * chunk of 25 takes roughly three seconds — comfortably inside the serverless
 * limit, and short enough that the progress bar moves often enough to look
 * alive rather than hung. Id-based rows cost one call each; name-based rows
 * the same; a Netflix series row with unnumbered episodes costs one more per
 * season it touches.
 */
const CHUNK = 25;

const GENRE_NAME_BY_ID = new Map<number, string>(
  GenreList.genres.map((g: { id: number; name: string }) => [g.id, g.name]),
);

type PendingRow = {
  id: number;
  title: string;
  year: number | null;
  watched: boolean;
  watchlist: boolean;
  favorite: boolean;
  rating: number | null;
  review_text: string | null;
  watched_date: string | null;
  media_hint: "movie" | "tv" | null;
  tmdb_hint: string | null;
  imdb_id: string | null;
  tvdb_id: string | null;
  viewing_dates: string[] | null;
  episodes: ImportEpisode[] | null;
};

/**
 * The order of attempts is the order of certainty: an id the source carried
 * is exact; an IMDb or TVDB id through /find is exact; only then a name.
 */
async function resolveRow(row: PendingRow): Promise<ResolvedTitle | null> {
  if (row.tmdb_hint && row.media_hint) {
    const byId = await resolveByTmdbId(row.tmdb_hint, row.media_hint);
    if (byId) return byId;
  }
  if (row.imdb_id || row.tvdb_id) {
    const byExternal = await resolveByExternalId(
      { imdbId: row.imdb_id, tvdbId: row.tvdb_id },
      GENRE_NAME_BY_ID,
      row.media_hint,
    );
    if (byExternal) return byExternal;
  }
  const outcome = await resolveTitle(row.title, row.year, GENRE_NAME_BY_ID, row.media_hint);
  return outcome.status === "resolved" ? outcome.match : null;
}

/**
 * Netflix knows an episode's name, not its number. Map names to numbers per
 * season; anything that does not match is left out rather than guessed.
 */
async function numberEpisodes(
  showId: string,
  episodes: ImportEpisode[],
): Promise<{ s: number; e: number; on: string | null }[]> {
  const numbered = episodes.filter((e) => e.e > 0).map((e) => ({ s: e.s, e: e.e, on: e.on }));
  const unnumbered = episodes.filter((e) => !(e.e > 0) && e.name);
  if (unnumbered.length === 0) return numbered;

  const bySeason = new Map<number, ImportEpisode[]>();
  for (const ep of unnumbered) bySeason.set(ep.s, [...(bySeason.get(ep.s) ?? []), ep]);

  for (const [season, list] of bySeason) {
    const names = [...new Set(list.map((e) => e.name as string))];
    const map = await resolveEpisodeNumbers(showId, season, names);
    for (const ep of list) {
      const n = map.get(ep.name as string);
      if (n) numbered.push({ s: season, e: n, on: ep.on });
    }
  }
  return numbered;
}

/**
 * POST /api/account/import/[id]/process — resolve and apply the next chunk.
 *
 * Called repeatedly by the client until `done`. Each call is independent and
 * idempotent: it claims whatever is still pending, so a dropped connection or a
 * closed tab costs at most one chunk, and reopening the page resumes.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const limited = await guard("importStep", _req);
  if (limited) return limited;
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
    .select(
      "id, title, year, watched, watchlist, favorite, rating, review_text, watched_date, media_hint, tmdb_hint, imdb_id, tvdb_id, viewing_dates, episodes",
    )
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
  // Episode numbering rides inside the same map: it is one more TMDB call
  // per series, and serialising it after the resolve pass made a TV Time
  // export of forty shows wait forty round trips in a row.
  const rows = pending as unknown as PendingRow[];
  const outcomes = await Promise.all(
    rows.map(async (row) => {
      const match = await resolveRow(row);
      const episodes =
        match && match.tmdbType === "tv" && row.episodes?.length
          ? await numberEpisodes(match.tmdbId, row.episodes)
          : [];
      return { row, match, episodes };
    }),
  );

  const applicable: ApplicableRow[] = [];
  const unresolvedIds: number[] = [];

  for (const { row, match, episodes } of outcomes) {
    if (!match) {
      unresolvedIds.push(row.id);
      continue;
    }
    applicable.push({
      id: row.id,
      tmdbId: match.tmdbId,
      tmdbType: match.tmdbType,
      matchedTitle: match.matchedTitle,
      posterPath: match.posterPath,
      genres: match.genres,
      watched: row.watched,
      watchlist: row.watchlist,
      favorite: row.favorite,
      rating: row.rating,
      reviewText: row.review_text,
      watchedDate: row.watched_date,
      viewingDates: row.viewing_dates ?? [],
      episodes,
    });
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

  // No recount. `applyRows` writes through user_media_status, favorite_items
  // and watched_episodes, and 069's statement-level triggers recount once per
  // statement — so a chunk of 200 rows costs one recount whether or not this
  // route asks for another.

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
