"use client";

import Link from "next/link";
import {
  reRankAll,
  getDidYouMeanSuggestion,
} from "@/utils/searchFuzzy";
import {
  buildSearchUrl,
  isValidSearchQuery,
  type SearchMediaType,
} from "@/utils/searchUrl";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaFilter, FaSearch } from "react-icons/fa";

const MAX_RECENT = 8;
const STORAGE_KEY = "recent_searches";
const DEBOUNCE_MS = 280;

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

const emptyResults: ResultsState = {
  movie: [],
  tv: [],
  person: [],
  keyword: [],
};

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(terms: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(terms.slice(0, MAX_RECENT)));
}

function getTitle(item: SearchResult) {
  return item.title ?? item.name ?? "Unknown";
}

function getHref(item: SearchResult, mediaType: SearchMediaType) {
  if (item.media_type === "person") return `/app/person/${item.id}`;
  if (item.media_type === "keyword") {
    return buildSearchUrl({ query: String(item.id), mediaType: "keyword", page: 1 });
  }
  return `/app/${item.media_type}/${item.id}`;
}

export default function SearchLandingPage() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [results, setResults] = useState<ResultsState>(emptyResults);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = draft.trim();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Record<string, ResultsState>>({});

  useEffect(() => {
    setRecent(getRecentSearches());
  }, []);

  // Live fetch on word change (same behavior as desktop SearchBar)
  useEffect(() => {
    if (!isValidSearchQuery(query)) {
      setResults(emptyResults);
      setError(null);
      setIsLoading(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    if (cacheRef.current[query]) {
      setResults(cacheRef.current[query]);
      setError(null);
      setIsLoading(false);
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
        const [generalRes, keywordRes] = await Promise.all([
          fetch(`/api/search?query=${encodeURIComponent(query)}`, {
            signal: controller.signal,
          }),
          fetch(
            `/api/search?query=${encodeURIComponent(query)}&media_type=keyword`,
            { signal: controller.signal }
          ),
        ]);

        if (!generalRes.ok || !keywordRes.ok) throw new Error("Search failed");

        const generalData = await generalRes.json();
        const keywordData = await keywordRes.json();

        const movie = (generalData.results ?? []).filter(
          (r: SearchResult) => r.media_type === "movie"
        );
        const tv = (generalData.results ?? []).filter(
          (r: SearchResult) => r.media_type === "tv"
        );
        const person = (generalData.results ?? []).filter(
          (r: SearchResult) => r.media_type === "person"
        );
        const keyword = (keywordData.results ?? []).map(
          (kw: { id: number; name: string }) => ({
            id: kw.id,
            media_type: "keyword" as const,
            name: kw.name,
          })
        );

        const raw = { movie, tv, person, keyword };
        const next = reRankAll(raw, query);
        cacheRef.current[query] = next;
        setResults(next);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Something went wrong. Try again.");
        setResults(emptyResults);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const submit = (term: string, mediaType: SearchMediaType = "multi") => {
    const trimmed = term.trim();
    if (!isValidSearchQuery(trimmed)) return;
    const next = [trimmed, ...recent.filter((t) => t !== trimmed)].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecentSearches(next);
    router.push(buildSearchUrl({ query: trimmed, mediaType, page: 1 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(draft);
  };

  const clearRecent = () => {
    setRecent([]);
    saveRecentSearches([]);
  };

  const hasResults =
    results.movie.length > 0 ||
    results.tv.length > 0 ||
    results.person.length > 0 ||
    results.keyword.length > 0;

  const didYouMean = useMemo(
    () => getDidYouMeanSuggestion(query, recent),
    [query, recent]
  );

  const showRecent = !query && recent.length > 0;
  const showResults = query && isValidSearchQuery(query);

  return (
    <div className="min-h-screen mx-auto w-full max-w-3xl px-4 py-10 text-white">
      <h1 className="text-2xl sm:text-3xl font-semibold text-center mb-2">
        Search
      </h1>
      <p className="text-neutral-400 text-center mb-8">
        Find movies, TV shows, people, and keywords
      </p>

      <form onSubmit={handleSubmit} className="relative mb-6">
        <FaSearch
          className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
          size={20}
          aria-hidden
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search movies, TV, people, or keywords..."
          className="w-full py-3 pl-12 pr-28 rounded-full bg-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500 text-base"
          autoFocus
          autoComplete="off"
          aria-label="Search"
          aria-describedby={showResults ? "live-results-desc" : undefined}
        />
        <button
          type="submit"
          disabled={!isValidSearchQuery(draft.trim())}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-neutral-600 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
        >
          Search
        </button>
      </form>

      {/* Live results (fetch on word change – same as desktop) */}
      {showResults && (
        <section
          id="live-results-desc"
          className="mb-8 rounded-2xl border border-neutral-700/80 bg-neutral-900/80 overflow-hidden"
          aria-live="polite"
          aria-busy={isLoading}
        >
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-3 text-neutral-400 text-sm">
              <span className="inline-block w-4 h-4 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" aria-hidden />
              Searching for &quot;{query}&quot;…
            </div>
          )}
          {error && (
            <p className="px-4 py-3 text-amber-400/90 text-sm">{error}</p>
          )}
          {!isLoading && !error && !hasResults && (
            <div className="px-4 py-4 text-neutral-400 text-sm space-y-2">
              <p>No results for &quot;{query}&quot;.</p>
              {didYouMean ? (
                <p>
                  Did you mean{" "}
                  <button
                    type="button"
                    onClick={() => submit(didYouMean)}
                    className="text-amber-400 hover:text-amber-300 underline font-medium"
                  >
                    {didYouMean}
                  </button>
                  ?
                </p>
              ) : (
                <p>
                  Try different words or{" "}
                  <button
                    type="button"
                    onClick={() => submit(query)}
                    className="text-amber-400 hover:text-amber-300 underline"
                  >
                    open full results
                  </button>
                  .
                </p>
              )}
            </div>
          )}
          {!isLoading && !error && hasResults && (
            <div className="divide-y divide-neutral-700/80">
              {didYouMean && (
                <p className="px-4 py-2 text-sm text-neutral-400">
                  Did you mean{" "}
                  <button
                    type="button"
                    onClick={() => submit(didYouMean)}
                    className="text-amber-400 hover:text-amber-300 underline"
                  >
                    {didYouMean}
                  </button>
                  ?
                </p>
              )}
              {[
                { key: "movie", label: "Movies", items: results.movie.slice(0, 4) },
                { key: "tv", label: "TV", items: results.tv.slice(0, 4) },
                { key: "person", label: "People", items: results.person.slice(0, 4) },
                { key: "keyword", label: "Keywords", items: results.keyword.slice(0, 4) },
              ].map(
                (section) =>
                  section.items.length > 0 && (
                    <div key={section.key} className="p-3">
                      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                        {section.label}
                      </h3>
                      <ul className="space-y-1">
                        {section.items.map((item) => {
                          const href = getHref(item, section.key as SearchMediaType);
                          const title = getTitle(item);
                          const img =
                            item.poster_path || item.profile_path
                              ? `https://image.tmdb.org/t/p/w92${item.poster_path || item.profile_path}`
                              : null;
                          return (
                            <li key={`${section.key}-${item.id}`}>
                              <Link
                                href={href}
                                className="flex items-center gap-3 rounded-xl p-2 text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors min-h-[44px] touch-manipulation"
                                onClick={() => {
                                  const next = [query, ...recent.filter((t) => t !== query)].slice(0, MAX_RECENT);
                                  setRecent(next);
                                  saveRecentSearches(next);
                                }}
                              >
                                {img ? (
                                  <img
                                    src={img}
                                    alt=""
                                    className="w-10 h-10 rounded-lg object-cover shrink-0 bg-neutral-800"
                                    width={40}
                                    height={40}
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-neutral-800 shrink-0" />
                                )}
                                <span className="text-sm font-medium truncate">{title}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                      <Link
                        href={buildSearchUrl({ query, mediaType: section.key as SearchMediaType, page: 1 })}
                        className="mt-2 block text-center text-xs text-amber-400 hover:text-amber-300"
                      >
                        See all {section.label}
                      </Link>
                    </div>
                  )
              )}
            </div>
          )}
        </section>
      )}

      {showRecent && (
        <section className="mb-8" aria-label="Recent searches">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
              Recent searches
            </h2>
            <button
              type="button"
              onClick={clearRecent}
              className="text-xs text-neutral-500 hover:text-neutral-300 min-h-[44px] touch-manipulation"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => submit(term)}
                className="rounded-full bg-neutral-800 px-4 py-2.5 text-sm text-neutral-200 hover:bg-neutral-700 min-h-[44px] touch-manipulation"
              >
                {term}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 pt-6 border-t border-neutral-700/50">
        <Link
          href={buildSearchUrl({
            query: "discover",
            mediaType: "movie",
            page: 1,
          })}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors min-h-[44px] touch-manipulation"
        >
          <FaFilter className="size-4" aria-hidden />
          Browse by filters (year, genre, where to watch)
        </Link>
      </section>

      <section className="text-neutral-500 text-sm mt-6">
        <p className="mb-2">Tip: type at least 2 characters; results update as you type.</p>
        <p>On full results: filter by type, year, language, genre, and where to watch.</p>
      </section>
    </div>
  );
}
