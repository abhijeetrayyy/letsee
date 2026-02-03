/**
 * Cached TMDB TV show fetch (with seasons). Used by profile tv-progress,
 * continue-watching, and tv-progress to reduce calls and ECONNRESET.
 * Uses central tmdbClient (throttle + retry).
 */
import { unstable_cache } from "next/cache";
import { fetchTmdb } from "@/utils/tmdbClient";

const TMDB_REVALIDATE_SEC = 300; // 5 min

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
