import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { genreId, page = 1 } = body;

    if (!process.env.TMDB_API_KEY) {
      return jsonError("TMDB_API_KEY is missing on the server.", 500);
    }

    const url = `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&with_genres=${genreId}&page=${page}`;
    const data = await serverFetchJson<unknown>(url);
    return jsonSuccess(data, { maxAge: 600, staleWhileRevalidate: 300 });
  } catch (error) {
    console.error("Genre search tv error:", error);
    return jsonError(
      (error as Error).message ?? "Search service is unavailable.",
      500
    );
  }
}
