"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import MediaCard from "@components/cards/MediaCard";
import Pagination from "@components/buttons/searchByGenreBtn";

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
};

/**
 * Remember where you were, per set of filters.
 *
 * Next's App Router delegates back/forward scrolling to the browser and never
 * touches `history.scrollRestoration`. That works for a static page and does
 * not work here: `/app/browse` is `force-dynamic`, so pressing Back refetches.
 * At the moment the browser tries to restore, the grid is empty, the document
 * has no height, and there is nothing to scroll to.
 *
 * `staleTimes.dynamic` is now 30 in `next.config.mjs` — it used to be Next's
 * default of 0, which is what made a Back press refetch *unconditionally*.
 * Inside that 30-second window the router now serves this page from its own
 * cache and the grid is already populated when the browser restores, so this
 * hook has nothing to do. Outside it, or after a reload, the refetch is back
 * and so is the empty-document problem. So this stays: 30 seconds narrows the
 * window in which it is needed, it does not close it.
 *
 * Keyed on the full query string, which does the discriminating for free: a
 * filter change produces a different key and therefore no restore (a new result
 * set belongs at the top), while returning to the same URL restores.
 *
 * Saved continuously rather than on the way out, because `pagehide` and
 * `beforeunload` do not fire on a client-side navigation — clicking a film is
 * not a page unload, so a save-on-exit listener would never run.
 */
function useScrollMemory(searchKey: string) {
  const storageKey = `browse:scroll:${searchKey}`;
  const restored = useRef(false);

  useLayoutEffect(() => {
    restored.current = false;
    try {
      const saved = sessionStorage.getItem(storageKey);
      // Before paint, so the page never flashes at the top first. Safe despite
      // the usual SSR warning: `items` arrive as props from the server render,
      // so the cards are already in the DOM when this runs.
      //
      // `behavior: "instant"` is load-bearing, not a default spelled out. This
      // app sets `scroll-behavior: smooth` on `html` globally, and a restore
      // that inherits it *animates* — the page opens at the top and glides
      // down to where you were, which is worse than not restoring at all.
      if (saved) window.scrollTo({ top: Number(saved) || 0, behavior: "instant" });
    } catch {
      // Private browsing modes throw on sessionStorage. Losing the scroll
      // position is not worth breaking the grid over.
    }
    restored.current = true;
  }, [storageKey]);

  useEffect(() => {
    // Throttled on a timestamp rather than requestAnimationFrame. rAF is the
    // more idiomatic choice and the wrong one here: browsers throttle it hard
    // in backgrounded or non-compositing tabs, and a save that never runs
    // fails silently — you only find out when Back forgets where you were.
    let last = 0;
    const save = () => {
      if (!restored.current) return;
      const now = Date.now();
      if (now - last < 150) return;
      last = now;
      try {
        sessionStorage.setItem(storageKey, String(window.scrollY));
      } catch {
        /* see above */
      }
    };
    window.addEventListener("scroll", save, { passive: true });
    // `pagehide` catches the full-page navigations a scroll listener alone
    // would miss — a hard reload, or following a link that leaves the app.
    window.addEventListener("pagehide", save);
    return () => {
      // Deliberately no final save here. Unmount happens *after* the router has
      // navigated and reset the scroll position, so a save-on-teardown reads
      // ~0 and overwrites the good value the scroll listener already stored.
      // Measured: it turned a remembered 2400 into 57.
      window.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", save);
    };
  }, [storageKey]);
}

/**
 * The results grid.
 *
 * Reuses the same card and the same grid columns as search and the genre
 * lists, so browse doesn't read as a different product. `Pagination` already
 * preserves sibling query parameters, which is exactly what a facetted URL
 * needs — and is why the filter bar could be added without touching it.
 */
export default function BrowseGrid({
  items,
  mediaType,
  page,
  totalPages,
  searchKey,
}: {
  items: Item[];
  mediaType: "movie" | "tv";
  page: number;
  totalPages: number;
  /** The canonical query string, passed from the server so it is stable across hydration. */
  searchKey: string;
}) {
  useScrollMemory(searchKey);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            id={item.id}
            title={item.title ?? item.name ?? ""}
            mediaType={mediaType}
            posterPath={item.poster_path}
            releaseDate={item.release_date ?? item.first_air_date ?? null}
            rating={item.vote_average ?? null}
            voteCount={item.vote_count ?? null}
            overview={item.overview ?? null}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination currentPage={page} totalPages={totalPages} />
        </div>
      )}
    </>
  );
}
