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

/** Rough runtimes — we don't store per-title runtime. */
const HOURS_PER_MOVIE = 2;
const HOURS_PER_EPISODE = 0.75;
/** Assumed length of a series marked watched with no episodes tracked. */
const ASSUMED_EPISODES_PER_SHOW = 8;

/**
 * The single source of truth for profile/home counters.
 *
 * These used to be computed independently in each place, so they disagreed:
 * the home sidebar showed hours as (everything watched x 2), the profile
 * header as (movies x 2) with episodes hardcoded to zero — 542h against 6271
 * tracked episodes — and "This Year" was counted from watched_items while
 * Movies/TV came from user_media_status, so the year total exceeded the
 * all-time total.
 *
 * user_media_status is authoritative: one row per title, one status column.
 * watched_items is the legacy mirror and is never counted here.
 */
export async function getUserStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserStats> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

  const countOf = (build: (q: any) => any) =>
    build(
      supabase
        .from("user_media_status")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    );

  const [
    watched,
    movies,
    tv,
    watchlist,
    watching,
    favorites,
    episodes,
    thisYear,
    tvNoEpisodes,
  ] = await Promise.all([
    countOf((q: any) => q.eq("status", "watched")),
    countOf((q: any) => q.eq("status", "watched").eq("item_type", "movie")),
    countOf((q: any) => q.eq("status", "watched").eq("item_type", "tv")),
    countOf((q: any) => q.eq("status", "watchlist")),
    countOf((q: any) => q.eq("status", "watching")),
    supabase
      .from("favorite_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    // Season 0 is specials, excluded everywhere else too.
    supabase
      .from("watched_episodes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("season_number", 0),
    countOf((q: any) => q.eq("status", "watched").gte("updated_at", yearStart)),
    // Watched series and the shows that actually have episode rows, so we can
    // tell which were marked watched without per-episode tracking. Only tens
    // of rows per user, so no need for a dedicated aggregate.
    Promise.all([
      supabase
        .from("user_media_status")
        .select("item_id")
        .eq("user_id", userId)
        .eq("item_type", "tv")
        .eq("status", "watched"),
      supabase.from("watched_episodes").select("show_id").eq("user_id", userId),
    ]),
  ]);

  const movieCount = movies.count ?? 0;
  const episodesCount = episodes.count ?? 0;

  const [watchedShows, episodeShows] = tvNoEpisodes;
  const tracked = new Set(
    (episodeShows.data ?? []).map((r: { show_id: string }) => String(r.show_id)),
  );
  // A series marked watched without per-episode tracking still took time.
  const untrackedShows = (watchedShows.data ?? []).filter(
    (r: { item_id: string }) => !tracked.has(String(r.item_id)),
  ).length;

  const hoursWatched = Math.round(
    movieCount * HOURS_PER_MOVIE +
      episodesCount * HOURS_PER_EPISODE +
      untrackedShows * ASSUMED_EPISODES_PER_SHOW * HOURS_PER_EPISODE,
  );

  return {
    watchedCount: watched.count ?? 0,
    movieCount,
    tvCount: tv.count ?? 0,
    watchlistCount: watchlist.count ?? 0,
    watchingCount: watching.count ?? 0,
    favoriteCount: favorites.count ?? 0,
    episodesCount,
    hoursWatched,
    watchedThisYear: thisYear.count ?? 0,
  };
}
