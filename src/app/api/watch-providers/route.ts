import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
};

type WatchProvidersResponse = {
  link?: string;
  providers: WatchProvider[];
};

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get("mediaType");
  const mediaId = searchParams.get("mediaId");
  const country = searchParams.get("country") || "US";

  if (!apiKey) {
    return jsonError("TMDB API key is missing on the server.", 500);
  }

  if (!mediaType || !mediaId) {
    return jsonError("Missing mediaType or mediaId.", 400);
  }

  if (mediaType !== "movie" && mediaType !== "tv") {
    return jsonError("mediaType must be movie or tv.", 400);
  }

  const url = `https://api.themoviedb.org/3/${mediaType}/${mediaId}/watch/providers?api_key=${apiKey}`;

  let data: { results?: Record<string, { link?: string; flatrate?: WatchProvider[]; rent?: WatchProvider[]; buy?: WatchProvider[] }> };
  try {
    data = await serverFetchJson<typeof data>(url, { timeoutMs: 8000 });
  } catch (err) {
    return jsonError((err as Error).message ?? "Failed to fetch watch providers.", 502);
  }

  const countryData = data?.results?.[country];

  if (!countryData) {
    return jsonSuccess<WatchProvidersResponse>(
      { link: undefined, providers: [] },
      { maxAge: 3600 }
    );
  }

  const allProviders: WatchProvider[] = [
    ...(countryData.flatrate || []),
    ...(countryData.rent || []),
    ...(countryData.buy || []),
  ].reduce((unique, provider) => {
    return unique.some((p) => p.provider_id === provider.provider_id)
      ? unique
      : [...unique, provider];
  }, [] as WatchProvider[]);

  return jsonSuccess<WatchProvidersResponse>(
    {
      link: countryData.link,
      providers: allProviders,
    },
    { maxAge: 3600 }
  );
}
