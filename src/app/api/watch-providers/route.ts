import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { Countrydata } from "@/staticData/countryName";

type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
};

type CountryAvailability = { code: string; name?: string };

type WatchProvidersResponse = {
  link?: string;
  providers: WatchProvider[];
  availableCountries?: CountryAvailability[];
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

  const results = data?.results ?? {};
  const countryData = results[country];

  // Countries where content has at least one provider (flatrate, rent, or buy)
  const countryCodesWithProviders = Object.entries(results).filter(
    ([_, d]) =>
      d &&
      ((d.flatrate?.length ?? 0) > 0 ||
        (d.rent?.length ?? 0) > 0 ||
        (d.buy?.length ?? 0) > 0)
  );
  const codeToName = new Map(Countrydata.map((c) => [c.iso_3166_1, c.english_name]));
  const availableCountries: CountryAvailability[] = countryCodesWithProviders.map(
    ([code]) => ({ code, name: codeToName.get(code) ?? code })
  );

  if (!countryData) {
    return jsonSuccess<WatchProvidersResponse>(
      {
        link: undefined,
        providers: [],
        availableCountries: availableCountries.slice(0, 20),
      },
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
      availableCountries: availableCountries.slice(0, 20),
    },
    { maxAge: 3600 }
  );
}
