"use client";

import { buildBrowseUrl } from "@/utils/browseUrl";

import { useState, useRef, useEffect, useCallback } from "react";
import TitleCard from "@components/ds/TitleCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Search, Sparkles, X, Mic, MicOff, RefreshCw, Star, Filter, ChevronDown, Clock } from "lucide-react";

type SearchItem = {
  id: string;
  title: string;
  mediaType: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: string;
  releaseDate: string | null;
  overview: string;
  voteAverage: number;
  voteCount: number;
  genreIds: number[];
};

type ParsedInfo = {
  mediaType: string;
  genres: number[];
  yearRange: boolean;
  hasActor: boolean;
  hasDirector: boolean;
  isSimilar: boolean;
  minRating: number | null;
  language: string | null;
};

type SearchResult = {
  query: string;
  interpretation: string[];
  parsed: ParsedInfo;
  items: SearchItem[];
  total: number;
  matched: number;
};

const EXAMPLES = [
  { label: "thriller from 2010s", query: "thriller from 2010s" },
  { label: "action with Keanu Reeves", query: "action with Keanu Reeves" },
  { label: "sci-fi after 2020", query: "sci-fi after 2020" },
  { label: "horror like The Conjuring", query: "horror like The Conjuring" },
  { label: "romance before 2000", query: "romance before 2000" },
  { label: "French movies rated 7+", query: "french movie rated 7+" },
  { label: "directed by Nolan", query: "directed by Christopher Nolan" },
  { label: "top rated comedy", query: "comedy highly-rated" },
];

const RECENT_KEY = "ns_recent_searches";
const MAX_RECENT = 6;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecent(q: string) {
  try {
    const prev = loadRecent().filter((s) => s !== q);
    const next = [q, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

function InterpretationPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-action/10 border border-accent-strong/20 text-xs text-accent-soft whitespace-nowrap">
      <Sparkles className="w-3 h-3" />
      {label}
    </span>
  );
}

function languageName(code: string | null): string | null {
  if (!code) return null;
  const names: Record<string, string> = {
    fr: "French", es: "Spanish", de: "German", it: "Italian",
    ko: "Korean", ja: "Japanese", hi: "Hindi", zh: "Chinese",
    ru: "Russian", pt: "Portuguese",
  };
  return names[code] ?? code;
}

export default function NaturalSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const recent = loadRecent();

  const handleSearch = useCallback(async (q?: string) => {
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
      saveRecent(searchQuery);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Voice search
  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      if (event.results[0].isFinal) {
        setListening(false);
        handleSearch(transcript);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    setListening(true);
    recognition.start();
  }, [listening, handleSearch]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  // Click outside to close recent
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-recent-dropdown]")) setShowRecent(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const interpretation = result ? (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {result.interpretation.map((part, i) => (
        <InterpretationPill key={i} label={part} />
      ))}
    </div>
  ) : null;

  return (
    <div className="space-y-5">
      {/* Search input */}
      <div>
        <div className="flex gap-2">
          <div className="relative flex-1" data-recent-dropdown>
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              onFocus={() => setShowRecent(true)}
              placeholder='Try: "sci-fi after 2020 similar to Inception"'
              className="w-full bg-overlay border border-line-strong rounded-xl pl-10 pr-12 py-3 text-sm text-ink-0 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-focus/40 focus:border-accent-strong/50"
            />
            {/* Voice button */}
            <button
              onClick={toggleVoice}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-200 transition-colors"
              title={listening ? "Stop listening" : "Search by voice"}
            >
              {listening ? <MicOff className="w-4 h-4 text-danger animate-pulse" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Recent searches dropdown */}
            {showRecent && recent.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-overlay border border-line-strong rounded-xl shadow-xl overflow-hidden">
                <div className="px-3 py-2 text-xs text-ink-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Recent
                </div>
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setQuery(r); setShowRecent(false); handleSearch(r); }}
                    className="w-full text-left px-3 py-2 text-sm text-ink-300 hover:bg-hover hover:text-ink-0 transition-colors truncate"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="px-5 py-3 bg-action text-on-action font-semibold rounded-xl hover:bg-action-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 transition-all"
          >
            {loading ? (
              <LoadingSpinner size="sm" className="border-t-page" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>

        {/* Example chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.query}
              onClick={() => { setQuery(ex.query); handleSearch(ex.query); }}
              className="px-2.5 py-1 text-xs bg-overlay/60 hover:bg-hover text-ink-400 hover:text-ink-200 rounded-full border border-line-strong/50 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/20 p-4">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="aspect-2/3 bg-overlay rounded-xl" />
              <div className="h-3 bg-overlay rounded w-3/4" />
              <div className="h-2 bg-overlay rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Interpretation bar */}
          {interpretation}

          {/* Meta row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-400">
              <span>
                <span className="text-ink-0 font-semibold">{result.total.toLocaleString()}</span> results
                {result.matched > 0 && result.matched < result.total && (
                  <span className="text-ink-500"> — showing top {result.matched}</span>
                )}
              </span>
              {result.parsed.minRating && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-0/10 border border-ink-0/20 text-xs text-ink-300">
                  <Star className="w-3 h-3 fill-ink-0" /> {result.parsed.minRating}+
                </span>
              )}
              {result.parsed.language && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-0/10 border border-ink-0/20 text-xs text-ink-300">
                  {languageName(result.parsed.language)}
                </span>
              )}
              <span className="text-xs text-ink-500 uppercase tracking-wider bg-overlay px-2 py-0.5 rounded-full">
                {result.parsed.mediaType === "tv" ? "TV" : "Movie"}
              </span>
            </div>

            <div className="flex gap-1">
              {result.parsed.genres.length > 0 && (
                <button
                  onClick={() => {
                    // Was pointing at /app/discover, which has never existed —
                    // so "Refine" 404'd. Browse is the real destination, and it
                    // can carry the media type and language this already knew
                    // about and the old link threw away.
                    const year = result.parsed.yearRange ? query.match(/\d{4}/)?.[0] : undefined;
                    window.location.href = buildBrowseUrl({
                      type: result.parsed.mediaType === "tv" ? "tv" : "movie",
                      genre: result.parsed.genres.length > 0 ? String(result.parsed.genres[0]) : undefined,
                      lang: result.parsed.language ?? undefined,
                      // Browse filters by decade, so a single year floors to one.
                      decade: year ? String(Math.floor(Number(year) / 10) * 10) : undefined,
                    });
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-ink-400 hover:text-ink-200 bg-overlay hover:bg-hover rounded-lg transition-colors"
                >
                  <Filter className="w-3 h-3" /> Refine
                </button>
              )}
              <button
                onClick={() => handleSearch()}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-ink-400 hover:text-ink-200 bg-overlay hover:bg-hover rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Shuffle
              </button>
            </div>
          </div>

          {/* Item grid */}
          {result.items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {result.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="relative animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDuration: "400ms", animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}
                >
                  <TitleCard
                    id={Number(item.id)}
                    title={item.title}
                    mediaType={item.mediaType as "movie" | "tv"}
                    imageUrl={item.posterUrl}
                    adult={false}
                    genres={[]}
                    showActions={true}
                    typeLabel={item.mediaType}
                    releaseDate={item.releaseDate}
                    year={item.year || null}
                    overview={item.overview}
                    voteCount={item.voteCount}
                  />
                  {item.voteAverage > 0 && (
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold flex items-center gap-1 text-ink-300">
                      <Star className="w-3 h-3 fill-ink-0" />
                      {item.voteAverage.toFixed(1)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line-strong/60 bg-raised/40 p-8 text-center">
              <p className="text-ink-400 text-sm">No results found. Try a different search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
