import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";
import { createClient } from "@/utils/supabase/server";

interface UpcomingEpisode {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  season_number: number;
  episode_number: number;
  episode_name: string;
  air_date: string;
  is_watched: boolean;
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  if (!process.env.TMDB_API_KEY) {
    return jsonError("TMDB API key missing", 500);
  }

  // Get user's watching shows
  const { data: watchingShows } = await supabase
    .from("user_media_status")
    .select("item_id")
    .eq("user_id", userId)
    .eq("item_type", "tv")
    .eq("status", "watching");

  if (!watchingShows?.length) {
    return jsonSuccess({ episodes: [] }, { maxAge: 0 });
  }

  const showIds = watchingShows.map((s) => s.item_id);
  const { fetchTmdb } = await import("@/utils/tmdbClient");

  const perShowResults = await Promise.all(
    showIds.slice(0, 10).map(async (showId): Promise<UpcomingEpisode | null> => {
      try {
        const [showRes, watchedRes] = await Promise.all([
          fetchTmdb(
            `https://api.themoviedb.org/3/tv/${showId}?api_key=${process.env.TMDB_API_KEY}`
          ),
          supabase
            .from("watched_episodes")
            .select("season_number, episode_number")
            .eq("user_id", userId)
            .eq("show_id", showId),
        ]);

        if (!showRes.ok) return null;
        const show = await showRes.json();
        const watchedSet = new Set(
          (watchedRes.data ?? []).map((r) => `${r.season_number}-${r.episode_number}`)
        );

        const nextEp = show.next_episode_to_air;
        if (!nextEp?.air_date) return null;

        const airDate = new Date(nextEp.air_date);
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Only include episodes airing within the next week
        if (airDate < now || airDate > weekFromNow) return null;

        return {
          show_id: showId,
          show_name: show.name ?? "",
          poster_path: show.poster_path ?? null,
          season_number: nextEp.season_number,
          episode_number: nextEp.episode_number,
          episode_name: nextEp.name ?? `Episode ${nextEp.episode_number}`,
          air_date: nextEp.air_date,
          is_watched: watchedSet.has(`${nextEp.season_number}-${nextEp.episode_number}`),
        };
      } catch {
        return null;
      }
    })
  );

  const results = perShowResults.filter((r): r is UpcomingEpisode => r !== null);
  results.sort((a, b) => a.air_date.localeCompare(b.air_date));

  return jsonSuccess({ episodes: results }, { maxAge: 300 });
}
