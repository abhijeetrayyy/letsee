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
  watchedThisYear: number;
};

const EMPTY: UserStats = {
  watchedCount: 0, movieCount: 0, tvCount: 0, watchlistCount: 0,
  watchingCount: 0, favoriteCount: 0, episodesCount: 0, watchedThisYear: 0,
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
 * There is deliberately no hours figure. It could only ever be an estimate
 * built on assumptions nobody can check, and it dwarfed every exact number
 * beside it. Episodes is a count of rows the user actually created.
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
    watchedThisYear: num(row.watched_this_year),
  };
}
