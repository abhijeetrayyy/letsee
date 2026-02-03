/**
 * Single source of truth for search URL shape and parsing.
 * Pattern: /app/search/[query]?media_type=...&page=...&adult=0|1&year=...&lang=...&genre=...&region=...&watch=...
 * - query: path segment (search term or keyword ID when media_type=keyword)
 * - media_type: multi | movie | tv | person | keyword
 * - page: 1-based
 * - adult: 0 or 1
 * - year: optional release year (e.g. 2020)
 * - lang: optional language code (e.g. en-US)
 * - genre: optional genre id for discover
 * - region: optional watch region (e.g. US)
 * - watch: optional comma-separated watch provider ids
 */

export const SEARCH_MEDIA_TYPES = [
  "multi",
  "movie",
  "tv",
  "person",
  "keyword",
] as const;

export type SearchMediaType = (typeof SEARCH_MEDIA_TYPES)[number];

export const MIN_QUERY_LENGTH = 2;

export interface SearchParams {
  query: string;
  mediaType: SearchMediaType;
  page: number;
  adult: boolean;
  year: string;
  language: string;
  genre: string;
  watchRegion: string;
  watchProviders: string;
}

export function parseSearchQuery(value: string | undefined): string {
  if (value == null || value === "") return "";
  try {
    return decodeURIComponent(String(value)).trim();
  } catch {
    return String(value).trim();
  }
}

export function parseSearchParams(
  pathQuery: string | undefined,
  searchParams: URLSearchParams
): SearchParams {
  const rawQuery = pathQuery ?? "";
  const decoded = parseSearchQuery(rawQuery);
  const mediaTypeRaw = searchParams.get("media_type") ?? "multi";
  const mediaType: SearchMediaType = SEARCH_MEDIA_TYPES.includes(
    mediaTypeRaw as SearchMediaType
  )
    ? (mediaTypeRaw as SearchMediaType)
    : "multi";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const adult = searchParams.get("adult") === "1";
  const year = searchParams.get("year") ?? "";
  const language = searchParams.get("lang") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const watchRegion = searchParams.get("region") ?? "US";
  const watchProviders = searchParams.get("watch") ?? "";

  return {
    query: decoded,
    mediaType,
    page,
    adult,
    year,
    language,
    genre,
    watchRegion,
    watchProviders,
  };
}

export interface BuildSearchUrlParams {
  query: string;
  mediaType?: SearchMediaType;
  page?: number;
  adult?: boolean;
  year?: string;
  language?: string;
  genre?: string;
  watchRegion?: string;
  watchProviders?: string;
}

/**
 * Build the search results URL. Use for navigation (router.push, Link href).
 */
export function buildSearchUrl(params: BuildSearchUrlParams): string {
  const {
    query,
    mediaType = "multi",
    page = 1,
    adult = false,
    year = "",
    language = "",
    genre = "",
    watchRegion = "",
    watchProviders = "",
  } = params;

  const segment = query === "" ? "" : encodeURIComponent(query);
  const path = segment ? `/app/search/${segment}` : "/app/search";
  const sp = new URLSearchParams();
  sp.set("media_type", mediaType);
  sp.set("page", String(Math.max(1, page)));
  sp.set("adult", adult ? "1" : "0");
  if (year) sp.set("year", year);
  if (language) sp.set("lang", language);
  if (genre) sp.set("genre", genre);
  if (watchRegion) sp.set("region", watchRegion);
  if (watchProviders) sp.set("watch", watchProviders);
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

export function isValidSearchQuery(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}
