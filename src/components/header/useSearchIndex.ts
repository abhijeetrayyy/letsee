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
type Fetched = { rows: IndexRow[]; ok: boolean };

async function fetchRows(url: string): Promise<Fetched> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.status === 401) return { rows: [], ok: true }; // no library is a real answer
    if (!res.ok) {
      console.warn(`searchIndex: ${url} returned ${res.status} — will retry on next open`);
      return { rows: [], ok: false };
    }
    // A challenge or error page is HTML with a 200 in some configurations, so
    // check what actually came back rather than trusting the status alone.
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) {
      console.warn(`searchIndex: ${url} returned ${type || "unknown"}, not JSON — will retry on next open`);
      return { rows: [], ok: false };
    }
    const body: Payload = await res.json();
    return { rows: Array.isArray(body?.rows) ? body.rows : [], ok: true };
  } catch (e) {
    console.warn(`searchIndex: ${url} failed — will retry on next open`, e);
    return { rows: [], ok: false };
  }
}

/**
 * **A failed load must never be cached.**
 *
 * This memoised the promise unconditionally, and `fetchRows` turned every
 * failure into an empty array. So one bad response — a 403, a cold start, a
 * deploy landing mid-session — built an index from zero rows and then held it
 * for the whole page session. Retyping could not help. Closing and reopening
 * the modal could not help, because `index` was set and the effect returned
 * early. Only a full reload recovered.
 *
 * That is the difference between search being flaky and search being *dead
 * until you reload*, and it is the more likely explanation of "retyping twice
 * or three times still does nothing".
 *
 * Now the promise is dropped unless both halves genuinely answered, so the
 * next time the modal opens it tries again. The catalogue is the half that
 * matters: without it there is no local index at all, and the spelling
 * correction that feeds TMDB dies with it.
 */
function load(): Promise<SearchIndex> {
  if (!cached) {
    cached = Promise.all([
      fetchRows("/api/library/index"),
      fetchRows("/api/search/catalog"),
    ]).then(([library, popular]) => {
      if (!library.ok || !popular.ok) cached = null;
      return buildSearchIndex([
        ...library.rows,
        ...popular.rows,
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
      ]);
    }).catch((e) => {
      // Never leave a rejected promise memoised — every later open would
      // inherit the same failure without so much as trying.
      cached = null;
      throw e;
    });
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
    // Retry while the index is still empty: a build from zero rows means the
    // fetch failed, and reopening the modal is exactly when to try again.
    if (!enabled || (index && index.rows.length > 0)) return;
    let alive = true;
    load()
      .then((built) => {
        if (alive) setIndex(built);
      })
      .catch(() => {
        // Already logged; the next open retries.
      });
    return () => {
      alive = false;
    };
  }, [enabled, index]);

  return index;
}
