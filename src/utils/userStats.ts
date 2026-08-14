import type { createClient } from "@/utils/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type UserStats = {
  watchedCount: number;
  movieCount: number;
  tvCount: number;
  watchlistCount: number;
  watchingCount: number;
  favoriteCount: number;
  episodesCount: number;
  hoursWatched: number;
  watchedThisYear: number;
};

const EMPTY: UserStats = {
  watchedCount: 0, movieCount: 0, tvCount: 0, watchlistCount: 0,
  watchingCount: 0, favoriteCount: 0, episodesCount: 0,
  hoursWatched: 0, watchedThisYear: 0,
};

/**
 * The single source of truth for profile/home counters.
 *
 * One RPC. This used to fan out into nine queries per profile view, one of
 * which counted every row in watched_episodes — 7,000+ for an account with a
 * couple of long-running series — on figures that only change when the user
 * marks something. get_user_stats reads the totals maintained on write in
 * user_cout_stats and computes only the cheap exact counts live.
 *
 * Hours come from real per-title runtimes where they've been backfilled
 * (user_media_status.runtime_minutes). The previous flat 45 minutes an episode
 * overstated a cartoon-heavy history several times over.
 */
export async function getUserStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserStats> {
  const { data, error } = await supabase
    .rpc("get_user_stats", { p_user_id: userId })
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("get_user_stats:", error);
    return EMPTY;
  }

  const row = data as Record<string, number | string | null>;
  const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

  return {
    watchedCount: num(row.watched_count),
    movieCount: num(row.movie_count),
    tvCount: num(row.tv_count),
    watchlistCount: num(row.watchlist_count),
    watchingCount: num(row.watching_count),
    favoriteCount: num(row.favorite_count),
    episodesCount: num(row.episodes_count),
    hoursWatched: Math.round(num(row.minutes_watched) / 60),
    watchedThisYear: num(row.watched_this_year),
  };
}
