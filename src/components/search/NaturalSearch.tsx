"use client";

import { useState, useRef } from "react";
import MediaCard from "@components/cards/MediaCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Search, Sparkles, X } from "lucide-react";

type SearchItem = {
  id: string;
  title: string;
  type: string;
  posterUrl: string | null;
  year: string;
  overview: string;
  voteAverage: number;
};

type FilterInfo = { label: string; value: string };

type SearchResult = {
  query: string;
  parsed: {
    mediaType: string;
    genres: number[];
    yearRange: string | null;
    hasActor: boolean;
    isSimilar: boolean;
  };
  filters: FilterInfo[];
  items: SearchItem[];
  total: number;
};

const EXAMPLES = [
  "thriller from 2010s",
  "action with Keanu Reeves",
  "sci-fi after 2020",
  "horror similar to The Conjuring",
  "romance before 2000",
];

export default function NaturalSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (q?: string) => {
    const searchQuery = q ?? query;
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/search/natural?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Search failed");
      }
      const data: SearchResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-surface-100 mb-1">Natural Language Search</h3>
        <p className="text-sm text-surface-500 mb-4">
          Search in plain English. Try: <span className="text-surface-300">"thriller from 2010s with Leonardo DiCaprio"</span>
        </p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder='e.g. "sci-fi after 2020 similar to Inception"'
              className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="px-5 py-3 bg-brand-500 text-surface-950 font-semibold rounded-xl hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 transition-all"
          >
            {loading ? (
              <LoadingSpinner size="sm" className="border-t-surface-950" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setQuery(ex);
                handleSearch(ex);
              }}
              className="px-3 py-1.5 text-xs bg-surface-800/60 hover:bg-surface-700 text-surface-400 hover:text-surface-200 rounded-full border border-surface-700/50 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800/40 bg-red-900/20 p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-surface-400">
                Found <span className="text-white font-semibold">{result.total}</span> results
              </span>
              {result.filters.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300"
                >
                  {f.label}: {f.value}
                  <button onClick={() => setResult(null)} className="hover:text-brand-200">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">
              {result.parsed.mediaType === "tv" ? "TV" : "Movie"}
            </span>
          </div>

          {result.items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {result.items.map((item) => (
                <div key={item.id} className="relative">
                  <MediaCard
                    id={Number(item.id)}
                    title={item.title}
                    mediaType={item.type as "movie" | "tv"}
                    imageUrl={item.posterUrl}
                    adult={false}
                    genres={[]}
                    showActions={true}
                    typeLabel={item.type}
                  />
                  {item.voteAverage > 0 && (
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-accent-gold">
                      {item.voteAverage.toFixed(1)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-8 text-center">
              <p className="text-surface-400 text-sm">No results found. Try a different search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
