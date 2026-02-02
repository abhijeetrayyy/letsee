import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(_req: NextRequest) {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return jsonError("TMDB_API_KEY is missing on the server.", 500);
    }

    const data = await serverFetchJson<{ results: any[] }>(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=en-US&page=1`,
      { retries: 3 }
    );
    const topMovies = (data.results ?? []).slice(0, 10);

    const moviesWithTrailers = await Promise.all(
      topMovies.map(async (movie: { id: number; title: string }, index: number) => {
        await delay(index * 100);
        try {
          const videoData = await serverFetchJson<{ results: any[] }>(
            `https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${apiKey}`
          );
          const trailer = (videoData.results ?? []).find(
            (v: { type: string; site: string; key: string }) =>
              v.type === "Trailer" && v.site === "YouTube"
          );
          return {
            id: movie.id,
            title: movie.title,
            trailer: trailer
              ? `https://www.youtube.com/embed/${trailer.key}`
              : undefined,
          };
        } catch {
          return { id: movie.id, title: movie.title, trailer: undefined };
        }
      })
    );

    const filtered = moviesWithTrailers.filter((m) => m.trailer);
    return jsonSuccess(filtered, {
      maxAge: 86400,
      staleWhileRevalidate: 43200,
    });
  } catch (error) {
    console.error("HomeVideo API error:", error);
    return jsonError(
      (error as Error).message ?? "Internal Server Error",
      500
    );
  }
}
