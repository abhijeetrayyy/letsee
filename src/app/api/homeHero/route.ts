import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

/** Romance (10749) + Drama (18) for love and emotion. Poster/banner only — no video fetch. */
const ROMANCE_DRAMA_GENRES = "10749,18";

const TARGET_ITEMS = 10;

export async function GET(_req: NextRequest) {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return jsonError("TMDB_API_KEY is missing on the server.", 500);
    }

    const discoverUrl = new URL("https://api.themoviedb.org/3/discover/movie");
    discoverUrl.searchParams.set("api_key", apiKey);
    discoverUrl.searchParams.set("language", "en-US");
    discoverUrl.searchParams.set("with_genres", ROMANCE_DRAMA_GENRES);
    discoverUrl.searchParams.set("sort_by", "popularity.desc");
    discoverUrl.searchParams.set("vote_count.gte", "100");
    discoverUrl.searchParams.set("page", "1");

    const discover = await serverFetchJson<{ results: any[] }>(discoverUrl.toString(), { retries: 3 });
    const results = (discover.results ?? []).slice(0, TARGET_ITEMS);

    const items = results.map((movie: any) => ({
      id: movie.id,
      title: movie.title ?? "Unknown",
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date ?? null,
      vote_average: movie.vote_average ?? null,
    }));

    return jsonSuccess(items, {
      maxAge: 3600,
      staleWhileRevalidate: 1800,
    });
  } catch (error) {
    console.error("HomeHero API error:", error);
    return jsonError((error as Error).message ?? "Internal Server Error", 500);
  }
}
