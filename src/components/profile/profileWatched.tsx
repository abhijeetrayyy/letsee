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

  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Romance",
  "Science Fiction",
  "TV Movie",
  "Thriller",
  "Action & Adventure",
  "Reality",
  "Sci-Fi & Fantasy",
  "Soap",
  "War",
  "War & Politics",
];

const WatchedMoviesList = ({
  userId,
  isOwner = false,
  genreFilter: initialGenre,
  itemType,
  hideGenreFilter = false,
}: {
  userId: string;
  isOwner?: boolean;
  genreFilter?: string | null;
  itemType?: "tv" | "movie";
  hideGenreFilter?: boolean;
}) => {
  const [movies, setMovies] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string | null>(
    initialGenre ?? null,
  );
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCardData, setShareCardData] = useState<any>(null);

  const fetchMovies = useCallback(
    async (page: number, genre: string | null = null) => {
      if (loading) return; // Prevent multiple simultaneous fetches

      setLoading(true);

      try {
        const response = await fetch(`/api/UserWatchedPagination`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userID: userId, page, genre, itemType }),
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
    [userId, itemType],
  );

  useEffect(() => {
    fetchMovies(currentPage, genreFilter);
  }, [currentPage, genreFilter, itemType]);

  const memoizedMovies = useMemo(() => movies, [movies]);

  const handlePageChange = useCallback(() => {
    if (currentPage < totalPages && !loading) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages, loading]);

  const handleGenreFilter = useCallback((genre: string) => {
    setGenreFilter(genre); // Set the genre filter
    setCurrentPage(1); // Reset to the first page
  }, []);

  const handleClearFilter = useCallback(() => {
    setGenreFilter(null); // Clear the genre filter
    setCurrentPage(1); // Reset to the first page
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
    <div>
      <SendMessageModal
        data={shareCardData}
        media_type={shareCardData?.media_type ?? null}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
      {/* Genre Filter Buttons */}
      {!hideGenreFilter && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={handleClearFilter}
            className={`text-sm md:text-base px-4 py-2 rounded-md ${
              !genreFilter
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleGenreFilter("Animation")}
            className={`text-sm md:text-base px-4 py-2 rounded-md ${
              genreFilter === "Animation"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Anime/Animation
          </button>
          {genreList.map((genre, index) => (
            <button
              key={index}
              onClick={() => handleGenreFilter(genre)}
              className={`px-4 py-2 rounded-md text-sm md:text-base ${
                genreFilter === genre
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {/* Movie Grid */}
      {loading && memoizedMovies.length === 0 && (
        <div className="w-full p-12 flex flex-col items-center justify-center gap-4 min-h-[200px]">
          <LoadingSpinner size="lg" className="border-t-white" />
          <p className="text-neutral-400 text-sm animate-pulse">
            Loading your watched list…
          </p>
        </div>
      )}
      {!loading && memoizedMovies.length === 0 ? (
        <div className="w-full p-10">
          <p className="m-auto w-fit text-neutral-400">No items yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 ">
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
                  <span className="block text-xs text-indigo-400/90 font-medium">
                    {tvStatusLabel}
                  </span>
                )}
                {item.watched_at && (
                  <span className="block text-xs text-neutral-500">
                    Watched {formatWatchedDate(item.watched_at)}
                  </span>
                )}
                {item.score != null && (
                  <span className="block text-xs text-amber-400/90 font-medium">
                    {item.score}/10
                  </span>
                )}
                {(isOwner ? item.review_text : item.public_review_text) && (
                  <span className="block text-xs text-neutral-400 line-clamp-2 mt-0.5">
                    {(() => {
                      const text = isOwner
                        ? item.review_text
                        : item.public_review_text;
                      return text && text.length > 50
                        ? text.slice(0, 50) + "…"
                        : text;
                    })()}
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

          {/* Show "More..." button only if there are more items to load */}
          {memoizedMovies.length < totalItems && (
            <div>
              <button
                className="w-full h-full min-h-[330px] flex flex-col items-center justify-center gap-2 text-neutral-300 border border-neutral-600 bg-neutral-700/80 rounded-xl hover:bg-neutral-700 hover:border-neutral-500 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                onClick={handlePageChange}
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <LoadingSpinner
                      size="md"
                      className="border-t-white shrink-0"
                    />
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
};

export default WatchedMoviesList;
