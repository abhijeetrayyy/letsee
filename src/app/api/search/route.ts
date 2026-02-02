import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const mediaType = searchParams.get("media_type") ?? "multi";

  if (!query.trim()) {
    return jsonError("Query is required", 400);
  }

  if (!process.env.TMDB_API_KEY) {
    return jsonError("TMDB_API_KEY is missing on the server.", 500);
  }

  try {
    const base = "https://api.themoviedb.org/3";
    const key = process.env.TMDB_API_KEY;
    const encoded = encodeURIComponent(query.trim());

    const url =
      mediaType === "keyword"
        ? `${base}/search/keyword?api_key=${key}&query=${encoded}`
        : (() => {
            let endpoint = "multi";
            if (mediaType === "movie") endpoint = "movie";
            else if (mediaType === "tv") endpoint = "tv";
            else if (mediaType === "person") endpoint = "person";
            return `${base}/search/${endpoint}?api_key=${key}&query=${encoded}`;
          })();

    const data = await serverFetchJson<unknown>(url);
    return jsonSuccess(data, {
      maxAge: 300,
      staleWhileRevalidate: 600,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return jsonError(
      (error as Error).message ?? "Search request failed",
      500
    );
  }
}
