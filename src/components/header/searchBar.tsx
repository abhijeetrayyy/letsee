"use client";

import { useSearch } from "@/app/contextAPI/searchContext";
import {
  buildSearchUrl,
  isValidSearchQuery,
  type SearchMediaType,
} from "@/utils/searchUrl";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
import { FaCircleNotch } from "react-icons/fa6";

interface SearchResult {
  id: number;
  media_type: "movie" | "tv" | "person" | "keyword";
  title?: string;
  name?: string;
  poster_path?: string;
  profile_path?: string;
}

type ResultsState = {
  movie: SearchResult[];
  tv: SearchResult[];
  person: SearchResult[];
  keyword: SearchResult[];
};

type FlatResult = {
  key: string;
  label: string;
  href: string;
  category: "movie" | "tv" | "person" | "keyword";
  image?: string;
};

const MAX_RECENT = 5;

const emptyResults: ResultsState = {
  movie: [],
  tv: [],
  person: [],
  keyword: [],
};

function highlightLabel(text: string, query: string) {
  if (!query || query.length < 2) return text;
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${safeQuery})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={`${part}-${index}`}
        className="bg-amber-400 text-black rounded-sm px-1"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function getTitle(result: SearchResult) {
  return result.title || result.name || "Unknown";
}

function getHref(result: SearchResult, category: FlatResult["category"]) {
  if (category === "person") return `/app/person/${result.id}`;
  if (category === "keyword") {
    return buildSearchUrl({ query: String(result.id), mediaType: "keyword", page: 1 });
  }
  return `/app/${category}/${result.id}`;
}

function normalizeResults(results: ResultsState) {
  return {
    movie: results.movie.slice(0, 4),
    tv: results.tv.slice(0, 4),
    person: results.person.slice(0, 4),
    keyword: results.keyword.slice(0, 4),
  };
}

function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("recent_searches");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setRecentSearches(parsed);
    } catch {
      setRecentSearches([]);
    }
  }, []);

  const updateRecentSearches = (value: string) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)].slice(
        0,
        MAX_RECENT
      );
      if (typeof window !== "undefined") {
        window.localStorage.setItem("recent_searches", JSON.stringify(next));
      }
      return next;
    });
  };

  return { recentSearches, updateRecentSearches, setRecentSearches };
}

function SearchBar() {
  const [input, setInput] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [results, setResults] = useState<ResultsState>(emptyResults);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { isSearchLoading, setIsSearchLoading } = useSearch();
  const { recentSearches, updateRecentSearches, setRecentSearches } =
    useRecentSearches();
  const router = useRouter();

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Record<string, ResultsState>>({});

  const query = input.trim();
  const displayResults = useMemo(() => normalizeResults(results), [results]);

  const flatResults = useMemo<FlatResult[]>(() => {
    const flattened: FlatResult[] = [];
    (["movie", "tv", "person", "keyword"] as const).forEach((category) => {
      displayResults[category].forEach((item) => {
        const label = getTitle(item);
        const image =
          item.poster_path || item.profile_path
            ? `https://image.tmdb.org/t/p/w92${
                item.poster_path || item.profile_path
              }`
            : undefined;
        flattened.push({
          key: `${category}-${item.id}`,
          label,
          href: getHref(item, category),
          category,
          image,
        });
      });
    });
    return flattened;
  }, [displayResults]);

  useEffect(() => {
    if (!isModalOpen) return;

    if (!isValidSearchQuery(query)) {
      setResults(emptyResults);
      setError(null);
      setIsLoading(false);
      setActiveIndex(-1);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    if (cacheRef.current[query]) {
      setResults(cacheRef.current[query]);
      setError(null);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    setIsLoading(true);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const [generalResponse, keywordResponse] = await Promise.all([
          fetch(`/api/search?query=${encodeURIComponent(query)}`, {
            signal: controller.signal,
          }),
          fetch(
            `/api/search?query=${encodeURIComponent(
              query
            )}&media_type=keyword`,
            {
              signal: controller.signal,
            }
          ),
        ]);

        if (!generalResponse.ok || !keywordResponse.ok) {
          throw new Error("Failed to fetch results");
        }

        const generalData = await generalResponse.json();
        const keywordData = await keywordResponse.json();

        const movie = generalData.results.filter(
          (item: SearchResult) => item.media_type === "movie"
        );
        const tv = generalData.results.filter(
          (item: SearchResult) => item.media_type === "tv"
        );
        const person = generalData.results.filter(
          (item: SearchResult) => item.media_type === "person"
        );
        const keyword = keywordData.results.map(
          (kw: { id: number; name: string }) => ({
            id: kw.id,
            media_type: "keyword",
            name: kw.name,
          })
        );

        const nextResults = { movie, tv, person, keyword };
        cacheRef.current[query] = nextResults;
        setResults(nextResults);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching search results:", err);
        setError("Something went wrong. Please try again.");
        setResults(emptyResults);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isModalOpen]);

  useEffect(() => {
    if (flatResults.length === 0) {
      setActiveIndex(-1);
    } else if (activeIndex >= flatResults.length) {
      setActiveIndex(flatResults.length - 1);
    }
  }, [flatResults, activeIndex]);

  const closeModal = () => {
    setIsModalOpen(false);
    setInput("");
    setResults(emptyResults);
    setError(null);
    setActiveIndex(-1);
    setIsSearchLoading(false);
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const handleSearch = (value: string, category?: SearchMediaType) => {
    const term = value.trim();
    if (!isValidSearchQuery(term)) return;
    updateRecentSearches(term);
    setIsSearchLoading(true);
    router.push(buildSearchUrl({ query: term, mediaType: category ?? "multi", page: 1 }));
    closeModal();
  };

  const handleSelectResult = (result: FlatResult) => {
    updateRecentSearches(query);
    setIsSearchLoading(true);
    router.push(result.href);
    closeModal();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (flatResults.length === 0) return;
      setActiveIndex((prev) => (prev + 1) % flatResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (flatResults.length === 0) return;
      setActiveIndex((prev) =>
        prev <= 0 ? flatResults.length - 1 : prev - 1
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && flatResults[activeIndex]) {
        handleSelectResult(flatResults[activeIndex]);
        return;
      }
      handleSearch(query);
    }
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("recent_searches");
    }
  };

  return (
    <>
      <form className="relative flex flex-row items-center w-full max-w-md">
        <input
          className="hidden md:flex w-full py-2 px-4 bg-neutral-800 text-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-neutral-500 placeholder-neutral-400 text-sm sm:text-base"
          name="searchtext"
          type="text"
          value={input}
          onFocus={openModal}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setInput(e.target.value)
          }
          placeholder="Search movies, TV, people..."
        />
        <button
          onClick={openModal}
          type="button"
          className=" md:absolute md:right-2 md:top-1/2 transform md:-translate-y-1/2 bg-neutral-700 text-neutral-100 p-1.5 rounded-full hover:bg-neutral-600"
          disabled={isSearchLoading}
          aria-label="Open search"
        >
          {isSearchLoading ? (
            <div className="w-fit m-auto animate-spin">
              <FaCircleNotch size={16} />
            </div>
          ) : (
            <FaSearch size={16} />
          )}
        </button>
      </form>

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="fixed inset-0 z-50 flex flex-col items-center justify-start pt-8 sm:pt-12"
        >
          {/* Backdrop: blurred + dimmed — click to close */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
            aria-hidden
            onClick={closeModal}
          />
          {/* Content: click inside does not close */}
          <div
            className="relative w-full max-w-4xl rounded-2xl border border-neutral-700/60 bg-neutral-900/95 px-4 py-5 shadow-xl sm:px-6 sm:py-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex flex-row items-center mb-4">
              <FaSearch className="absolute left-4 text-neutral-400" />
              <input
                className="w-full py-3 pl-11 pr-10 bg-neutral-800 text-neutral-200 rounded-full focus:outline-none focus:ring-2 focus:ring-neutral-500 text-base sm:text-lg placeholder-neutral-400"
                name="searchtext"
                type="text"
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInput(e.target.value)
                }
                onKeyDown={handleKeyDown}
                placeholder="Search movies, TV shows, people, or keywords..."
                autoFocus
              />
              <button
                type="button"
                onClick={closeModal}
                className="absolute right-3 text-neutral-400 hover:text-neutral-200"
                aria-label="Close search"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mb-4">
              <span className="rounded-full border border-neutral-700 px-2 py-1">
                Press Enter to search
              </span>
              <span className="rounded-full border border-neutral-700 px-2 py-1">
                ↑ ↓ to navigate
              </span>
              <span className="rounded-full border border-neutral-700 px-2 py-1">
                Esc to close
              </span>
            </div>

            <div className="w-full max-h-[70vh] overflow-y-auto text-white">
              {!isValidSearchQuery(query) && (
                <div className="space-y-4">
                  <div className="text-neutral-300">
                    Start typing to search across movies, TV, people, and
                    keywords.
                  </div>
                  {recentSearches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-neutral-100">
                          Recent searches
                        </h3>
                        <button
                          type="button"
                          onClick={handleClearRecent}
                          className="text-xs text-neutral-400 hover:text-neutral-200"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => handleSearch(term)}
                            className="rounded-full bg-neutral-800 px-3 py-1 text-sm text-neutral-200 hover:bg-neutral-700"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isValidSearchQuery(query) && (
                <>
                  {isLoading && (
                    <div className="flex flex-col items-center gap-3 py-6 text-neutral-300">
                      <FaCircleNotch className="animate-spin" size={24} />
                      Searching for “{query}”
                    </div>
                  )}

                  {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                      {error}
                    </div>
                  )}

                  {!isLoading && !error && flatResults.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-10 text-neutral-300">
                      <p>No results found for “{query}”.</p>
                      <button
                        type="button"
                        onClick={() => handleSearch(query)}
                        className="rounded-full bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
                      >
                        Search anyway
                      </button>
                    </div>
                  )}

                  {!isLoading &&
                    !error &&
                    (["movie", "tv", "person", "keyword"] as const).map(
                      (category) => {
                        const items = displayResults[category];
                        if (items.length === 0) return null;
                        return (
                          <div key={category} className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold capitalize">
                                {category === "tv" ? "TV Shows" : category}
                              </h3>
                              <button
                                type="button"
                                onClick={() => handleSearch(query, category)}
                                className="text-sm text-neutral-300 hover:text-white"
                              >
                                View all
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {items.map((item) => {
                                const flattenedIndex = flatResults.findIndex(
                                  (flat) => flat.key === `${category}-${item.id}`
                                );
                                const isActive =
                                  flattenedIndex === activeIndex;
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() =>
                                      handleSelectResult({
                                        key: `${category}-${item.id}`,
                                        label: getTitle(item),
                                        href: getHref(item, category),
                                        category,
                                        image:
                                          item.poster_path ||
                                          item.profile_path
                                            ? `https://image.tmdb.org/t/p/w92${
                                                item.poster_path ||
                                                item.profile_path
                                              }`
                                            : undefined,
                                      })
                                    }
                                    className={`flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                                      isActive
                                        ? "bg-neutral-700"
                                        : "bg-neutral-800 hover:bg-neutral-700"
                                    }`}
                                  >
                                    {item.poster_path || item.profile_path ? (
                                      <img
                                        src={`https://image.tmdb.org/t/p/w92${
                                          item.poster_path ||
                                          item.profile_path ||
                                          ""
                                        }`}
                                        alt={getTitle(item)}
                                        className="w-12 h-16 rounded object-cover"
                                        loading="lazy"
                                        decoding="async"
                                      />
                                    ) : (
                                      <div className="w-12 h-16 rounded bg-neutral-700 flex items-center justify-center text-xs text-neutral-400">
                                        N/A
                                      </div>
                                    )}
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium text-neutral-100">
                                        {highlightLabel(getTitle(item), query)}
                                      </span>
                                      <span className="text-xs text-neutral-400 capitalize">
                                        {category === "tv"
                                          ? "TV show"
                                          : category}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SearchBar;
