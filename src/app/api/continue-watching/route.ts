import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";

const MAX_SHOWS = 12;
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 150;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ContinueWatchingItem = {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  next_season: number;
  next_episode: number;
  episodes_watched: number;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return jsonError("User isn't logged in", 401);
  }
  const userId = userData.user.id;

  if (!process.env.TMDB_API_KEY) {
    return jsonError("TMDB API key is missing", 500);
  }

  // Shows with at least one episode watched, ordered by most recently watched
  const { data: showRows, error: showError } = await supabase
    .from("watched_episodes")
    .select("show_id, watched_at")
    .eq("user_id", userId)
    .order("watched_at", { ascending: false });

  if (showError) {
    console.error("continue-watching shows:", showError);
    return jsonError("Failed to fetch progress", 500);
  }

  const showIdsByLastWatched = [...new Map((showRows ?? []).map((r) => [r.show_id, r.watched_at])).keys()].slice(
    0,
    MAX_SHOWS
  );
  if (showIdsByLastWatched.length === 0) {
    return jsonSuccess({ items: [] }, { maxAge: 0 });
  }

  const results: ContinueWatchingItem[] = [];

  for (let i = 0; i < showIdsByLastWatched.length; i += BATCH_SIZE) {
    const batch = showIdsByLastWatched.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (showId) => {
        const [watchedRes, showData] = await Promise.all([
          supabase
            .from("watched_episodes")
            .select("season_number, episode_number")
            .eq("user_id", userId)
            .eq("show_id", showId),
          getTvShowWithSeasons(showId),
        ]);
        if (watchedRes.error || !showData) return null;
        const watchedSet = new Set(
          (watchedRes.data ?? []).map((r) => `${r.season_number},${r.episode_number}`)
        );
        const episodesWatched = watchedSet.size;
        const name = (showData?.name as string) ?? "";
        const poster = showData?.poster_path ?? null;
        const seasons = Array.isArray(showData?.seasons) ? showData.seasons : [];
        const allEpisodes: { s: number; e: number }[] = [];
        for (const season of seasons) {
          const sn = Number((season as { season_number?: number }).season_number);
          if (sn < 0 || Number.isNaN(sn)) continue;
          const count = Number((season as { episode_count?: number }).episode_count) || 0;
          for (let ep = 1; ep <= count; ep++) allEpisodes.push({ s: sn, e: ep });
        }
        allEpisodes.sort((a, b) => a.s - b.s || a.e - b.e);
        const nextEp = allEpisodes.find(({ s, e }) => !watchedSet.has(`${s},${e}`));
        if (!nextEp) return null;
        return {
          show_id: showId,
          show_name: name,
          poster_path: poster,
          next_season: nextEp.s,
          next_episode: nextEp.e,
          episodes_watched: episodesWatched,
        } as ContinueWatchingItem;
      })
    );
    for (const item of batchResults) {
      if (item) results.push(item);
    }
    if (i + BATCH_SIZE < showIdsByLastWatched.length) await delay(BATCH_DELAY_MS);
  }

  return jsonSuccess({ items: results }, { maxAge: 0 });
}
