/**
 * The URL contract for /app/browse.
 *
 * Every entity link on a detail page — a keyword, a studio, a network, a
 * collection — points here rather than at a page of its own. That is a
 * deliberate architectural choice, not a shortcut: TMDB's `/discover` answers
 * all of these through one endpoint, so five bespoke page types would be five
 * places to fix ranking, paging and empty states, and none of them could
 * express a question that crosses two facets. "Marathi documentaries" is
 * language × genre; no single-entity page can say it.
 *
 * D2 emitted the entity facets. D3 adds the filters that compose with them —
 * genre, language, decade, sort — on this same contract, so not one link
 * written for D2 had to be rewritten. New parameters are additive: one this
 * file has never heard of simply parses to its default.
 *
 * This module stays pure and dependency-free because three client components
 * import it (`MovieDetailClient`, `TvDetailClient`, `KeywordChips`). Genre
 * *names*, language names and TMDB parameter spellings live elsewhere — here
 * there are only id sets, which cost a few hundred bytes.
 *
 * Modelled on `searchUrl.ts`, which this codebase already treats as the single
 * source of truth for its own URL shape.
 */

export type BrowseType = "movie" | "tv";

export type BrowseFacet = "keyword" | "company" | "network" | "collection";

/** Everything that can appear as a removable chip. */
export type BrowseFilterKey = BrowseFacet | "genre" | "lang" | "decade";

export const BROWSE_SORTS = ["popular", "rating", "votes", "new", "chrono"] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

export type BrowseParams = {
  type: BrowseType;
  keyword?: string;
  company?: string;
  network?: string;
  collection?: string;
  /**
   * A single TMDB genre id, not a list. A one-value `<select>` — which is what
   * every other picker in this app uses — can only ever replace, so a comma
   * list would have been machinery no interface could reach.
   */
  genre?: string;
  /** Bare ISO-639-1, never a locale: `mr`, not `mr-IN`. */
  lang?: string;
  /** The decade's first year, e.g. "1990". A range, held as one token. */
  decade?: string;
  sort: BrowseSort;
  page: number;
};

/** TMDB refuses to page past this, whatever `total_pages` claims. */
export const MAX_BROWSE_PAGE = 500;

/**
 * TMDB keeps two genre vocabularies, and a filter that ignores the difference
 * fails silently rather than loudly: `with_genres=27` (Horror, films only) on
 * `/discover/tv` returns zero results and no error, which reads as "this show
 * doesn't exist" rather than "that genre isn't a TV genre".
 *
 * Verified against both list endpoints: 19 movie ids, 16 TV ids, 8 shared, and
 * — usefully — no id that means different things on the two sides. So the only
 * hazard is a genre being *absent*, never mismatched.
 */
export const MOVIE_GENRE_IDS = new Set([
  28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37,
]);

export const TV_GENRE_IDS = new Set([
  10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10763, 10764, 10765, 10766, 10767, 10768, 37,
]);

export function genreIdsFor(type: BrowseType): Set<number> {
  return type === "tv" ? TV_GENRE_IDS : MOVIE_GENRE_IDS;
}

/**
 * What a genre becomes when you switch the type toggle.
 *
 * TV collapses distinctions film keeps — Action and Adventure are one genre on
 * the TV side, as are Fantasy and Science Fiction. Mapping is better than
 * dropping for the cases that have an honest counterpart, and the mapping is
 * visible rather than silent because the chip's label changes with it. Where
 * there is no counterpart (Horror, Romance, Talk shows) the filter is dropped
 * and its chip disappears, which is likewise visible.
 *
 * Deliberately not a bijection, and it does not need to be: Adventure→TV→film
 * lands on Action. Lossy, but only across a round trip the user drove by hand
 * and watched happen.
 */
const GENRE_SWITCH: Record<BrowseType, Record<number, number>> = {
  // movie id -> tv id
  tv: { 28: 10759, 12: 10759, 14: 10765, 878: 10765, 10752: 10768 },
  // tv id -> movie id
  movie: { 10759: 28, 10765: 878, 10768: 10752, 10762: 10751 },
};

function first(value: string | string[] | undefined): string {
  return (value == null ? "" : String(Array.isArray(value) ? value[0] : value)).trim();
}

/**
 * TMDB ids are positive integers with no leading zeros.
 *
 * The stricter-than-obvious regex is doing real work. `\d+` accepts "0", which
 * is no entity and renders as a mystery empty state, and it preserves leading
 * zeros, so "000123" and "123" become two URLs and two cache keys for one
 * studio.
 */
const ID_RE = /^[1-9]\d{0,8}$/;

function cleanId(value: string | string[] | undefined): string | undefined {
  const s = first(value);
  return ID_RE.test(s) ? s : undefined;
}

/** Shape only, not membership — the language table must not reach this module. */
function cleanLang(value: string | string[] | undefined): string | undefined {
  const s = first(value).toLowerCase();
  return /^[a-z]{2}$/.test(s) ? s : undefined;
}

function cleanDecade(value: string | string[] | undefined): string | undefined {
  const s = first(value);
  if (!/^(18|19|20)\d0$/.test(s)) return undefined;
  const year = Number(s);
  const ceiling = Math.floor(new Date().getUTCFullYear() / 10) * 10;
  return year >= 1870 && year <= ceiling ? s : undefined;
}

function cleanSort(value: string | string[] | undefined): BrowseSort {
  const s = first(value) as BrowseSort;
  return (BROWSE_SORTS as readonly string[]).includes(s) ? s : "popular";
}

function cleanGenre(
  value: string | string[] | undefined,
  type: BrowseType,
): string | undefined {
  const s = cleanId(value);
  // Checked here rather than only where filters are written, because most URLs
  // arrive from somewhere else entirely — a shared link, a redirect from the
  // old genre routes, a hand edit — and none of those pass through the bar.
  return s && genreIdsFor(type).has(Number(s)) ? s : undefined;
}

function cleanPage(value: string | string[] | undefined): number {
  const s = first(value);
  // `Number()` here would accept 0x10, 1e3 and 0b11 as page numbers; the clamp
  // would then quietly do all the validation. The regex rejects notation, not
  // magnitude — bounding it here too would make `?page=9999` clamp to 500
  // while `?page=99999` fell back to 1, which is an arbitrary difference.
  if (!/^\d{1,9}$/.test(s)) return 1;
  const n = parseInt(s, 10);
  return n > 0 ? Math.min(n, MAX_BROWSE_PAGE) : 1;
}

/** A facet fixes the type itself: a network is TV, a collection is films. */
function resolveType(p: { collection?: unknown; network?: unknown; type?: string }): BrowseType {
  if (p.collection) return "movie";
  if (p.network) return "tv";
  return p.type === "tv" ? "tv" : "movie";
}

export function buildBrowseUrl(p: Partial<BrowseParams>): string {
  const q = new URLSearchParams();
  const type = resolveType({ collection: p.collection, network: p.network, type: p.type });

  // Every field goes through the same validator the parser uses. Without that,
  // `buildBrowseUrl({ keyword: "abc" })` emits a URL the parser silently drops,
  // and the caller's bug surfaces as an inexplicable empty grid.
  if (type !== "movie") q.set("type", type);
  const put = (k: string, v: string | undefined) => v && q.set(k, v);

  put("keyword", cleanId(p.keyword));
  put("company", cleanId(p.company));
  put("network", cleanId(p.network));
  put("collection", cleanId(p.collection));
  put("genre", cleanGenre(p.genre, type));
  put("lang", cleanLang(p.lang));
  put("decade", cleanDecade(p.decade));
  if (p.sort && p.sort !== "popular") put("sort", cleanSort(p.sort));

  const page = cleanPage(p.page == null ? undefined : String(Math.floor(Number(p.page) || 1)));
  if (page > 1) q.set("page", String(page));

  const qs = q.toString();
  return qs ? `/app/browse?${qs}` : "/app/browse";
}

export function parseBrowseParams(
  sp: Record<string, string | string[] | undefined>,
): BrowseParams {
  const collection = cleanId(sp.collection);
  const network = cleanId(sp.network);
  const type = resolveType({ collection, network, type: first(sp.type) });

  return {
    type,
    keyword: cleanId(sp.keyword),
    company: cleanId(sp.company),
    network,
    collection,
    genre: cleanGenre(sp.genre, type),
    lang: cleanLang(sp.lang),
    decade: cleanDecade(sp.decade),
    sort: cleanSort(sp.sort),
    page: cleanPage(sp.page),
  };
}

/**
 * Apply a change without losing everything else.
 *
 * The acceptance criterion for D3 is that adding or removing one filter never
 * disturbs the others, and the only way to hold that is to make it structural.
 * Every write in the filter bar goes through here; no call site assembles a
 * `BrowseParams` by hand.
 */
export function withBrowseFilters(
  current: BrowseParams,
  patch: Partial<BrowseParams>,
): BrowseParams {
  const next: BrowseParams = { ...current, ...patch };

  // Switching type has to reconcile the genre vocabularies, and re-resolve the
  // type afterwards in case the patch cleared the facet that was pinning it.
  next.type = resolveType(next);
  if (next.genre && next.type !== current.type) {
    const id = Number(next.genre);
    const mapped = genreIdsFor(next.type).has(id) ? id : GENRE_SWITCH[next.type][id];
    next.genre = mapped ? String(mapped) : undefined;
  }

  // Any change to *what* is shown invalidates *which page* of it. Landing on
  // page 12 of a three-page result renders an empty grid, which reads as a
  // broken filter rather than as a stale page number.
  if (!("page" in patch)) next.page = 1;

  return next;
}

/** Which facet a set of params is chiefly about — used for the page's eyebrow. */
export function activeFacet(p: BrowseParams): BrowseFacet | null {
  if (p.collection) return "collection";
  if (p.keyword) return "keyword";
  if (p.company) return "company";
  if (p.network) return "network";
  return null;
}

const FILTER_KEYS: BrowseFilterKey[] = [
  "keyword",
  "company",
  "network",
  "collection",
  "genre",
  "lang",
  "decade",
];

export function hasAnyFilter(p: BrowseParams): boolean {
  return FILTER_KEYS.some((k) => p[k]);
}

/**
 * The chips, each knowing the URL that removes it.
 *
 * Labels are resolved by the caller because some of them cost a network round
 * trip (a keyword id means nothing without asking TMDB) and this module is
 * imported by client components.
 */
export function activeFilters(
  p: BrowseParams,
  labels: Partial<Record<BrowseFilterKey, string>>,
): { key: BrowseFilterKey; label: string; removeUrl: string }[] {
  return FILTER_KEYS.filter((key) => p[key]).map((key) => ({
    key,
    label: labels[key] ?? String(p[key]),
    removeUrl: buildBrowseUrl(withBrowseFilters(p, { [key]: undefined, page: 1 })),
  }));
}
