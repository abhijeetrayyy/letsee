import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";

/** Process shows in small batches to avoid ECONNRESET from too many concurrent TMDB requests. */
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 150;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function processShowData(
  showId: string,
  watched: { s: number; e: number }[],
  showData: Record<string, unknown>
): ProfileTvProgressItem {
  const name = (showData?.name as string) ?? "Unknown";
  const poster = showData?.poster_path ?? null;
  const seasons = Array.isArray(showData?.seasons) ? showData.seasons : [];
  const watchedSet = new Set(watched.map(({ s, e }) => `${s},${e}`));
  const allEpisodes: { s: number; e: number }[] = [];
  const seasonCounts = new Map<number, number>();
  for (const season of seasons) {
    const sn = Number((season as { season_number?: number }).season_number);
    if (sn < 0 || Number.isNaN(sn)) continue;
    const count = Number((season as { episode_count?: number }).episode_count) || 0;
    seasonCounts.set(sn, count);
    for (let ep = 1; ep <= count; ep++) allEpisodes.push({ s: sn, e: ep });
  }
  allEpisodes.sort((a, b) => a.s - b.s || a.e - b.e);
  let seasonsCompleted = 0;
  for (const [sn, total] of seasonCounts.entries()) {
    let watchedInSeason = 0;
    for (let ep = 1; ep <= total; ep++) {
      if (watchedSet.has(`${sn},${ep}`)) watchedInSeason++;
    }
    if (total > 0 && watchedInSeason >= total) seasonsCompleted++;
  }
  const next = allEpisodes.find(({ s, e }) => !watchedSet.has(`${s},${e}`));
  return {
    show_id: showId,
    show_name: name,
    poster_path: poster as string | null,
    seasons_completed: seasonsCompleted,
    episodes_watched: watched.length,
    next_season: next?.s ?? null,
    next_episode: next?.e ?? null,
    all_complete: !next,
  };
}

export type ProfileTvProgressItem = {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  seasons_completed: number;
  episodes_watched: number;
  next_season: number | null;
  next_episode: number | null;
  all_complete: boolean;
};

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return jsonError("userId query parameter is required", 400);
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const offsetParam = req.nextUrl.searchParams.get("offset");
  const limit = Math.min(Math.max(1, parseInt(limitParam ?? "5", 10) || 5), 100);
  const offset = Math.max(0, parseInt(offsetParam ?? "0", 10) || 0);

  const supabase = await createClient();
  if (!process.env.TMDB_API_KEY) {
    return jsonError("TMDB API key is missing", 500);
  }

  const { data: rows, error } = await supabase
    .from("watched_episodes")
    .select("show_id, season_number, episode_number")
    .eq("user_id", userId)
    .order("show_id", { ascending: true });

  if (error) {
    console.error("profile tv-progress:", error);
    return jsonError("Failed to fetch progress", 500);
  }

  const byShow = new Map<string, { s: number; e: number }[]>();
  for (const r of rows ?? []) {
    const list = byShow.get(r.show_id) ?? [];
    list.push({ s: r.season_number, e: r.episode_number });
    byShow.set(r.show_id, list);
  }

  const entries = Array.from(byShow.entries());
  const total = entries.length;

  const slice = entries.slice(offset, offset + limit);
  const results: ProfileTvProgressItem[] = [];

  for (let i = 0; i < slice.length; i += BATCH_SIZE) {
    const batch = slice.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async ([showId, watched]) => {
        const showData = await getTvShowWithSeasons(showId);
        if (!showData) return null;
        return processShowData(showId, watched, showData);
      })
    );
    for (const item of batchResults) {
      if (item) results.push(item);
    }
    if (i + BATCH_SIZE < slice.length) await delay(BATCH_DELAY_MS);
  }

  results.sort((a, b) => a.show_name.localeCompare(b.show_name));
  return jsonSuccess({ items: results, total }, { maxAge: 60 });
}
