import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  display_priority?: number;
};

type TmdbResponse = {
  results?: TmdbProvider[];
};

/**
 * GET /api/watch-providers/list?region=US&mediaType=movie
 * Returns list of watch providers for use in discover/search "Where to watch" filter.
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get("mediaType") || "movie";
  const region = searchParams.get("region") || "US";

  if (!apiKey) {
    return jsonError("TMDB API key is missing on the server.", 500);
  }

  if (mediaType !== "movie" && mediaType !== "tv") {
    return jsonError("mediaType must be movie or tv.", 400);
  }

  const path = mediaType === "movie" ? "watch/providers/movie" : "watch/providers/tv";
  const url = `https://api.themoviedb.org/3/${path}?api_key=${apiKey}&watch_region=${encodeURIComponent(region)}`;

  try {
    const data = await serverFetchJson<TmdbResponse>(url, { timeoutMs: 8000 });
    const results = data?.results ?? [];
    const providers = results
      .filter((p) => p.provider_id != null && p.provider_name)
      .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
      .map((p) => ({ id: p.provider_id, name: p.provider_name }));
    return jsonSuccess<{ providers: { id: number; name: string }[] }>(
      { providers },
      { maxAge: 86400 }
    );
  } catch (err) {
    return jsonError((err as Error).message ?? "Failed to fetch watch providers list.", 502);
  }
}
