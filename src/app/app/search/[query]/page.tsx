"use client";
import { useSearch } from "@/app/contextAPI/searchContext";
import ThreePrefrenceBtn from "@/components/buttons/threePrefrencebtn";
import SendMessageModal from "@components/message/sendCard";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { LuSend } from "react-icons/lu";
import { GenreList } from "@/staticData/genreList";

interface SearchResult {
  id: number;
  media_type: "movie" | "tv" | "person" | "keyword";
  title?: string;
  name: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  adult?: boolean;
  profile_path?: string;
  known_for_department?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total_pages: number;
  total_results: number;
}

const MEDIA_TYPES = ["multi", "movie", "tv", "person", "keyword"] as const;

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const buildPageItems = (current: number, total: number) => {
  if (total <= 1) return [];
  const pages = new Set<number>();
  for (let i = current - 2; i <= current + 2; i += 1) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  pages.add(1);
  pages.add(total);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const items: Array<number | "..."> = [];

  sorted.forEach((page, index) => {
    const prev = sorted[index - 1];
    if (index > 0 && page - (prev ?? 0) > 1) {
      items.push("...");
    }
    items.push(page);
  });

  return items;
};

function SearchPage() {
  const [results, setResults] = useState<SearchResponse>({
    results: [],
    total_pages: 0,
    total_results: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setIsSearchLoading } = useSearch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [page, setPage] = useState<number>(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();

  // Get query and media type from URL
  const params = useParams();
  const searchParams = useSearchParams();
  const query = Array.isArray(params.query)
    ? params.query[0]
    : params.query || "";
  const mediaType = searchParams.get("media_type") || "multi"; // Default to "multi"
  const urlPage = Number(searchParams.get("page")) || 1;
  const includeAdult = searchParams.get("adult") === "1";
  const decodedQuery = useMemo(() => safeDecode(query), [query]);
  const normalizedMediaType = MEDIA_TYPES.includes(
    mediaType as (typeof MEDIA_TYPES)[number]
  )
    ? mediaType
    : "multi";

  const [draftQuery, setDraftQuery] = useState(decodedQuery);
  const [pageInput, setPageInput] = useState(String(urlPage));
  const isKeywordList = useMemo(
    () =>
      normalizedMediaType === "keyword" &&
      results.results.length > 0 &&
      results.results.every((item) => item.media_type === "keyword"),
    [normalizedMediaType, results.results]
  );
  const pageItems = useMemo(
    () => buildPageItems(page, results.total_pages),
    [page, results.total_pages]
  );

  const buildSearchUrl = (
    nextQuery: string,
    nextMediaType: string,
    nextPage: number,
    adult: boolean
  ) =>
    `/app/search/${encodeURIComponent(nextQuery)}?media_type=${nextMediaType}&page=${nextPage}${
      adult ? "&adult=1" : ""
    }`;

  // Sync page state with URL
  useEffect(() => {
    setPage(urlPage);
    setPageInput(String(urlPage));
  }, [urlPage]);

  useEffect(() => {
    setDraftQuery(decodedQuery);
  }, [decodedQuery]);

  // Fetch data from the API
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      const trimmedQuery = decodedQuery.trim();
      if (trimmedQuery.length < 2) {
        setResults({ results: [], total_pages: 0, total_results: 0 });
        setError(null);
        setLoading(false);
        setIsSearchLoading(false);
        return;
      }

      setLoading(true);
      setIsSearchLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/searchPage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmedQuery,
            media_type: normalizedMediaType,
            page: page,
            include_adult: includeAdult,
          }),
          cache: "no-store", // Ensure fresh data
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorMessage = `Search failed (${response.status})`;
          try {
            const payload = await response.json();
            if (payload?.error) {
              errorMessage = payload.error;
            }
            if (payload?.upstream_status || payload?.upstream_message) {
              const upstreamInfo = [
                payload.upstream_status ? `status ${payload.upstream_status}` : "",
                payload.upstream_message,
              ]
                .filter(Boolean)
                .join(" - ");
              errorMessage = `${errorMessage} (${upstreamInfo})`;
            }
            if (payload?.details) {
              errorMessage = `${errorMessage} • ${payload.details}`;
            }
          } catch {
            // ignore JSON parsing errors
          }
          throw new Error(errorMessage);
        }

        const data: SearchResponse = await response.json();
        setResults(data);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(
          (err as Error).message || "An error occurred while fetching data"
        );
        setResults({ results: [], total_pages: 0, total_results: 0 });
      } finally {
        setLoading(false);
        setIsSearchLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [
    decodedQuery,
    page,
    normalizedMediaType,
    includeAdult,
    refreshKey,
    setIsSearchLoading,
  ]);

  // Handle card transfer for sending messages
  const handleCardTransfer = (data: SearchResult) => {
    setCardData(data);
    setIsModalOpen(true);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = draftQuery.trim();
    if (nextQuery.length < 2) return;
    router.push(buildSearchUrl(nextQuery, normalizedMediaType, 1, includeAdult));
  };

  const handleFilterChange = (type: string) => {
    router.push(buildSearchUrl(decodedQuery, type, 1, includeAdult));
  };

  const handleRetry = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleAdultToggle = () => {
    router.push(
      buildSearchUrl(decodedQuery, normalizedMediaType, 1, !includeAdult)
    );
  };

  const handleKeywordSelect = (keywordId: number) => {
    router.push(buildSearchUrl(String(keywordId), "keyword", 1, includeAdult));
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > results.total_pages) return;
    router.push(
      buildSearchUrl(decodedQuery, normalizedMediaType, nextPage, includeAdult)
    );
  };

  const handlePageInputSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPage = Number(pageInput);
    if (!Number.isFinite(nextPage)) return;
    handlePageChange(nextPage);
  };

  return (
    <div className="min-h-screen mx-auto w-full max-w-7xl px-4 py-6">
      <div className="flex flex-col gap-4 mb-6 text-white">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            className="flex-1 rounded-full bg-neutral-800 px-4 py-3 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
            type="text"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Search movies, TV, people, or keywords..."
          />
          <button
            type="submit"
            className="rounded-full bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-500"
          >
            Search
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {MEDIA_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleFilterChange(type)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${
                normalizedMediaType === type
                  ? "bg-neutral-200 text-neutral-900"
                  : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              }`}
            >
              {type === "multi" ? "All" : type === "tv" ? "TV Shows" : type}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAdultToggle}
            aria-pressed={includeAdult}
            className={`rounded-full px-4 py-1.5 text-sm ${
              includeAdult
                ? "bg-amber-500 text-neutral-900"
                : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            }`}
          >
            {includeAdult ? "Adult: On" : "Adult: Off"}
          </button>
        </div>
        <div className="text-sm text-neutral-400">
          {decodedQuery
            ? `Results for "${decodedQuery}" • ${
                normalizedMediaType === "multi"
                  ? "All"
                  : normalizedMediaType === "tv"
                  ? "TV Shows"
                  : normalizedMediaType
              } • ${includeAdult ? "Adult on" : "Safe search"}`
            : "Enter a search term to get started."}
        </div>
      </div>

      {normalizedMediaType !== "person" && cardData && (
        <SendMessageModal
          media_type={cardData.media_type}
          data={cardData}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200 flex flex-col gap-2">
          <p>{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="w-fit rounded-full bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="min-h-screen w-full flex justify-center items-center text-white">
          <div className="flex flex-col items-center gap-3">
            <LuSend className="animate-spin" />
            Loading results...
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && (
        <div className="text-white w-full my-4">
          {results.total_results > 0 && (
            <div className="mb-4">
              <p>
                Search Results: For{" "}
                {normalizedMediaType === "multi"
                  ? "all"
                  : normalizedMediaType}{" "}
                - {results.total_results} items
              </p>
            </div>
          )}

          {/* "Result not found" message */}
          {!loading &&
            results.total_results === 0 &&
            decodedQuery.trim().length >= 2 && (
            <div className="flex flex-col h-full w-full gap-5 items-center justify-center text-white">
              <p className="text-lg">
                Result for "
                <span className="text-pink-600">{decodedQuery}</span>
                "
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

          {/* Display results */}
          {results.total_results > 0 && isKeywordList && (
            <div className="rounded-lg bg-neutral-800 p-4">
              <p className="mb-3 text-sm text-neutral-300">
                Choose a keyword to explore related movies.
              </p>
              <div className="flex flex-wrap gap-2">
                {results.results.map((keyword) => (
                  <button
                    key={keyword.id}
                    type="button"
                    onClick={() => handleKeywordSelect(keyword.id)}
                    className="rounded-full bg-neutral-700 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-600"
                  >
                    {keyword.name || "Keyword"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.total_results > 0 && !isKeywordList && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {results.results.map((data: SearchResult) => {
                const displayMediaType =
                  normalizedMediaType === "keyword"
                    ? "movie"
                    : normalizedMediaType === "multi"
                    ? data.media_type
                    : normalizedMediaType;

                if (displayMediaType === "person") {
                  return (
                    <div
                      key={data.id}
                      className="relative group flex flex-col bg-indigo-700 w-full h-full pb-2 text-gray-300 rounded-md overflow-hidden hover:z-10"
                    >
                      <div className="absolute top-0 left-0 flex flex-row justify-between w-full z-10">
                        <p className="p-1 bg-black text-white rounded-br-md text-sm">
                          person
                        </p>
                      </div>
                      <Link
                        href={`/app/person/${data.id}`}
                        className="h-full w-full"
                      >
                        <img
                          className="object-cover h-full w-full"
                          src={
                            data.profile_path
                              ? `https://image.tmdb.org/t/p/h632${data.profile_path}`
                              : "/no-photo.webp"
                          }
                          alt={data.name || "Unknown"}
                        />
                      </Link>
                      <span className="bg-indigo-700 flex flex-col gap-3 py-2 px-2 text-gray-300">
                        <Link
                          href={`/app/person/${data.id}`}
                          className="group-hover:underline"
                        >
                          {data.name?.length > 16
                            ? `${data.name.slice(0, 14)}..`
                            : data.name || "Unknown"}
                        </Link>
                        {data.known_for_department && (
                          <div className="text-xs underline">
                            {data.known_for_department}
                          </div>
                        )}
                      </span>
                    </div>
                  );
                } else if (
                  displayMediaType === "movie" ||
                  displayMediaType === "tv"
                ) {
                  return (
                    <div
                      key={data.id}
                      className="relative group flex flex-col bg-neutral-900 w-full h-full text-gray-300 rounded-md overflow-hidden hover:z-10"
                    >
                      <div className="absolute top-0 left-0 flex flex-row justify-between w-full z-10">
                        <p className="p-1 bg-black text-white rounded-br-md text-sm">
                          {displayMediaType}
                        </p>
                        {(data.release_date || data.first_air_date) && (
                          <p className="p-1 bg-indigo-600 text-white rounded-bl-md text-sm">
                            {new Date(
                              data.release_date || data.first_air_date || ""
                            ).getFullYear() || "N/A"}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/app/${displayMediaType}/${data.id}`}
                        className="h-full w-full"
                      >
                        <img
                          className="object-cover w-full h-full"
                          src={
                            data.poster_path || data.backdrop_path
                              ? `https://image.tmdb.org/t/p/w342${
                                  data.poster_path || data.backdrop_path
                                }`
                              : "/no-photo.webp"
                          }
                          alt={data.title || data.name || "Unknown"}
                        />
                      </Link>
                      <div className="w-full bg-neutral-900">
                        <ThreePrefrenceBtn
                          genres={
                            data.genre_ids
                              ?.map((id: number) => {
                                const genre = GenreList.genres.find(
                                  (g: any) => g.id === id
                                );
                                return genre ? genre.name : null;
                              })
                              .filter(Boolean) || []
                          }
                          cardId={data.id}
                          cardType={displayMediaType}
                          cardName={data.name || data.title || "Unknown"}
                          cardAdult={data.adult}
                          cardImg={data.poster_path || data.backdrop_path}
                        />
                        <div className="py-2 border-t border-neutral-950 bg-neutral-800 hover:bg-neutral-700">
                          <button
                            className="w-full flex justify-center text-lg text-center text-gray-300 hover:text-white"
                            onClick={() => handleCardTransfer(data)}
                          >
                            <LuSend />
                          </button>
                        </div>
                        <div
                          title={data.name || data.title || "Unknown"}
                          className="w-full flex flex-col h-full gap-2 px-4 bg-indigo-700 text-gray-200"
                        >
                          <Link
                            href={`/app/${displayMediaType}/${data.id}`}
                            className="mb-1 hover:underline"
                          >
                            <span>
                              {(data.title || data.name || "").length > 20
                                ? `${(data.title || data.name || "").slice(
                                    0,
                                    20
                                  )}...`
                                : data.title || data.name || "Unknown"}
                            </span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return null; // Handle unexpected media types
                }
              })}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && results.total_pages > 1 && (
        <div className="flex flex-col items-center gap-3 my-6 text-white">
          <div className="flex flex-wrap items-center gap-2 justify-center">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className={`px-3 py-2 rounded-md bg-neutral-700 hover:bg-neutral-600 ${
                page === 1 ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Previous
            </button>
            {pageItems.map((item, index) =>
              item === "..." ? (
                <span key={`ellipsis-${index}`} className="px-2 text-neutral-400">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => handlePageChange(item)}
                  className={`px-3 py-2 rounded-md ${
                    item === page
                      ? "bg-neutral-200 text-neutral-900"
                      : "bg-neutral-700 hover:bg-neutral-600"
                  }`}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === results.total_pages}
              className={`px-3 py-2 rounded-md bg-neutral-700 hover:bg-neutral-600 ${
                page === results.total_pages ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Next
            </button>
          </div>
          <div className="text-sm text-neutral-400">
            Page {page} of {results.total_pages}
          </div>
          <form
            onSubmit={handlePageInputSubmit}
            className="flex items-center gap-2"
          >
            <input
              type="number"
              min={1}
              max={results.total_pages}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              className="w-20 rounded-md bg-neutral-800 px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              aria-label="Go to page"
            />
            <button
              type="submit"
              className="rounded-md bg-neutral-700 px-3 py-2 hover:bg-neutral-600"
            >
              Go
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default SearchPage;
