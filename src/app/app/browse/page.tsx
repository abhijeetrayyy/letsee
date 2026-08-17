import Link from "next/link";
import { Suspense } from "react";
import { Compass } from "lucide-react";
import { tmdbFetchJson } from "@/utils/tmdb";
import { activeFacet, parseBrowseParams, type BrowseParams } from "@/utils/browseUrl";
import EmptyState from "@components/ui/EmptyState";
import BrowseGrid from "./BrowseGrid";

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
 * The name of the thing being browsed.
 *
 * Fetched separately from the results because "Films tagged 12345" is a URL,
 * not a heading — the whole point of a directed surface is that it says what
 * you asked for.
 */
async function facetLabel(p: BrowseParams): Promise<string | null> {
  const facet = activeFacet(p);
  if (!facet || !KEY) return null;

  const url =
    facet === "keyword" ? `${BASE}/keyword/${p.keyword}?api_key=${KEY}`
    : facet === "company" ? `${BASE}/company/${p.company}?api_key=${KEY}`
    : facet === "network" ? `${BASE}/network/${p.network}?api_key=${KEY}`
    : null;

  if (!url) return null;
  // `revalidate` must be top level — tmdbClient reads it there and ignores a
  // `next: { revalidate }` object, which is why the genre list pages are
  // uncached today without anyone noticing.
  const { data } = await tmdbFetchJson<{ name?: string }>(url, `browse:${facet}`, {
    revalidate: LABEL_TTL,
  });
  return data?.name ?? null;
}

async function loadResults(
  p: BrowseParams,
): Promise<{ items: Item[]; totalPages: number; total: number; label: string | null }> {
  if (!KEY) return { items: [], totalPages: 0, total: 0, label: null };

  // A collection is not a discover query — TMDB has no `with_collection`
  // parameter. It is a different source feeding the same grid, which is what
  // keeps this one page type rather than two.
  if (p.collection) {
    const { data } = await tmdbFetchJson<{ name?: string; parts?: Item[] }>(
      `${BASE}/collection/${p.collection}?api_key=${KEY}&language=en-US`,
      "browse:collection",
      { revalidate: RESULTS_TTL },
    );
    const parts = [...(data?.parts ?? [])].sort((a, b) => {
      // Unsorted from TMDB, and a collection read out of order is confusing in
      // a way a discover list never is.
      const da = a.release_date || "9999";
      const db = b.release_date || "9999";
      return da.localeCompare(db);
    });
    return { items: parts, totalPages: 1, total: parts.length, label: data?.name ?? null };
  }

  const q = new URLSearchParams({
    api_key: KEY,
    language: "en-US",
    include_adult: "false", // TMDB's default varies by endpoint; be explicit.
    sort_by: "popularity.desc",
    page: String(p.page),
  });
  if (p.keyword) q.set("with_keywords", p.keyword);
  if (p.company) q.set("with_companies", p.company);
  if (p.network) q.set("with_networks", p.network);

  const [label, res] = await Promise.all([
    facetLabel(p),
    tmdbFetchJson<{ results?: Item[]; total_pages?: number; total_results?: number }>(
      `${BASE}/discover/${p.type}?${q.toString()}`,
      "browse:discover",
      { revalidate: RESULTS_TTL },
    ),
  ]);

  // tmdbFetchJson never throws — it returns { data: null, error } — so an
  // unchecked destructure renders a blank page instead of an error state.
  return {
    items: res.data?.results ?? [],
    totalPages: Math.min(res.data?.total_pages ?? 0, 500),
    total: res.data?.total_results ?? 0,
    label,
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = parseBrowseParams(await searchParams);
  const label = await facetLabel(p);
  const what = p.type === "tv" ? "TV shows" : "Films";
  return { title: label ? `${what}: ${label} · LetSee` : "Browse · LetSee" };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseBrowseParams(await searchParams);
  const facet = activeFacet(params);

  if (!facet) {
    return (
      <Shell>
        <EmptyState
          icon={<Compass className="size-8 text-surface-600" />}
          title="Nothing to browse yet"
          description="Open a film or show and follow a keyword, studio or collection to get here."
          actionLabel="Search instead"
          actionHref="/app/search"
        />
      </Shell>
    );
  }

  const { items, totalPages, total, label } = await loadResults(params);
  const noun = params.type === "tv" ? "shows" : "films";
  const kind =
    facet === "keyword" ? "Tagged" : facet === "collection" ? "Collection" : facet === "network" ? "Network" : "Studio";

  return (
    <Shell>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">{kind}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {label ?? "Browse"}
        </h1>
        {total > 0 && (
          <p className="mt-1 text-sm text-surface-400">
            {total.toLocaleString()} {noun}
          </p>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={<Compass className="size-8 text-surface-600" />}
          title={`No ${noun} here`}
          description={
            facet === "company"
              ? "TMDB doesn't roll subsidiaries up into their parent company, so a studio can genuinely have very few titles listed."
              : "Nothing came back for this one."
          }
          actionLabel="Search instead"
          actionHref="/app/search"
        />
      ) : (
        <Suspense fallback={null}>
          <BrowseGrid
            items={items}
            mediaType={params.type}
            page={params.page}
            totalPages={facet === "collection" ? 1 : totalPages}
          />
        </Suspense>
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
