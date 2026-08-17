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
 * D2 emits these URLs and ships a minimal reader for them. D3 grows the filter
 * bar, removable chips, sorting and composition **on this same contract**, so
 * not one link written today has to be rewritten. New facets are additive:
 * a parameter D2 never emits simply parses to its default.
 *
 * Modelled on `searchUrl.ts`, which this codebase already treats as the single
 * source of truth for its own URL shape.
 */

export type BrowseType = "movie" | "tv";

export type BrowseFacet = "keyword" | "company" | "network" | "collection";

export type BrowseParams = {
  type: BrowseType;
  keyword?: string;
  company?: string;
  network?: string;
  collection?: string;
  page: number;
};

/** TMDB refuses to page past this, whatever `total_pages` claims. */
export const MAX_BROWSE_PAGE = 500;

function cleanId(value: unknown): string | undefined {
  const s = value == null ? "" : String(Array.isArray(value) ? value[0] : value).trim();
  // TMDB ids are integers. Anything else is a malformed or hand-edited URL.
  return /^\d+$/.test(s) ? s : undefined;
}

export function buildBrowseUrl(p: Partial<BrowseParams>): string {
  const q = new URLSearchParams();

  // A collection is inherently a set of films, so it fixes the type itself.
  const type: BrowseType = p.collection ? "movie" : p.network ? "tv" : p.type ?? "movie";
  if (type !== "movie") q.set("type", type);

  if (p.keyword) q.set("keyword", String(p.keyword));
  if (p.company) q.set("company", String(p.company));
  if (p.network) q.set("network", String(p.network));
  if (p.collection) q.set("collection", String(p.collection));
  if (p.page && p.page > 1) q.set("page", String(p.page));

  const qs = q.toString();
  return qs ? `/app/browse?${qs}` : "/app/browse";
}

export function parseBrowseParams(
  sp: Record<string, string | string[] | undefined>,
): BrowseParams {
  const collection = cleanId(sp.collection);
  const network = cleanId(sp.network);
  const rawType = Array.isArray(sp.type) ? sp.type[0] : sp.type;

  // The facet wins over an explicit type, so a hand-edited `?type=movie` on a
  // network URL can't ask discover for something it cannot answer.
  const type: BrowseType = collection ? "movie" : network ? "tv" : rawType === "tv" ? "tv" : "movie";

  const page = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);

  return {
    type,
    keyword: cleanId(sp.keyword),
    company: cleanId(sp.company),
    network,
    collection,
    page: Number.isInteger(page) && page > 0 ? Math.min(page, MAX_BROWSE_PAGE) : 1,
  };
}

/** Which facet a set of params is actually about, if any. */
export function activeFacet(p: BrowseParams): BrowseFacet | null {
  if (p.collection) return "collection";
  if (p.keyword) return "keyword";
  if (p.company) return "company";
  if (p.network) return "network";
  return null;
}
