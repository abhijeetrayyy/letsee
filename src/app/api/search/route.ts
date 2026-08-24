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

    // company and collection are real TMDB search endpoints and were falling
    // through to /search/multi, which searches only movie, tv and person — so
    // asking for a studio silently returned films with that word in the title.
    // There is deliberately no `network` here: /search/network 404s, and
    // networks are served from a checked-in list instead.
    const url =
      mediaType === "keyword" || mediaType === "company" || mediaType === "collection"
        ? `${base}/search/${mediaType}?api_key=${key}&query=${encoded}`
        : (() => {
            let endpoint = "multi";
            if (mediaType === "movie") endpoint = "movie";
            else if (mediaType === "tv") endpoint = "tv";
            else if (mediaType === "person") endpoint = "person";
            return `${base}/search/${endpoint}?api_key=${key}&query=${encoded}`;
          })();

    const data = await serverFetchJson<unknown>(url);
    return jsonSuccess(data, {
      // Half an hour, up from five minutes. A TMDB search for the same
      // string returns the same films all day; five minutes meant popular
      // queries were re-proxied twelve times an hour for identical results.
      maxAge: 1800,
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
