import { NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

const CALENDAR_CACHE_SEC = 900; // 15 min

async function fetchCalendarUncached() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY is missing on the server.");

  const [nowPlayingRes, onTheAirRes] = await Promise.all([
    serverFetchJson<{ results: any[] }>(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=en-US&page=1`,
      { timeoutMs: 10000 }
    ),
    serverFetchJson<{ results: any[] }>(
      `https://api.themoviedb.org/3/tv/on_the_air?api_key=${apiKey}&language=en-US&page=1`,
      { timeoutMs: 10000 }
    ),
  ]);

  const nowPlaying = Array.isArray(nowPlayingRes?.results) ? nowPlayingRes.results : [];
  const tvAiring = Array.isArray(onTheAirRes?.results) ? onTheAirRes.results : [];

  return {
    nowPlaying: { results: nowPlaying },
    tvAiring: { results: tvAiring },
  };
}

/** GET /api/calendar — In theaters (now_playing) + TV airing this week (on_the_air) from TMDB. Cached 15 min. */
export async function GET(_req: NextRequest) {
  try {
    const data = await unstable_cache(
      fetchCalendarUncached,
      ["api-calendar"],
      { revalidate: CALENDAR_CACHE_SEC }
    )();

    return jsonSuccess(data, { maxAge: 3600, staleWhileRevalidate: 1800 });
  } catch (err) {
    console.error("Calendar API error:", err);
    return jsonError((err as Error).message ?? "Failed to fetch calendar", 500);
  }
}
