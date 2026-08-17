/**
 * BrowseParams → a TMDB discover query.
 *
 * Kept apart from `browseUrl.ts` because that module is imported by client
 * components and none of this — parameter spellings, vote floors, date
 * arithmetic — belongs in a page bundle. This half runs on the server only.
 *
 * The movie and TV discover endpoints are *nearly* the same API, and the near
 * is the dangerous part. `/discover/tv` does not reject `primary_release_date`;
 * it ignores it. Measured: `/discover/tv?primary_release_date.gte=2020-01-01`
 * returns 229,186 results — the entire unfiltered catalogue — while the
 * equivalent `first_air_date.gte` returns 5,645. A decade filter written the
 * movie way would therefore look like it worked and filter nothing at all.
 */

import type { BrowseParams, BrowseSort, BrowseType } from "@/utils/browseUrl";

/** The date field each endpoint actually honours. */
function dateField(type: BrowseType): string {
  return type === "tv" ? "first_air_date" : "primary_release_date";
}

/**
 * A floor for the "highest rated" sort.
 *
 * Without one the top of the list is titles with a single 10/10 vote, and the
 * sort reads as broken. The number is a compromise rather than a preference:
 * high enough to clear that noise, low enough that a genuinely small catalogue
 * — the 41 Marathi documentaries this engine exists to be able to ask for —
 * still returns something rather than an empty grid.
 */
const RATING_VOTE_FLOOR = 50;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function sortParam(sort: BrowseSort, type: BrowseType): string {
  const date = dateField(type);
  switch (sort) {
    case "rating":
      return "vote_average.desc";
    case "votes":
      return "vote_count.desc";
    case "new":
      return `${date}.desc`;
    case "chrono":
      return `${date}.asc`;
    default:
      return "popularity.desc";
  }
}

/**
 * Build the querystring for `/discover/{type}`.
 *
 * Returns the params only; the caller owns the base URL and the api key, which
 * keeps this function testable without a network or a secret.
 */
export function buildDiscoverQuery(p: BrowseParams, apiKey: string): URLSearchParams {
  const q = new URLSearchParams({
    api_key: apiKey,
    language: "en-US",
    include_adult: "false", // TMDB's default varies by endpoint; be explicit.
    sort_by: sortParam(p.sort, p.type),
    page: String(p.page),
  });

  if (p.keyword) q.set("with_keywords", p.keyword);
  if (p.company) q.set("with_companies", p.company);
  if (p.network) q.set("with_networks", p.network);
  if (p.genre) q.set("with_genres", p.genre);
  if (p.lang) q.set("with_original_language", p.lang);

  const date = dateField(p.type);
  let gte: string | undefined;
  let lte: string | undefined;

  if (p.decade) {
    const start = Number(p.decade);
    gte = `${start}-01-01`;
    lte = `${start + 9}-12-31`;
  }

  // "Newest first" without a ceiling surfaces TMDB's placeholder entries for
  // titles years from release — no poster, no votes, no use. The same care the
  // rating sort needs at its bottom end, this one needs at its top.
  if (p.sort === "new") {
    const today = todayIso();
    lte = lte && lte < today ? lte : today;
  }

  if (gte) q.set(`${date}.gte`, gte);
  if (lte) q.set(`${date}.lte`, lte);

  if (p.sort === "rating") q.set("vote_count.gte", String(RATING_VOTE_FLOOR));

  return q;
}
