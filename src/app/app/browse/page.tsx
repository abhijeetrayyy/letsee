import Link from "next/link";
import { cache } from "react";
import { Compass } from "lucide-react";
import { tmdbFetchJson } from "@/utils/tmdb";
import {
  activeFacet,
  activeFilters,
  parseBrowseParams,
  buildBrowseUrl,
  MAX_BROWSE_PAGE,
  type BrowseFilterKey,
  type BrowseParams,
} from "@/utils/browseUrl";
import { buildDiscoverQuery } from "@/utils/browseQuery";
import { genreLabel, languageLabel } from "@/staticData/browseFilters";
import EmptyState from "@components/ui/EmptyState";
import BrowseGrid from "./BrowseGrid";
import BrowseFilterBar from "./BrowseFilterBar";

export const dynamic = "force-dynamic";

const BASE = "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_API_KEY;

/** A facet's own name changes about never; its result set changes daily. */
const LABEL_TTL = 86400;
const RESULTS_TTL = 3600;

type Item = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  adult?: boolean;
};

/**
 * The name behind an id.
 *
 * Cached on two *strings*, deliberately. `cache()` memoises on argument
 * identity, so a version taking the params object would miss every time —
 * `generateMetadata` and the page component each parse the search params into
 * their own fresh object, and the fetches would double rather than dedupe.
 */
const entityName = cache(async (kind: string, id: string): Promise<string | null> => {
  if (!KEY) return null;
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
    `${BASE}/${path}?api_key=${KEY}`,
    `browse:${kind}`,
    { revalidate: LABEL_TTL },
  );
  return data?.name ?? null;
});

/** Every chip's display name, entity lookups and static tables together. */
async function resolveLabels(
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

async function loadResults(
  p: BrowseParams,
): Promise<{ items: Item[]; totalPages: number; total: number }> {
  if (!KEY) return { items: [], totalPages: 0, total: 0 };

  // A collection is not a discover query — TMDB has no `with_collection`
  // parameter. It is a different source feeding the same grid, which is what
  // keeps this one page type rather than two.
  if (p.collection) {
    const { data } = await tmdbFetchJson<{ parts?: Item[] }>(
      `${BASE}/collection/${p.collection}?api_key=${KEY}&language=en-US`,
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
    results?: Item[];
    total_pages?: number;
    total_results?: number;
  }>(
    `${BASE}/discover/${p.type}?${buildDiscoverQuery(p, KEY).toString()}`,
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

/**
 * What this page is, in words.
 *
 * "Marathi documentaries" is the sentence the whole engine exists to be able to
 * say, so the heading composes rather than naming a single facet.
 */
function headline(p: BrowseParams, labels: Partial<Record<BrowseFilterKey, string>>): string {
  const facet = activeFacet(p);
  if (facet && labels[facet]) return labels[facet]!;

  const noun = p.type === "tv" ? "TV shows" : "films";
  const parts = [labels.lang, labels.genre?.toLowerCase(), noun].filter(Boolean);
  const phrase = parts.join(" ");
  return labels.decade ? `${phrase} from the ${labels.decade}` : phrase;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = parseBrowseParams(await searchParams);
  const labels = await resolveLabels(p);
  const what = headline(p, labels);
  const noun = p.type === "tv" ? "series" : "films";

  /**
   * Self-canonical, built from the parsed params rather than the raw URL.
   *
   * Faceted navigation generates the same page under many addresses — the same
   * filters in a different order, a stray empty parameter, a default written
   * out explicitly. `buildBrowseUrl` normalises all of those to one string, so
   * canonicalising to it collapses the duplicates without needing a rule per
   * facet. This page had no canonical at all, and it is in the sitemap.
   *
   * Deliberately *not* canonicalising page 2+ back to page 1: that is the
   * common instinct and it hides everything past the first grid from a crawler.
   * Each page points at itself.
   */
  const canonical = buildBrowseUrl(p);
  const generic = what === "films" || what === "TV shows";

  return {
    title: generic ? "Browse" : `${what}`,
    description: generic
      ? `Browse ${noun} by genre, keyword, studio, network and where they are streaming.`
      : `${what} — ${noun} on LetSee, with what people here have watched, rated and written about them.`,
    alternates: { canonical },
    openGraph: { title: generic ? "Browse" : `${what}`, url: canonical, type: "website" },
  };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseBrowseParams(await searchParams);
  const facet = activeFacet(params);

  const [labels, { items, totalPages, total }] = await Promise.all([
    resolveLabels(params),
    loadResults(params),
  ]);

  const chips = activeFilters(params, labels);
  const noun = params.type === "tv" ? "shows" : "films";
  const kind =
    facet === "keyword" ? "Tagged"
    : facet === "collection" ? "Collection"
    : facet === "network" ? "Network"
    : facet === "company" ? "Studio"
    : "Browse";

  // The canonical query string, so the grid's scroll memory is keyed on what
  // is actually shown rather than on however the URL happened to be written.
  const searchKey = buildBrowseUrl(params);

  return (
    <Shell>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">{kind}</p>
        <h1 className="mt-1 text-2xl font-bold capitalize tracking-tight text-white sm:text-3xl">
          {headline(params, labels)}
        </h1>
        {total > 0 && (
          <p className="mt-1 text-sm text-surface-400">
            {total.toLocaleString()} {noun}
          </p>
        )}
      </header>

      <div className="mb-8 border-b border-surface-800/60 pb-6">
        <BrowseFilterBar params={params} chips={chips} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Compass className="size-8 text-surface-600" />}
          title={`No ${noun} match`}
          description={
            chips.length > 1
              ? "That combination is narrower than TMDB's catalogue. Remove a filter to widen it."
              : facet === "company"
                ? "TMDB doesn't roll subsidiaries up into their parent company, so a studio can genuinely have very few titles listed."
                : "Nothing came back for this one."
          }
          actionLabel="Search instead"
          actionHref="/app/search"
        />
      ) : (
        <BrowseGrid
          items={items}
          mediaType={params.type}
          page={params.page}
          totalPages={facet === "collection" ? 1 : totalPages}
          searchKey={searchKey}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-surface-950">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/app"
          className="mb-4 inline-block text-sm text-surface-500 transition-colors hover:text-brand-400"
        >
          ← Home
        </Link>
        {children}
      </div>
    </div>
  );
}
