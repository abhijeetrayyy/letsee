"use client";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { GenreList } from "@/staticData/genreList";
import SendMessageModal from "@components/message/sendCard";
import MediaCard from "@components/cards/MediaCard";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useRef, useState } from "react";

interface SearchResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  adult: boolean;
  profile_path?: string;
  known_for_department?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total_pages: number;
  total_results: number;
  page: number;
  searched: boolean;
}

function Page() {
  const [results, setResults] = useState<SearchResponse>({
    results: [],
    total_pages: 0,
    total_results: 0,
    page: 1,
    searched: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [displayquery, setdisplayquery] = useState("");
  const [page, setPage] = useState(1);
  const [mediaType, setMediaType] = useState<string>("multi");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<any>(null);

  const topScroll = useRef(null);

  // Debounced fetch function
  const fetchData = useCallback(
    debounce(async (searchQuery: string, searchPage: number, type: string) => {
      if (!searchQuery) {
        setResults({
          results: [],
          total_pages: 0,
          total_results: 0,
          page: 1,
          searched: false,
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/homeSearch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQuery,
            page: searchPage,
            media_type: type,
          }),
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Network response failed: ${response.status}`);
        }

        const data: SearchResponse = await response.json();
        setResults({
          results: data.results,
          total_pages: data.total_pages,
          total_results: data.total_results,
          page: data.page,
          searched: true,
        });
        setdisplayquery(searchQuery);
        setPage(data.page); // Sync page with API response
      } catch (err) {
        setError(
          (err as Error).message || "An error occurred while fetching data"
        );
        setResults({
          results: [],
          total_pages: 0,
          total_results: 0,
          page: searchPage,
          searched: true,
        });
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleScroll(topScroll.current);
      setPage(1);
      fetchData(query, 1, mediaType);
    } else {
      setResults({
        results: [],
        total_pages: 0,
        total_results: 0,
        page: 1,
        searched: false,
      });
      setError(null);
    }
  };
  useEffect(() => {
    fetchData(query, 1, mediaType);
  }, [mediaType]);
  // Handle page change
  const changePage = useCallback(
    (newPage: number) => {
      if (query && newPage >= 1 && newPage <= results.total_pages) {
        handleScroll(topScroll.current);
        setPage(newPage);

        fetchData(query, newPage, mediaType);
      }
    },
    [query, mediaType, results.total_pages, fetchData]
  );

  const handleCardTransfer = (data: SearchResult) => {
    setCardData(data);
    setIsModalOpen(true);
  };

  const handleScroll = (ref: HTMLDivElement | null) => {
    if (ref) {
      const element = ref;
      const elementRect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;

      // Calculate position to center the element in the viewport
      const centerPosition =
        scrollTop +
        elementRect.top -
        viewportHeight / 2 +
        elementRect.height / 2;

      window.scrollTo({
        top: element.offsetTop - 100,
        behavior: "smooth",
      });
    }
  };

  const displayMediaType = (data: SearchResult) =>
    data.media_type ?? (mediaType === "person" ? "person" : mediaType === "tv" ? "tv" : "movie");

  const renderCard = (data: SearchResult) => {
    const isPerson = data.media_type === "person" || mediaType === "person";
    const title = data.title || data.name || "Unknown";
    const typeLabel = displayMediaType(data);
    const year =
      !isPerson && (data.release_date || data.first_air_date)
        ? String(new Date(data.release_date || data.first_air_date || "").getFullYear())
        : null;
    const genres: string[] =
      data.genre_ids
        ?.map((id: number) => GenreList.genres.find((g: any) => g.id === id)?.name)
        .filter((n): n is string => Boolean(n)) ?? [];

    return (
      <MediaCard
        key={data.id}
        id={data.id}
        title={title}
        mediaType={isPerson ? "person" : (typeLabel as "movie" | "tv")}
        posterPath={isPerson ? data.profile_path : (data.poster_path || data.backdrop_path)}
        adult={data.adult}
        genres={genres}
        showActions={!isPerson}
        onShare={!isPerson ? (e) => { e.preventDefault(); handleCardTransfer(data); } : undefined}
        typeLabel={typeLabel}
        year={year}
        knownFor={isPerson ? data.known_for_department : undefined}
      />
    );
  };

  return (
    <div
      ref={topScroll}
      className=" mx-auto w-full max-w-7xl px-4 py-6 text-white"
    >
      {/* Search Bar and Filter */}
      <form
        onSubmit={handleSearch}
        className="mb-8 flex flex-col sm:flex-row gap-4 items-center"
      >
        <input
          type="text"
          value={query}
          onKeyDown={(e) => e.key == "enter" && handleSearch}
          onChange={(e) => setQuery(e.target.value)}
          className="px-4 py-2 w-full sm:flex-1 bg-neutral-800 text-white rounded-md border-1 border-neutral-600 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-0"
          placeholder="Search for movies, TV shows, or people..."
        />
        <select
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value)}
          className="px-4 py-2 bg-neutral-700 rounded-md text-white"
        >
          <option value="multi">All</option>
          <option value="movie">Movies</option>
          <option value="tv">TV Shows</option>
          <option value="person">Person</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 min-w-[100px]"
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" className="border-t-white shrink-0" />
              <span>Searching…</span>
            </>
          ) : (
            "Search"
          )}
        </button>
      </form>

      {/* Loading State */}
      {loading && (
        <div className="min-h-52 w-full flex flex-col justify-center items-center gap-4">
          <LoadingSpinner size="lg" className="border-t-white" />
          <p className="text-neutral-400 text-sm animate-pulse">Searching…</p>
        </div>
      )}

      {/* Results or Prompt */}
      {!loading && (
        <div className="w-full h-auto my-4">
          {results.total_results > 0 && (
            <div className="mb-4">
              <p>
                Search Results: "{displayquery}" - {results.total_results} items
              </p>
            </div>
          )}

          {results.total_results === 0 && results.searched && (
            <div className="flex flex-col h-full w-full gap-5 items-center justify-center">
              <p className="text-lg">
                Result for "
                <span className="text-pink-600">{displayquery}</span>"
                <span className="font-bold text-purple-600"> is not found</span>{" "}
                - or check your spelling
              </p>
              <img
                src="/abhijeetray.webp"
                alt="not-found"
                className="max-w-md"
              />
            </div>
          )}

          {!query && (
            <p className="text-center text-sm">
              Please enter a search query to see results.
            </p>
          )}

          {results.results.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {results.results.map((data) => renderCard(data))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && results.total_pages > 1 && (
        <div className="flex flex-row justify-center items-center my-6">
          <button
            className="px-4 py-2 bg-neutral-700 rounded-md hover:bg-neutral-600 disabled:opacity-50"
            onClick={() => changePage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="mx-4">
            Page {page} of {results.total_pages}
          </span>
          <button
            className="px-4 py-2 bg-neutral-700 rounded-md hover:bg-neutral-600 disabled:opacity-50"
            onClick={() => changePage(page + 1)}
            disabled={page === results.total_pages}
          >
            Next
          </button>
        </div>
      )}

      {mediaType !== "person" && cardData && (
        <SendMessageModal
          media_type={cardData.media_type}
          data={cardData}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

export default Page;
