"use client";

import MediaCard from "@/components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { SwrFetchError } from "@/utils/swrFetcher";

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

type WatchedPage = { data: any[]; totalItems: number; totalPages: number };

async function watchedPageFetcher(
  key: [string, number, string | null, string | undefined],
): Promise<WatchedPage> {
  const [userID, page, genre, itemType] = key;
  const response = await fetch(`/api/UserWatchedPagination`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userID, page, genre, itemType }),
  });
  if (!response.ok) {
    throw new SwrFetchError("Failed to fetch watched items", response.status);
  }
  return response.json();
}

export default function WatchedGrid({
  userId,
  isOwner = false,
}: {
  userId: string;
  isOwner?: boolean;
}) {
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | undefined>(undefined);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCardData, setShareCardData] = useState<any>(null);

  const getKey = (
    pageIndex: number,
    previousPageData: WatchedPage | null,
  ): [string, number, string | null, string | undefined] | null => {
    if (previousPageData && previousPageData.data.length === 0) return null;
    return [userId, pageIndex + 1, genreFilter, activeType];
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<WatchedPage>(getKey, watchedPageFetcher);

  useEffect(() => {
    setSize(1);
  }, [genreFilter, activeType, setSize]);

  const memoizedMovies = useMemo(
    () => (data ? data.flatMap((p) => p.data) : []),
    [data],
  );
  const totalItems = data?.[0]?.totalItems ?? 0;
  const loading = isLoading;
  const loadingMore = isValidating && size > 1;
  const hasMore = memoizedMovies.length < totalItems;

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

  const handleShare = useCallback((item: any) => {
    setShareCardData({
      id: item.item_id,
      media_type: item.item_type,
      title: item.item_name,
      name: item.item_name,
      poster_path: item.image_url,
    });
    setShareModalOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <SendMessageModal
        data={shareCardData}
        media_type={shareCardData?.media_type ?? null}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Media Type Filter */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-800 border border-surface-700">
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
                  ? "bg-surface-700 text-white shadow-sm"
                  : "text-surface-400 hover:text-surface-200"
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
          className="bg-surface-800 border border-surface-700 text-surface-200 text-sm py-2 px-3 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none"
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
            className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
          >
            Clear genre filter
          </button>
        )}
      </div>

      {/* Movie Grid */}
      {loading && memoizedMovies.length === 0 && (
        <div className="w-full p-12 flex flex-col items-center justify-center gap-4 min-h-[200px]">
          <LoadingSpinner size="lg" className="border-t-white" />
          <p className="text-surface-400 text-sm animate-pulse">
            Loading your watched list…
          </p>
        </div>
      )}
      {!loading && error && memoizedMovies.length === 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-12 text-center flex flex-col items-center gap-3">
          <p className="text-sm text-red-300">Couldn't load your watched list.</p>
          <button
            onClick={() => mutate()}
            className="text-xs px-3 py-1.5 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !error && memoizedMovies.length === 0 ? (
        <div className="w-full p-10">
          <p className="m-auto w-fit text-surface-400">No items yet.</p>
        </div>
      ) : !loading && !error ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {memoizedMovies.map((item: any) => {
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
            const subtitle = (
              <>
                {tvStatusLabel && (
                  <span className="block text-xs text-brand-400/90 font-medium">
                    {tvStatusLabel}
                  </span>
                )}
                {item.watched_at && (
                  <span className="block text-xs text-surface-500">
                    Watched {formatWatchedDate(item.watched_at)}
                  </span>
                )}
                {item.score != null && (
                  <span className="block text-xs text-accent-gold/90 font-medium">
                    {item.score}/10
                  </span>
                )}
              </>
            );
            return (
              <MediaCard
                key={item.item_id}
                id={item.item_id}
                title={item.item_name}
                mediaType={item.item_type}
                imageUrl={
                  item.item_adult
                    ? "/pixeled.webp"
                    : item.image_url
                      ? `https://image.tmdb.org/t/p/w185/${item.image_url}`
                      : null
                }
                adult={item.item_adult}
                genres={item.genres ?? []}
                showActions
                onShare={() => handleShare(item)}
                typeLabel={item.item_type}
                subtitle={subtitle}
              />
            );
          })}

          {/* Load More */}
          {hasMore && (
            <div>
              <button
                className="w-full h-full min-h-[330px] flex flex-col items-center justify-center gap-2 text-surface-300 border border-surface-600 bg-surface-700/80 rounded-xl hover:bg-surface-700 hover:border-surface-500 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                onClick={handlePageChange}
                disabled={loadingMore}
                aria-busy={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <LoadingSpinner size="md" className="border-t-white shrink-0" />
                    <span className="text-sm">Loading more…</span>
                  </>
                ) : (
                  <span className="text-sm font-medium">Load more</span>
                )}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
