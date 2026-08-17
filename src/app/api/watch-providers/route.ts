import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { Countrydata } from "@/staticData/countryName";

type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
};

/**
 * The five ways JustWatch says a title can be watched, keyed as TMDB keys them.
 *
 * This route used to read three of them and hand back a single flat `providers`
 * array, which threw away the only thing a reader actually wants to know: what
 * it costs. Measured on 3 Idiots — rent and buy in both US and IN, no
 * subscription anywhere — the old shape said "here are Google Play and YouTube"
 * without saying you have to pay per view, and the viewer that consumed it drew
 * flatrate only, so the film rendered as an empty panel in both regions.
 *
 * `free` and `ads` are kept apart on purpose. Both cost nothing; one of them
 * costs you the ad break, and Oppenheimer in the US sits in `ads` (Fandango at
 * Home Free) while Parasite in the US sits in `free` (Kanopy). Merging them
 * would make the page promise something it cannot deliver.
 */
const OFFER_KINDS = ["flatrate", "free", "ads", "rent", "buy"] as const;
type OfferKind = (typeof OFFER_KINDS)[number];

type RegionOffers = Partial<Record<OfferKind, WatchProvider[]>> & { link?: string };

type CountryAvailability = { code: string; name: string };

type WatchProvidersResponse = {
  country: string;
  link: string | null;
  flatrate: WatchProvider[];
  free: WatchProvider[];
  ads: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  /**
   * The flat union the outgoing WatchOptionsViewer reads. It exists so that
   * component keeps working until it is unmounted for good; anything new should
   * read the five buckets, which is the same data with the price attached.
   */
  providers: WatchProvider[];
  availableCountries: CountryAvailability[];
};

const codeToName = new Map(Countrydata.map((c) => [c.iso_3166_1, c.english_name]));

/**
 * TMDB's `display_priority` is JustWatch's own regional ranking — in India it
 * puts JioHotstar above the transactional stores, in the US it puts the
 * subscription tier above the ad-supported one. It is better ordering than
 * anything we could invent from here, and it is per-region, so it is worth
 * respecting rather than sorting alphabetically.
 */
function ordered(list: WatchProvider[] | undefined): WatchProvider[] {
  if (!list?.length) return [];
  const seen = new Set<number>();
  const unique = list.filter((p) => {
    if (seen.has(p.provider_id)) return false;
    seen.add(p.provider_id);
    return true;
  });
  return unique
    .sort((a, b) => {
      const priority = (a.display_priority ?? 999) - (b.display_priority ?? 999);
      return priority !== 0 ? priority : a.provider_name.localeCompare(b.provider_name);
    })
    .map((p) => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path ?? null,
    }));
}

function hasAnyOffer(offers: RegionOffers | undefined): boolean {
  if (!offers) return false;
  return OFFER_KINDS.some((kind) => (offers[kind]?.length ?? 0) > 0);
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get("mediaType");
  const mediaId = searchParams.get("mediaId");
  const country = (searchParams.get("country") || "US").slice(0, 2).toUpperCase();

  if (!apiKey) {
    return jsonError("TMDB API key is missing on the server.", 500);
  }

  if (!mediaId || !/^\d+$/.test(mediaId)) {
    return jsonError("Missing or malformed mediaId.", 400);
  }

  if (mediaType !== "movie" && mediaType !== "tv") {
    return jsonError("mediaType must be movie or tv.", 400);
  }

  // `watch/providers` with a slash, as its own request. `watch_providers` is
  // not a valid append_to_response key — measured, TMDB silently omits it.
  const url = `https://api.themoviedb.org/3/${mediaType}/${mediaId}/watch/providers?api_key=${apiKey}`;

  let data: { results?: Record<string, RegionOffers> };
  try {
    data = await serverFetchJson<typeof data>(url, { timeoutMs: 8000 });
  } catch (err) {
    return jsonError((err as Error).message ?? "Failed to fetch watch providers.", 502);
  }

  const results = data?.results ?? {};
  const offers = results[country];

  /**
   * Every region carrying this title, uncapped and named.
   *
   * It was capped at 20 before, which is not a rounding error: Gangs of
   * Wasseypur is carried in 7 regions and DDLJ in 131, so the cap either
   * changed nothing or hid four fifths of the answer with no way to tell which.
   * The client needs the whole list to offer a region that actually has it.
   */
  const availableCountries: CountryAvailability[] = Object.entries(results)
    .filter(([, regionOffers]) => hasAnyOffer(regionOffers))
    .map(([code]) => ({ code, name: codeToName.get(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const flatrate = ordered(offers?.flatrate);
  const free = ordered(offers?.free);
  const ads = ordered(offers?.ads);
  const rent = ordered(offers?.rent);
  const buy = ordered(offers?.buy);

  const union: WatchProvider[] = [];
  const unionSeen = new Set<number>();
  for (const provider of [...flatrate, ...free, ...ads, ...rent, ...buy]) {
    if (unionSeen.has(provider.provider_id)) continue;
    unionSeen.add(provider.provider_id);
    union.push(provider);
  }

  /**
   * The per-region link TMDB hands back already carries `?locale=IN`, which is
   * why it is the only link this route emits. When a region has offers but no
   * link — rare, but the field is optional — the same URL is constructible, and
   * TMDB resolves it without the title slug (verified, 200).
   */
  const link =
    offers?.link ??
    (hasAnyOffer(offers)
      ? `https://www.themoviedb.org/${mediaType}/${mediaId}/watch?locale=${country}`
      : null);

  return jsonSuccess<WatchProvidersResponse>(
    {
      country,
      link,
      flatrate,
      free,
      ads,
      rent,
      buy,
      providers: union,
      availableCountries,
    },
    { maxAge: 3600 }
  );
}
