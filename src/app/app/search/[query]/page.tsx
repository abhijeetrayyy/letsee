"use client";

import { useSearch } from "@/app/contextAPI/searchContext";
import SendMessageModal from "@components/message/sendCard";
import MediaCard from "@components/cards/MediaCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  buildSearchUrl,
  isValidSearchQuery,
  parseSearchParams,
  parseSearchQuery,
  SEARCH_MEDIA_TYPES,
  type SearchMediaType,
} from "@/utils/searchUrl";
import { GenreList } from "@/staticData/genreList";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";

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

function buildPageItems(current: number, total: number): Array<number | "..."> {
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
    if (index > 0 && page - (prev ?? 0) > 1) items.push("...");
    items.push(page);
  });
  return items;
}

export default function SearchResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const pathQuery = Array.isArray(params?.query) ? params?.query[0] : params?.query;
  const {
    query: decodedQuery,
    mediaType,
    page,
    adult,
    year,
    language,
    genre,
    keyword,
    watchRegion,
    watchProviders,
  } = useMemo(
    () => parseSearchParams(pathQuery, searchParams),
    [pathQuery, searchParams]
  );

  const [results, setResults] = useState<SearchResponse>({
    results: [],
    total_pages: 0,
    total_results: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [draftQuery, setDraftQuery] = useState(decodedQuery);
  const [pageInput, setPageInput] = useState(String(page));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<SearchResult | null>(null);
  const [watchProvidersList, setWatchProvidersList] = useState<{ id: number; name: string }[]>([]);
  const { setIsSearchLoading } = useSearch();

  const showMediaFilters = mediaType === "movie" || mediaType === "tv" || mediaType === "multi";

  useEffect(() => {
    if (!showMediaFilters) return;
    let cancelled = false;
    const providerMediaType = mediaType === "multi" ? "movie" : mediaType;
    fetch(`/api/watch-providers/list?region=${watchRegion || "US"}&mediaType=${providerMediaType}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.providers) setWatchProvidersList(data.providers);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showMediaFilters, watchRegion, mediaType]);

  const isKeywordSearch = mediaType === "keyword";
  const isKeywordList = useMemo(
    () =>
      isKeywordSearch &&
      results.results.length > 0 &&
      results.results.every((r) => r.media_type === "keyword"),
    [isKeywordSearch, results.results]
  );
  const pageItems = useMemo(
    () => buildPageItems(page, results.total_pages),
    [page, results.total_pages]
  );

  useEffect(() => {
    setDraftQuery(decodedQuery);
  }, [decodedQuery]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const hasDiscoverFilters = Boolean(year || genre || keyword || watchProviders);
  const canShowResults =
    isValidSearchQuery(decodedQuery) ||
    (hasDiscoverFilters && (mediaType === "movie" || mediaType === "tv" || mediaType === "multi"));

  // Redirect to search landing when query is missing or too short and no discover filters
  useEffect(() => {
    const raw = pathQuery ?? "";
    const trimmed = parseSearchQuery(raw);
    if (!trimmed || (!isValidSearchQuery(trimmed) && !hasDiscoverFilters)) {
      router.replace("/app/search");
      return;
    }
  }, [pathQuery, hasDiscoverFilters, router]);

  // Fetch: URL is source of truth; when URL changes we refetch
  useEffect(() => {
    if (!canShowResults) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const queryForApi = decodedQuery === "discover" ? "" : decodedQuery;

    (async () => {
      try {
        setIsSearchLoading(true);
        const res = await fetch("/api/searchPage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: queryForApi,
            media_type: mediaType,
            page,
            include_adult: adult,
            language: language || undefined,
            year: year || undefined,
            genre: genre || undefined,
            keyword: keyword || undefined,
            watch_region: watchRegion || undefined,
            watch_providers: watchProviders || undefined,
          }),
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          let msg = `Search failed (${res.status})`;
          try {
            const payload = await res.json();
            if (payload?.error) msg = payload.error;
            if (payload?.upstream_message) msg += ` — ${payload.upstream_message}`;
          } catch {
            // ignore
          }
          throw new Error(msg);
        }

        const data: SearchResponse = await res.json();
        setResults(data);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Something went wrong");
        setResults({ results: [], total_pages: 0, total_results: 0 });
      } finally {
        setLoading(false);
        setIsSearchLoading(false);
      }
    })();

    return () => controller.abort();
  }, [decodedQuery, mediaType, page, adult, year, language, genre, keyword, watchRegion, watchProviders, canShowResults, refreshKey, setIsSearchLoading]);

  type NavUpdates = Partial<{
    query: string;
    mediaType: SearchMediaType;
    page: number;
    adult: boolean;
    year: string;
    language: string;
    genre: string;
    keyword: string;
    watchRegion: string;
    watchProviders: string;
  }>;

  const navigate = (updates: NavUpdates) => {
    router.push(
      buildSearchUrl({
        query: updates.query ?? decodedQuery,
        mediaType: updates.mediaType ?? mediaType,
        page: updates.page ?? page,
        adult: updates.adult ?? adult,
        year: updates.year !== undefined ? updates.year : year,
        language: updates.language !== undefined ? updates.language : language,
        genre: updates.genre !== undefined ? updates.genre : genre,
        keyword: updates.keyword !== undefined ? updates.keyword : keyword,
        watchRegion: updates.watchRegion !== undefined ? updates.watchRegion : watchRegion,
        watchProviders: updates.watchProviders !== undefined ? updates.watchProviders : watchProviders,
      })
    );
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = draftQuery.trim();
    if (!isValidSearchQuery(next)) return;
    navigate({ query: next, page: 1 });
  };

  const handleFilterChange = (type: SearchMediaType) => {
    navigate({ mediaType: type, page: 1 });
  };

  const handleAdultToggle = () => {
    navigate({ adult: !adult, page: 1 });
  };

  const handleKeywordSelect = (keywordId: number) => {
    navigate({ query: String(keywordId), mediaType: "keyword", page: 1 });
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > results.total_pages) return;
    navigate({ page: nextPage });
  };

  const handlePageInputSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = Number(pageInput);
    if (Number.isFinite(next)) handlePageChange(next);
  };

  const handleRetry = () => setRefreshKey((k) => k + 1);
  const handleCardTransfer = (data: SearchResult) => {
    setCardData(data);
    setIsModalOpen(true);
  };

  const typeLabel = (t: string) => (t === "multi" ? "All" : t === "tv" ? "TV Shows" : t);

  if (!canShowResults) {
    return null;
  }

  return (
    <div className="min-h-screen mx-auto w-full max-w-7xl px-4 py-6 text-white">
      {/* Search form and filters — always visible */}
      <div className="flex flex-col gap-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            className="flex-1 rounded-full bg-neutral-800 px-4 py-3 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
            type="text"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder="Search movies, TV, people, or keywords..."
            aria-label="Search"
          />
          <button
            type="submit"
            className="rounded-full bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-500 font-medium"
          >
            Search
          </button>
        </form>
        <div className="flex flex-wrap gap-2 items-center">
          {SEARCH_MEDIA_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleFilterChange(type)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${
                mediaType === type
                  ? "bg-neutral-200 text-neutral-900"
                  : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              }`}
            >
              {typeLabel(type)}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAdultToggle}
            aria-pressed={adult}
            className={`rounded-full px-4 py-1.5 text-sm ${
              adult ? "bg-amber-500 text-neutral-900" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            }`}
          >
            {adult ? "Adult: On" : "Adult: Off"}
          </button>
        </div>

        {/* Year, language, genre, where to watch — only for movie/tv */}
        {showMediaFilters && (
          <div className="flex flex-wrap gap-3 items-end pt-2 border-t border-neutral-700/50">
            <div>
              <label htmlFor="filter-year" className="block text-xs font-medium text-neutral-500 mb-1">
                Year
              </label>
              <input
                id="filter-year"
                type="number"
                min={1900}
                max={2030}
                placeholder="Any"
                value={year}
                onChange={(e) => navigate({ year: e.target.value.trim(), page: 1 })}
                className="w-24 rounded-lg bg-neutral-800 border border-neutral-600 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="filter-lang" className="block text-xs font-medium text-neutral-500 mb-1">
                Language
              </label>
              <select
                id="filter-lang"
                value={language || ""}
                onChange={(e) => navigate({ language: e.target.value, page: 1 })}
                className="rounded-lg bg-neutral-800 border border-neutral-600 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Any</option>
                <option value="en-US">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="pt-BR">Portuguese (BR)</option>
              </select>
            </div>
            <div>
              <label htmlFor="filter-genre" className="block text-xs font-medium text-neutral-500 mb-1">
                Genre
              </label>
              <select
                id="filter-genre"
                value={genre || ""}
                onChange={(e) => navigate({ genre: e.target.value, page: 1 })}
                className="min-w-[140px] rounded-lg bg-neutral-800 border border-neutral-600 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Any</option>
                {GenreList.genres.map((g: { id: number; name: string }) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-watch" className="block text-xs font-medium text-neutral-500 mb-1">
                Where to watch
              </label>
              <select
                id="filter-watch"
                value={watchProviders || ""}
                onChange={(e) => navigate({ watchProviders: e.target.value, page: 1 })}
                className="min-w-[160px] rounded-lg bg-neutral-800 border border-neutral-600 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Any</option>
                {watchProvidersList.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {(year || language || genre || keyword || watchProviders) && (
              <button
                type="button"
                onClick={() =>
                  navigate({
                    year: "",
                    language: "",
                    genre: "",
                    keyword: "",
                    watchProviders: "",
                    page: 1,
                  })
                }
                className="rounded-lg px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        <p className="text-sm text-neutral-400 mt-2">
          Results for &quot;{decodedQuery || "filters"}&quot; · {typeLabel(mediaType)} · {adult ? "Adult on" : "Safe search"}
        </p>
      </div>

      {mediaType !== "person" && cardData && (
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

      {/* Loading: show spinner, hide results */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-4 py-16" aria-busy="true">
          <LoadingSpinner size="lg" className="border-t-white" />
          <p className="text-neutral-400">Searching…</p>
        </div>
      )}

      {/* Content only when not loading */}
      {!loading && (
        <>
          {results.total_results > 0 && (
            <p className="mb-4 text-neutral-400">
              {results.total_results} {results.total_results === 1 ? "result" : "results"}
            </p>
          )}

          {/* No results */}
          {results.total_results === 0 && (
            <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
              <p className="text-lg text-neutral-300">
                No results for &quot;<span className="text-pink-400">{decodedQuery}</span>&quot;
              </p>
              <p className="text-sm text-neutral-500">Try a different term or filters.</p>
              <Link
                href="/app/search"
                className="rounded-full bg-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-600"
              >
                New search
              </Link>
              <img src="/no-photo.webp" alt="" className="max-w-xs opacity-60 rounded-lg" aria-hidden />
            </div>
          )}

          {/* Keyword list */}
          {results.total_results > 0 && isKeywordList && (
            <div className="rounded-lg bg-neutral-800 p-4 mb-6">
              <p className="mb-3 text-sm text-neutral-300">Choose a keyword to see related movies.</p>
              <div className="flex flex-wrap gap-2">
                {results.results.map((kw) => (
                  <button
                    key={kw.id}
                    type="button"
                    onClick={() => handleKeywordSelect(kw.id)}
                    className="rounded-full bg-neutral-700 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-600"
                  >
                    {kw.name || "Keyword"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result grid */}
          {results.total_results > 0 && !isKeywordList && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {results.results.map((data) => {
                const displayType =
                  mediaType === "keyword" ? "movie" : mediaType === "multi" ? data.media_type : mediaType;
                if (displayType === "person") {
                  return (
                    <MediaCard
                      key={`person-${data.id}`}
                      id={data.id}
                      title={data.name || "Unknown"}
                      mediaType="person"
                      posterPath={data.profile_path}
                      showActions={false}
                      typeLabel="person"
                      knownFor={data.known_for_department}
                    />
                  );
                }
                if (displayType === "movie" || displayType === "tv") {
                  const dateStr = data.release_date || data.first_air_date;
                  const year = dateStr
                    ? String(new Date(dateStr).getFullYear())
                    : null;
                  const genres: string[] =
                    data.genre_ids
                      ?.map((id) => GenreList.genres.find((g: { id: number }) => g.id === id)?.name)
                      .filter((n): n is string => Boolean(n)) ?? [];
                  return (
                    <MediaCard
                      key={`${displayType}-${data.id}`}
                      id={data.id}
                      title={data.title || data.name || "Unknown"}
                      mediaType={displayType}
                      posterPath={data.poster_path || data.backdrop_path}
                      adult={data.adult}
                      genres={genres}
                      showActions
                      onShare={(e) => {
                        e.preventDefault();
                        handleCardTransfer(data);
                      }}
                      typeLabel={displayType}
                      year={year}
                    />
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Pagination */}
          {results.total_pages > 1 && (
            <div className="flex flex-col items-center gap-3 my-8">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="rounded-md bg-neutral-700 px-3 py-2 text-sm hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {pageItems.map((item, i) =>
                  item === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-neutral-500">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handlePageChange(item)}
                      className={`rounded-md px-3 py-2 text-sm ${
                        item === page ? "bg-neutral-200 text-neutral-900" : "bg-neutral-700 hover:bg-neutral-600"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= results.total_pages}
                  className="rounded-md bg-neutral-700 px-3 py-2 text-sm hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <p className="text-sm text-neutral-500">
                Page {page} of {results.total_pages}
              </p>
              <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
                <label htmlFor="search-page-input" className="sr-only">
                  Go to page
                </label>
                <input
                  id="search-page-input"
                  type="number"
                  min={1}
                  max={results.total_pages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  className="w-20 rounded-md bg-neutral-800 px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                />
                <button type="submit" className="rounded-md bg-neutral-700 px-3 py-2 text-sm hover:bg-neutral-600">
                  Go
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
