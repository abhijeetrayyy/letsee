"use client";

import MediaCard from "@/components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCallback, useEffect, useMemo, useState } from "react";

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

export default function WatchedGrid({
  userId,
  isOwner = false,
}: {
  userId: string;
  isOwner?: boolean;
}) {
  const [movies, setMovies] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | undefined>(undefined);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCardData, setShareCardData] = useState<any>(null);

  const fetchMovies = useCallback(
    async (
      page: number,
      genre: string | null = null,
      type: string | undefined = activeType,
    ) => {
      if (loading) return;

      setLoading(true);

      try {
        const response = await fetch(`/api/UserWatchedPagination`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userID: userId, page, genre, itemType: type }),
        });

        if (!response.ok) throw new Error("Failed to fetch");

        const data = await response.json();

        setMovies((prevMovies) =>
          page === 1 ? data.data : [...prevMovies, ...data.data],
        );
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      } catch (error) {
        console.error("Error fetching watched movies:", error);
      } finally {
        setLoading(false);
      }
    },
    [userId, activeType],
  );

  useEffect(() => {
    fetchMovies(currentPage, genreFilter, activeType);
  }, [currentPage, genreFilter, activeType, fetchMovies]);

  const memoizedMovies = useMemo(() => movies, [movies]);

  const handlePageChange = useCallback(() => {
    if (currentPage < totalPages && !loading) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages, loading]);

  const handleGenreFilter = useCallback((genre: string) => {
    setGenreFilter(genre);
    setCurrentPage(1);
  }, []);

  const handleClearFilter = useCallback(() => {
    setGenreFilter(null);
    setCurrentPage(1);
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
              onClick={() => {
                setActiveType(type.id as any);
                setCurrentPage(1);
              }}
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
      {!loading && memoizedMovies.length === 0 ? (
        <div className="w-full p-10">
          <p className="m-auto w-fit text-surface-400">No items yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {memoizedMovies.map((item: any) => {
            const tvStatusLabels: Record<string, string> = {
              watching: "Watching",
              completed: "Completed",
              on_hold: "On hold",
              dropped: "Dropped",
              plan_to_watch: "Plan to watch",
              rewatching: "Rewatching",
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
          {memoizedMovies.length < totalItems && (
            <div>
              <button
                className="w-full h-full min-h-[330px] flex flex-col items-center justify-center gap-2 text-surface-300 border border-surface-600 bg-surface-700/80 rounded-xl hover:bg-surface-700 hover:border-surface-500 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                onClick={handlePageChange}
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
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
      )}
    </div>
  );
}
