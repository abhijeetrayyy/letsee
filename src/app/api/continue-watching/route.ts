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
  next_season: number | null;
  next_episode: number | null;
  episodes_watched: number;
  total_episodes: number;
  tv_status: string | null;
  is_caught_up: boolean;
  last_air_date: string | null;
  next_air_date: string | null;
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

  const { data: showRows, error: showError } = await supabase
    .from("watched_episodes")
    .select("show_id, watched_at")
    .eq("user_id", userId)
    .order("watched_at", { ascending: false });

  if (showError) {
    console.error("continue-watching shows:", showError);
    return jsonError("Failed to fetch progress", 500);
  }

  const showIdsByLastWatched = [
    ...new Map((showRows ?? []).map((r) => [r.show_id, r.watched_at])).keys(),
  ].slice(0, MAX_SHOWS + 5); // Fetch a few more case we filter some out

  if (showIdsByLastWatched.length === 0) {
    return jsonSuccess({ items: [] }, { maxAge: 0 });
  }

  const results: ContinueWatchingItem[] = [];

  for (let i = 0; i < showIdsByLastWatched.length; i += BATCH_SIZE) {
    const batch = showIdsByLastWatched.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (showId) => {
        const [watchedRes, showData, statusRes] = await Promise.all([
          supabase
            .from("watched_episodes")
            .select("season_number, episode_number")
            .eq("user_id", userId)
            .eq("show_id", showId),
          getTvShowWithSeasons(showId),
          supabase
            .from("user_tv_list")
            .select("status")
            .eq("user_id", userId)
            .eq("show_id", showId)
            .maybeSingle(),
        ]);

        if (watchedRes.error || !showData) return null;

        const currentStatus = statusRes?.data?.status;

        // 1. Filter out dropped/completed/on_hold
        if (["dropped", "completed", "on_hold"].includes(currentStatus || "")) {
          return null;
        }

        const watchedSet = new Set(
          (watchedRes.data ?? []).map(
            (r) => `${r.season_number},${r.episode_number}`,
          ),
        );
        const episodesWatched = watchedSet.size;
        const name = (showData?.name as string) ?? "";
        const poster = showData?.poster_path ?? null;
        const seasons = Array.isArray(showData?.seasons)
          ? showData.seasons
          : [];

        let totalEpisodes = 0;
        const allEpisodes: { s: number; e: number; air_date?: string }[] = [];
        const now = new Date();

        for (const season of seasons) {
          const sn = Number(
            (season as { season_number?: number }).season_number,
          );
          if (sn < 0 || Number.isNaN(sn)) continue; // Skip specials/season 0 for "next up" logic? Or include?
          // Usually we skip specials for main progress, but let's see.
          // If we include specials, total count increases.
          // Let's exclude Season 0 from total count and next up logic typicaly.
          if (sn === 0) continue;

          const count =
            Number((season as { episode_count?: number }).episode_count) || 0;

          totalEpisodes += count;

          for (let ep = 1; ep <= count; ep++) {
            // We don't have per-episode air_date here easily without fetching season details?
            // Actually `getTvShowWithSeasons` just calls `tv/{id}?append_to_response=seasons`.
            // The `seasons` array in TV detail response ONLY has season summary (episode_count, air_date of season).
            // It does NOT have individual episodes.
            // Logic in `getTvShowWithSeasons` implies we get full season data?
            // No, `append_to_response=seasons` is not valid. It's just part of main response.
            // Main response `seasons` property is summary.
            // WE DO NOT HAVE EPISODE DATA Here.
            // We can't know if an episode is aired or not without fetching season details.
            // But we need to find "next episode".
            // We simply assume next episode is first unwatched.
            // If we pick an unaired one, the UI should handle it?
            // Or we fetch season details if we get close?
            // Current logic creates `allEpisodes` just by count.
            allEpisodes.push({ s: sn, e: ep });
          }
        }

        allEpisodes.sort((a, b) => a.s - b.s || a.e - b.e);

        const nextEp = allEpisodes.find(
          ({ s, e }) => !watchedSet.has(`${s},${e}`),
        );

        // Caught up logic:
        // If !nextEp, we are caught up (or it's all watched).
        // Since we filtered "completed", this implies "Caught up / Waiting for new season".

        const lastAir = (showData as any).last_episode_to_air;
        const nextAir = (showData as any).next_episode_to_air;

        return {
          show_id: showId,
          show_name: name,
          poster_path: poster,
          next_season: nextEp?.s ?? null,
          next_episode: nextEp?.e ?? null,
          episodes_watched: episodesWatched,
          total_episodes: totalEpisodes,
          tv_status: currentStatus ?? null,
          is_caught_up: !nextEp,
          last_air_date: lastAir?.air_date ?? null,
          next_air_date: nextAir?.air_date ?? null,
        } as ContinueWatchingItem;
      }),
    );
    for (const item of batchResults) {
      if (item) results.push(item as ContinueWatchingItem);
    }
    if (results.length >= MAX_SHOWS) break;
    if (i + BATCH_SIZE < showIdsByLastWatched.length)
      await delay(BATCH_DELAY_MS);
  }

  return jsonSuccess({ items: results }, { maxAge: 0 });
}
