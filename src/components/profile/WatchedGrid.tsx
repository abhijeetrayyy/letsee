"use client";

import { formatStars } from "@/utils/ratingScale";
import TitleCard from "@components/ds/TitleCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { fetchWatchedPage, type WatchedPage } from "@/lib/db/profileGrid";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { SwrFetchError } from "@/utils/swrFetcher";
import { getPosterUrl } from "@/utils/imageUrl";

function formatWatchedDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

const genreList = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "TV Movie",
  "Thriller",
  "War",
  "Western",
  "Action & Adventure",
  "Reality",
  "Sci-Fi & Fantasy",
  "Soap",
  "War & Politics",
];

/**
 * Straight to Postgres. `/api/UserWatchedPagination` was a **POST**, which no
 * CDN caches and every scroll paid for — a function invocation per page of a
 * grid whose rows RLS scopes to what this viewer may see anyway. See
 * `@/lib/db/profileGrid` for what the visibility read is still doing there.
 */
export default function WatchedGrid({
  userId,
  isOwner = false,
  preview,
}: {
  userId: string;
  isOwner?: boolean;
  /** Show this many first, with "Show all" for the rest (the profile, open by default). */
  preview?: number;
}) {
  const [expanded, setExpanded] = useState(!preview);
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | undefined>(undefined);

  const getKey = (
    pageIndex: number,
    previousPageData: WatchedPage | null,
  ): [string, number, string | null, string | undefined] | null => {
    if (previousPageData && previousPageData.data.length === 0) return null;
    return [userId, pageIndex + 1, genreFilter, activeType];
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<WatchedPage>(getKey, (key) => {
      const [ownerId, page, genre, itemType] = key as [
        string,
        number,
        string | null,
        string | undefined,
      ];
      return fetchWatchedPage(ownerId, viewerId, page, genre, itemType);
    });

  // Back to one page when a filter changes — not on mount, where it only
  // fetched page one a second time. The grid is open on every profile visit
  // now, so that duplicate would be paid on every one.
  const lastFilter = useRef({ genreFilter, activeType });
  useEffect(() => {
    if (lastFilter.current.genreFilter === genreFilter && lastFilter.current.activeType === activeType) return;
    lastFilter.current = { genreFilter, activeType };
    setSize(1);
  }, [genreFilter, activeType, setSize]);

  const memoizedMovies = useMemo(
    () => (data ? data.flatMap((p) => p.data) : []),
    [data],
  );
  const totalItems = data?.[0]?.totalItems ?? 0;
  const shown = expanded || !preview ? memoizedMovies : memoizedMovies.slice(0, preview);
  const loading = isLoading;
  const loadingMore = isValidating && size > 1;
  const hasMore = expanded && memoizedMovies.length < totalItems;
  const clipped = !expanded && !!preview && totalItems > preview;

  const handlePageChange = useCallback(() => {
    if (hasMore && !loadingMore) {
      setSize((prev) => prev + 1);
    }
  }, [hasMore, loadingMore, setSize]);

  const handleGenreFilter = useCallback((genre: string) => {
    setGenreFilter(genre);
  }, []);

  const handleClearFilter = useCallback(() => {
    setGenreFilter(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Media Type Filter */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-overlay border border-line-strong">
          {[
            { id: undefined, label: "All" },
            { id: "movie", label: "Movies" },
            { id: "tv", label: "TV" },
          ].map((type) => (
            <button
              key={type.label}
              onClick={() => setActiveType(type.id as any)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeType === type.id
                  ? "bg-hover text-ink-0 shadow-sm"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Genre Filter */}
        <select
          value={genreFilter ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              handleGenreFilter(e.target.value);
            } else {
              handleClearFilter();
            }
          }}
          className="bg-overlay border border-line-strong text-ink-200 text-sm py-2 px-3 rounded-lg focus:ring-1 focus:ring-focus outline-none"
        >
          <option value="">All genres</option>
          {genreList.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>

        {genreFilter && (
          <button
            onClick={handleClearFilter}
            className="text-sm text-ink-400 hover:text-ink-200 transition-colors"
          >
            Clear genre filter
          </button>
        )}
      </div>

      {/* Movie Grid */}
      {loading && memoizedMovies.length === 0 && (
        <div className="w-full p-12 flex flex-col items-center justify-center gap-4 min-h-50">
          <LoadingSpinner size="lg" className="border-t-white" />
          <p className="text-ink-400 text-sm animate-pulse">
            Loading your watched list…
          </p>
        </div>
      )}
      {!loading && error && memoizedMovies.length === 0 && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-12 text-center flex flex-col items-center gap-3">
          <p className="text-sm text-danger">Couldn’t load your watched list.</p>
          <button
            onClick={() => mutate()}
            className="text-xs px-3 py-1.5 rounded-full border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !error && memoizedMovies.length === 0 ? (
        <div className="w-full p-10">
          <p className="m-auto w-fit text-ink-400">No items yet.</p>
        </div>
      ) : !loading && !error ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {shown.map((item: any) => {
            const tvStatusLabels: Record<string, string> = {
              watchlist: "Watchlist",
              watching: "Watching",
              watched: "Watched",
              on_hold: "On hold",
              dropped: "Dropped",
            };
            const tvStatusLabel =
              item.item_type === "tv" && typeof item.tv_status === "string"
                ? (tvStatusLabels[item.tv_status] ?? item.tv_status)
                : null;
            // One quiet line: when, your stars, and for a series where it stands
            // if it isn't simply finished. On your own profile every card is
            // watched, so no mark; on someone else's, each poster carries
            // yours — seeing what they've watched is how you log your own.
            const line = [
              item.watched_at ? formatWatchedDate(item.watched_at) : null,
              item.score != null ? formatStars(item.score) : null,
              tvStatusLabel && tvStatusLabel !== "Watched" ? tvStatusLabel : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <TitleCard
                key={`${item.item_type}:${item.item_id}`}
                id={item.item_id}
                title={item.item_name}
                mediaType={item.item_type}
                imageUrl={
                  item.item_adult
                    ? "/pixeled.webp"
                    : item.image_url
                      ? getPosterUrl(item.image_url, "w185")
                      : null
                }
                adult={item.item_adult}
                role={line || null}
                hideState={isOwner}
              />
            );
          })}

        </div>
      ) : null}
      {clipped && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
        >
          Show all {totalItems}
        </button>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={handlePageChange}
          disabled={loadingMore}
          aria-busy={loadingMore}
          className="inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0 disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : "Show more"}
        </button>
      )}
    </div>
  );
}
