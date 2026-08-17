"use client";

import { useEffect, useState } from "react";
import { buildSearchIndex, normalizeQuery, type IndexRow, type SearchIndex } from "@/utils/searchIndex";
import { NETWORKS } from "@/staticData/networks";

/**
 * Loads the local search index, once per page session, on first use.
 *
 * Plain `fetch` rather than SWR, deliberately. `SearchBar` is rendered by the
 * navbar in the **root** layout, which is outside `/app/layout`'s
 * `SwrProvider` — so `useSWR` here would not inherit that provider's
 * "don't retry 401/403/404" rule, and every signed-out visitor would get
 * retry-with-backoff against a library route that correctly returns 401.
 *
 * Loading is deferred until the search modal is first opened rather than done
 * on mount. Most page views never search, and this way they never pay for it.
 * The cost lands on the first open, which is also the one moment the user is
 * guaranteed to be looking at a text field rather than at content.
 */

let cached: Promise<SearchIndex> | null = null;

type Payload = { rows?: IndexRow[] };

async function fetchRows(url: string): Promise<IndexRow[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return []; // 401 for signed-out on the library route is normal.
    const body: Payload = await res.json();
    return Array.isArray(body?.rows) ? body.rows : [];
  } catch {
    return [];
  }
}

function load(): Promise<SearchIndex> {
  if (!cached) {
    cached = Promise.all([
      fetchRows("/api/library/index"),
      fetchRows("/api/search/index"),
    ]).then(([library, popular]) =>
      buildSearchIndex([
        ...library,
        ...popular,
        // Checked in rather than fetched: TMDB has no network search.
        ...NETWORKS.map(
          (n): IndexRow => ({
            k: `network:${n.id}`,
            n: n.name,
            s: normalizeQuery(n.name),
            t: "network",
            y: null,
          }),
        ),
      ]),
    );
  }
  return cached;
}

/**
 * Drop the cached index so the next open rebuilds it.
 *
 * Not wired to the library-write paths in this pass: the index is rebuilt on
 * every full page load anyway, and refetching the whole thing after each
 * status toggle would mean a fresh download per episode marked.
 */
export function resetSearchIndex() {
  cached = null;
}

export function useSearchIndex(enabled: boolean): SearchIndex | null {
  const [index, setIndex] = useState<SearchIndex | null>(null);

  useEffect(() => {
    if (!enabled || index) return;
    let alive = true;
    load().then((built) => {
      if (alive) setIndex(built);
    });
    return () => {
      alive = false;
    };
  }, [enabled, index]);

  return index;
}
