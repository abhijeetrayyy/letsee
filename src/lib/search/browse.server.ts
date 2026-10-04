/**
 * Browse's reads from TMDB (docs/design/PAGES.md §4, browse inside Search),
 * for `/api/browse`. Server only: the api key, the discover query and the
 * entity lookups never reach a page bundle.
 */
import { cache } from "react";
import { tmdbFetchJson } from "@/utils/tmdb";
import { MAX_BROWSE_PAGE, type BrowseFilterKey, type BrowseParams } from "@/utils/browseUrl";
import { buildDiscoverQuery } from "@/utils/browseQuery";
import { genreLabel, languageLabel } from "@/staticData/browseFilters";
import { tmdbConfigured } from "@/utils/tmdbClient";

const BASE = "https://api.themoviedb.org/3";

export type BrowseItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  adult?: boolean;
};

/** A facet's own name changes about never; its result set changes daily. */
const LABEL_TTL = 86400;
const RESULTS_TTL = 3600;

/**
 * The name behind an id.
 *
 * Cached on two *strings*, deliberately. `cache()` memoises on argument
 * identity, so a version taking the params object would miss every time —
 * `generateMetadata` and the page component each parse the search params into
 * their own fresh object, and the fetches would double rather than dedupe.
 */
const entityName = cache(async (kind: string, id: string): Promise<string | null> => {
  if (!tmdbConfigured()) return null;
  const path =
    kind === "keyword" ? `keyword/${id}`
    : kind === "company" ? `company/${id}`
    : kind === "network" ? `network/${id}`
    : kind === "collection" ? `collection/${id}`
    : null;
  if (!path) return null;

  // `revalidate` must be top level — tmdbClient reads it there and ignores a
  // `next: { revalidate }` object, which is why the old genre list pages were
  // uncached without anyone noticing.
  const { data } = await tmdbFetchJson<{ name?: string }>(
    `${BASE}/${path}`,
    `browse:${kind}`,
    { revalidate: LABEL_TTL },
  );
  return data?.name ?? null;
});

/** Every chip's display name, entity lookups and static tables together. */
export async function resolveLabels(
  p: BrowseParams,
): Promise<Partial<Record<BrowseFilterKey, string>>> {
  const entities: BrowseFilterKey[] = ["keyword", "company", "network", "collection"];
  const pairs = await Promise.all(
    entities
      .filter((k) => p[k])
      .map(async (k) => [k, await entityName(k, String(p[k]))] as const),
  );

  const labels: Partial<Record<BrowseFilterKey, string>> = {};
  for (const [k, name] of pairs) if (name) labels[k] = name;
  const g = genreLabel(p.genre, p.type);
  if (g) labels.genre = g;
  const l = languageLabel(p.lang);
  if (l) labels.lang = l;
  if (p.decade) labels.decade = `${p.decade}s`;
  return labels;
}

export async function loadResults(
  p: BrowseParams,
): Promise<{ items: BrowseItem[]; totalPages: number; total: number }> {
  if (!tmdbConfigured()) return { items: [], totalPages: 0, total: 0 };

  // A collection is not a discover query — TMDB has no `with_collection`
  // parameter. It is a different source feeding the same grid, which is what
  // keeps this one page type rather than two.
  if (p.collection) {
    const { data } = await tmdbFetchJson<{ parts?: BrowseItem[] }>(
      `${BASE}/collection/${p.collection}?language=en-US`,
      "browse:collection",
      { revalidate: RESULTS_TTL },
    );
    let parts = [...(data?.parts ?? [])];

    // The other filters still have to mean something here, so they are applied
    // in memory. A collection is a handful of films, never a paged result, so
    // this is a filter over nine items rather than a second query.
    if (p.genre) parts = parts.filter((i) => (i as { genre_ids?: number[] }).genre_ids?.includes(Number(p.genre)));
    if (p.lang) parts = parts.filter((i) => (i as { original_language?: string }).original_language === p.lang);
    if (p.decade) {
      const start = Number(p.decade);
      parts = parts.filter((i) => {
        const y = Number((i.release_date ?? "").slice(0, 4));
        return y >= start && y <= start + 9;
      });
    }

    parts.sort((a, b) => {
      // Unsorted from TMDB, and a collection read out of order is confusing in
      // a way a discover list never is.
      const da = a.release_date || "9999";
      const db = b.release_date || "9999";
      return da.localeCompare(db);
    });
    return { items: parts, totalPages: 1, total: parts.length };
  }

  const { data } = await tmdbFetchJson<{
    results?: BrowseItem[];
    total_pages?: number;
    total_results?: number;
  }>(
    `${BASE}/discover/${p.type}?${buildDiscoverQuery(p).toString()}`,
    "browse:discover",
    { revalidate: RESULTS_TTL },
  );

  // tmdbFetchJson never throws — it returns { data: null, error } — so an
  // unchecked destructure renders a blank page instead of an error state.
  return {
    items: data?.results ?? [],
    totalPages: Math.min(data?.total_pages ?? 0, MAX_BROWSE_PAGE),
    total: data?.total_results ?? 0,
  };
}

