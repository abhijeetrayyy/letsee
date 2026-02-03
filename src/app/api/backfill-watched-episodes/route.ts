import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { fetchTmdb } from "@/utils/tmdbClient";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

/**
 * Backfill watched_episodes for the current user: for every TV show they have
 * in watched_items (marked as Watched before episode tracking existed),
 * fetch TMDB seasons/episodes and insert all into watched_episodes.
 * Safe to call multiple times (uses ON CONFLICT DO NOTHING).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return jsonError("User isn't logged in", 401);
  }
  const userId = userData.user.id;

  if (!TMDB_API_KEY) {
    return jsonError("TMDB API key is missing", 500);
  }

  const { data: watchedTv, error: watchedError } = await supabase
    .from("watched_items")
    .select("item_id")
    .eq("user_id", userId)
    .eq("item_type", "tv");

  if (watchedError) {
    console.error("backfill-watched-episodes watched_items:", watchedError);
    return jsonError("Failed to fetch watched TV shows", 500);
  }

  const showIds = [...new Set((watchedTv ?? []).map((r) => r.item_id))];
  if (showIds.length === 0) {
    return jsonSuccess(
      { message: "No TV shows in Watched to backfill", shows_backfilled: 0, episodes_inserted: 0 },
      { maxAge: 0 }
    );
  }

  let totalEpisodes = 0;

  for (const showId of showIds) {
    const res = await fetchTmdb(
      `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}&append_to_response=seasons`
    );
    if (!res.ok) continue;
    const data = await res.json();
    const seasons = Array.isArray(data?.seasons) ? data.seasons : [];
    const episodes: { season_number: number; episode_number: number }[] = [];
    for (const season of seasons) {
      const sn = Number(season.season_number);
      if (sn < 0 || Number.isNaN(sn)) continue;
      const count = Number(season.episode_count) || 0;
      for (let ep = 1; ep <= count; ep++) {
        episodes.push({ season_number: sn, episode_number: ep });
      }
    }
    if (episodes.length === 0) continue;

    const { data: inserted, error: rpcError } = await supabase.rpc(
      "backfill_watched_episodes_for_show",
      {
        p_user_id: userId,
        p_show_id: showId,
        p_episodes: episodes,
      }
    );
    if (!rpcError && typeof inserted === "number") {
      totalEpisodes += inserted;
    }
  }

  return jsonSuccess(
    {
      message: "Backfill complete",
      shows_backfilled: showIds.length,
      episodes_inserted: totalEpisodes,
    },
    { maxAge: 0 }
  );
}
