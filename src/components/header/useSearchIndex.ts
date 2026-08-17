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

/**
 * A 401 here is ordinary — a signed-out visitor has no library. Anything else
 * is a real failure and must not be mistaken for "you own nothing".
 *
 * This used to swallow every non-OK response into an empty array, which made a
 * *blocked* request indistinguishable from an *empty* one. In production
 * Vercel's Attack Challenge Mode answered these routes with a 403 HTML
 * challenge page; the index silently built from zero rows, and searching for a
 * film that was sitting in the user's own library reported "nothing matches".
 * The search looked broken when what was actually broken was the fetch.
 */
async function fetchRows(url: string): Promise<IndexRow[]> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.status === 401) return [];
    if (!res.ok) {
      console.warn(`searchIndex: ${url} returned ${res.status} — index will be incomplete`);
      return [];
    }
    // A challenge or error page is HTML with a 200 in some configurations, so
    // check what actually came back rather than trusting the status alone.
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) {
      console.warn(`searchIndex: ${url} returned ${type || "unknown"}, not JSON — index will be incomplete`);
      return [];
    }
    const body: Payload = await res.json();
    return Array.isArray(body?.rows) ? body.rows : [];
  } catch (e) {
    console.warn(`searchIndex: ${url} failed`, e);
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
