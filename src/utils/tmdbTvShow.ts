/**
 * Cached TMDB TV show fetch (with seasons). Used by profile tv-progress,
 * continue-watching, and tv-progress to reduce calls and ECONNRESET.
 * Uses central tmdbClient (throttle + retry).
 */
import { unstable_cache } from "next/cache";
import { fetchTmdb } from "@/utils/tmdbClient";

/**
 * Six hours, up from five minutes.
 *
 * Five minutes was doing two expensive things at once. The obvious one is the
 * TMDB traffic: seven call sites read a show's season list through here, and
 * every one of them was re-fetching the same payload twelve times an hour for
 * a document that changes when an episode airs.
 *
 * The one that actually cost money is subtler, and it is R3 from the incident
 * document. Next takes the **minimum** of a route's `revalidate` and every
 * fetch performed inside that route's render. So the season page could not be
 * cached for longer than the shortest fetch inside it, whatever its own
 * `revalidate` said — this constant was the real ceiling on that page, and at
 * 300 it made an ISR window pointless. Raising the route without raising this
 * is exactly the "did nothing" result that commit 6d539ed had to measure its
 * way out of on the movie and series pages.
 *
 * Six hours rather than a day, and it matches the series page for the same
 * reason: this payload carries `next_episode_to_air`, the one fact in it with
 * a clock on it. The tradeoff is stated plainly — a newly aired episode can
 * take up to six hours to appear in continue-watching and in a season's
 * episode list. The product already accepts coarser than that elsewhere: the
 * new-episode notification cron runs once a day.
 */
const TMDB_REVALIDATE_SEC = 21600; // 6h

async function fetchTvShowWithSeasonsUncached(showId: string): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/tv/${showId}?api_key=${apiKey}&append_to_response=seasons`;

  try {
    const res = await fetchTmdb(url, { revalidate: TMDB_REVALIDATE_SEC });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return data;
  } catch (err) {
    console.warn("tmdbTvShow: fetch failed", showId, err);
    return null;
  }
}

/**
 * Fetch TV show details with seasons. Cached per showId for TMDB_REVALIDATE_SEC.
 * Use in profile tv-progress, continue-watching, tv-progress to avoid redundant TMDB calls.
 */
export async function getTvShowWithSeasons(showId: string): Promise<Record<string, unknown> | null> {
  return unstable_cache(
    () => fetchTvShowWithSeasonsUncached(showId),
    ["tmdb-tv-show-seasons", showId],
    { revalidate: TMDB_REVALIDATE_SEC }
  )();
}

async function fetchSeasonEpisodesUncached(
  showId: string,
  seasonNumber: number | string
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${apiKey}`;

  try {
    const res = await fetchTmdb(url, { revalidate: TMDB_REVALIDATE_SEC });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    console.warn("tmdbTvShow: season fetch failed", showId, seasonNumber, err);
    return null;
  }
}

/**
 * Fetch a single season's episode list. Cached per showId+seasonNumber.
 * Shared by the season page and the embedded season browser on the show page.
 */
export async function getSeasonEpisodes(
  showId: string,
  seasonNumber: number | string
): Promise<Record<string, unknown> | null> {
  return unstable_cache(
    () => fetchSeasonEpisodesUncached(showId, seasonNumber),
    ["tmdb-tv-season-episodes", showId, String(seasonNumber)],
    { revalidate: TMDB_REVALIDATE_SEC }
  )();
}
