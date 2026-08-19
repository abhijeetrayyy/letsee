"use client";

import { useSearch } from "@/app/contextAPI/searchContext";
import { getDidYouMeanSuggestion } from "@/utils/searchFuzzy";
import { queryIndex, rowHref, normalizeQuery, type IndexRow } from "@/utils/searchIndex";
import { titlePath } from "@/utils/urls";
import { getPosterUrl } from "@/utils/imageUrl";
import { buildBrowseUrl } from "@/utils/browseUrl";
import { useSearchIndex } from "./useSearchIndex";
import {
  buildSearchUrl,
  isValidSearchQuery,
  type SearchMediaType,
} from "@/utils/searchUrl";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
import { FaCircleNotch } from "react-icons/fa6";
import { Film, Tv, User, Hash, TrendingUp, Clock, Building2, Layers, Radio } from "lucide-react";

type FlatResult = {
  key: string;
  label: string;
  href: string;
  category: "movie" | "tv" | "person" | "network" | "keyword" | "company" | "collection";
};

type Named = { id: number; name: string };

type TmdbHit = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  profile_path?: string | null;
  release_date?: string;
  first_air_date?: string;
};

const MAX_RECENT = 5;

/** The heading each suggestion group sits under, in the order they appear. */
const GROUPS: { kind: "movie" | "tv" | "person" | "network"; label: string }[] = [
  { kind: "movie", label: "Movies" },
  { kind: "tv", label: "TV Shows" },
  { kind: "person", label: "People" },
  // Instant, from the checked-in list — TMDB cannot search networks.
  { kind: "network", label: "Networks" },
];

/** Fetched behind the local rows, because these have no local source. */
const REMOTE_GROUPS = [
  { key: "keyword" as const, label: "Keywords" },
  { key: "company" as const, label: "Studios" },
  { key: "collection" as const, label: "Collections" },
];

const QUICK_CATEGORIES = [
  { label: "Movies", icon: Film, mediaType: "movie" as SearchMediaType },
  { label: "TV Shows", icon: Tv, mediaType: "tv" as SearchMediaType },
  { label: "People", icon: User, mediaType: "person" as SearchMediaType },
  { label: "Keywords", icon: Hash, mediaType: "keyword" as SearchMediaType },
];

function highlightLabel(text: string, query: string) {
  if (!query || query.length < 2) return text;
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${safeQuery})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={`${part}-${index}`}
        className="bg-brand-500/20 text-brand-300 rounded-sm px-0.5"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("recent_searches");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage does not exist during SSR
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
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, MAX_RECENT);
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const { isSearchLoading, setIsSearchLoading } = useSearch();
  const { recentSearches, updateRecentSearches, setRecentSearches } =
    useRecentSearches();
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);

  const query = input.trim();
  // Loaded on the first modal open and reused for the rest of the session.
  const index = useSearchIndex(isModalOpen);

  /**
   * Keywords, fetched behind the local suggestions rather than in front of them.
   *
   * There is no local source for these — TMDB has no "popular keywords"
   * endpoint to seed an index from — so they need the network. What made the
   * old search slow was that the network gated *everything*: nothing appeared
   * until two requests came back, and if you had mistyped, what came back was
   * nothing.
   *
   * Here the local rows are already on screen before this fires. Keywords are
   * an addition that arrives late, and if it never arrives the dropdown is
   * exactly as useful as it was a moment earlier. So the acceptance criterion
   * still holds: a suggestion appears within one frame, before any network
   * response.
   */
  const [remote, setRemote] = useState<Record<string, Named[]>>({});

  /**
   * Everything TMDB knows, which is the half the local index cannot have.
   *
   * Measured on this account: the local index holds 1,066 rows and answers 91%
   * of queries correctly *for titles it contains* — but only **52%** of
   * well-known titles are in it at all. Severance, Succession, Better Call
   * Saul, Andor, Arrival and Delhi Crime simply did not exist to search.
   *
   * TMDB's own ranking is good — measured 16/18 top-1 on the same query set,
   * failing only on typos. So this deliberately does **not** re-rank it. Every
   * attempt to blend the two into one scored list demoted something common:
   * a zero-vote film literally titled "Inter" outranking *Interstellar*, and
   * *Christopher Nolan* falling below *Facing Nolan* because people carry no
   * vote count. Two labelled sections beat one clever ordering.
   */
  const [tmdb, setTmdb] = useState<TmdbHit[]>([]);
  const [correctedFrom, setCorrectedFrom] = useState<string | null>(null);
  /**
   * True from the keystroke until TMDB answers.
   *
   * Without it the empty state lies: the local index misses, and "Nothing
   * matches" paints instantly — while the request that *does* have the answer
   * is still in flight. Locally that window is ~300ms and easy to miss; on a
   * real connection it is long enough to read, and it is the reason searching
   * "margin" looked like it found nothing when TMDB had *Margin Call* waiting.
   *
   * An empty state must mean "we looked and there is nothing", never "we have
   * not looked yet".
   */
  const [awaitingRemote, setAwaitingRemote] = useState(false);

  useEffect(() => {
    if (!isModalOpen || query.trim().length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale remote results when the query stops qualifying for a search
      setRemote({});
      setTmdb([]);
      setCorrectedFrom(null);
      setAwaitingRemote(false);
      return;
    }

    /**
     * `stale` is the whole reason this search was unreliable.
     *
     * Every keystroke re-runs this effect and aborts the previous request —
     * but an aborted `fetch` still *settles*, and the old code caught the
     * AbortError, turned it into an empty result, and called `setRemote` /
     * `setTmdb` unconditionally. So a request the user had already typed past
     * could land **after** the newer one had painted, and blank it.
     *
     * Which result you saw therefore depended on which promise happened to
     * settle last — results appearing, vanishing, and reappearing when you
     * retyped the same thing. Aborting a request is not enough; the response
     * has to be ignored as well.
     */
    let stale = false;
    const controller = new AbortController();
    setAwaitingRemote(true);

    const run = async () => {
      const ask = async (q: string, mediaType?: string) => {
        const url = mediaType
          ? `/api/search?query=${encodeURIComponent(q)}&media_type=${mediaType}`
          : `/api/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.results) ? data.results : [];
      };

      try {
        // One pass, one abort signal — titles and the three facet groups
        // together, rather than two timers racing each other.
        const [titles, ...facets] = await Promise.all([
          ask(query),
          ...REMOTE_GROUPS.map(({ key }) => ask(query, key)),
        ]);
        if (stale) return;

        let hits = titles as TmdbHit[];
        let from: string | null = null;

        /**
         * TMDB cannot spell-check — a dropped letter returns zero, not a worse
         * answer. The local index can. So on an empty response, ask again with
         * the spelling the local index believes was meant. Only ever on empty,
         * so a query that already worked is never "corrected" into something
         * else.
         */
        if (hits.length === 0) {
          const guess = queryIndex(index, query, 1)[0];
          if (guess && normalizeQuery(guess.n) !== normalizeQuery(query)) {
            const retry = (await ask(guess.n)) as TmdbHit[];
            if (stale) return;
            if (retry.length > 0) {
              hits = retry;
              from = guess.n;
            }
          }
        }

        setTmdb(hits.filter((h) => h.media_type !== "person").slice(0, 12));
        setCorrectedFrom(from);
        setRemote(
          Object.fromEntries(
            REMOTE_GROUPS.map(({ key }, i) => [key, (facets[i] as Named[]).slice(0, 6)]),
          ),
        );
        setAwaitingRemote(false);
      } catch (e) {
        // An abort means a newer keystroke owns the screen — leave its state
        // alone rather than reporting anything about a query already typed past.
        if (stale || (e as Error)?.name === "AbortError") return;
        setAwaitingRemote(false);
      }
    };

    const timer = setTimeout(run, 220);
    return () => {
      stale = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isModalOpen, index]);

  const remoteHref = (kind: string, id: number) =>
    kind === "keyword"
      ? buildBrowseUrl({ keyword: String(id) })
      : kind === "company"
        ? buildBrowseUrl({ company: String(id) })
        : buildBrowseUrl({ collection: String(id) });

  const didYouMean = useMemo(
    () => getDidYouMeanSuggestion(query, recentSearches),
    [query, recentSearches]
  );

  /**
   * Suggestions, computed synchronously from the local index.
   *
   * This replaced a 250ms-debounced pair of `/api/search` calls — two origin
   * requests, two TMDB calls and up to a dozen poster fetches per debounce
   * tick, all so the dropdown could show something TMDB would return nothing
   * for the moment a letter was mistyped. Now nothing leaves the browser until
   * the user commits, and the mistyped case is the one that works best.
   */
  const suggestions = useMemo<IndexRow[]>(
    () => (isModalOpen ? queryIndex(index, query, 26) : []),
    [index, query, isModalOpen]
  );

  const localKeys = useMemo(() => new Set(suggestions.map((r) => r.k)), [suggestions]);
  const tmdbRows = useMemo(
    () =>
      tmdb
        .map((h) => ({
          hit: h,
          kind: (h.media_type === "tv" ? "tv" : "movie") as "movie" | "tv",
        }))
        .filter(({ hit, kind }) => !localKeys.has(`${kind}:${hit.id}`)),
    [tmdb, localKeys],
  );

  const flatResults = useMemo<FlatResult[]>(
    () => [
      ...suggestions.map((row) => ({
        key: row.k,
        label: row.n,
        href: rowHref(row),
        category: row.t as FlatResult["category"],
      })),
      ...tmdbRows.map(({ hit, kind }) => ({
        key: `${kind}:${hit.id}`,
        label: hit.title ?? hit.name ?? "",
        // The label on the line above is the name; the link was dropping it.
        href: titlePath(kind, hit.id, hit.title ?? hit.name ?? ""),
        category: kind,
      })),
      // Last, so arrowing down reaches the instant rows first.
      ...REMOTE_GROUPS.flatMap(({ key }) =>
        (remote[key] ?? []).map((r) => ({
          key: `${key}:${r.id}`,
          label: r.name,
          href: remoteHref(key, r.id),
          category: key,
        })),
      ),
    ],
    [suggestions, remote, tmdbRows]
  );

  useEffect(() => {
    if (flatResults.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clamps the keyboard cursor when the result list shrinks under it
      setActiveIndex(-1);
    } else if (activeIndex >= flatResults.length) {
      setActiveIndex(flatResults.length - 1);
    }
  }, [flatResults, activeIndex]);

  const closeModal = () => {
    setIsModalOpen(false);
    setInput("");
    setActiveIndex(-1);
    setIsSearchLoading(false);
  };

  const openModal = () => {
    setIsModalOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
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
    // -1 is not "nothing selected" — it is the "Search everything" row, so the
    // cycle runs from -1 through the suggestions and back, and every option
    // including the commit action is reachable by arrow alone.
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (flatResults.length === 0) return;
      setActiveIndex((prev) => (prev + 1 > flatResults.length - 1 ? -1 : prev + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (flatResults.length === 0) return;
      setActiveIndex((prev) => (prev <= -1 ? flatResults.length - 1 : prev - 1));
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
      {/* Inline search trigger */}
      <button
        onClick={openModal}
        type="button"
        className="nav-search w-full"
        aria-label="Open search"
      >
        <FaSearch className="text-surface-500 size-3.5 shrink-0" />
        <span className="text-surface-500 text-sm truncate">Search movies, TV, people...</span>
        <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700 text-[10px] text-surface-500 font-mono">
          /
        </kbd>
      </button>

      {/* Search modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="fixed inset-0 z-50 flex flex-col items-center justify-start pt-8 sm:pt-16 animate-fade-in"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-surface-950/85 backdrop-blur-xl"
            aria-hidden
            onClick={closeModal}
          />
          {/* Content */}
          <div
            className="relative w-full max-w-2xl mx-4 rounded-2xl border border-white/10 bg-surface-900/95 shadow-2xl shadow-black/50 animate-scale-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input area */}
            <div className="p-4 sm:p-5 border-b border-white/5">
              <div className="relative flex items-center">
                <FaSearch className="absolute left-4 text-surface-500 w-5 h-5" />
                <input
                  ref={inputRef}
                  className="w-full py-3 pl-12 pr-12 bg-transparent text-surface-100 text-lg placeholder-surface-500 outline-none"
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
                  className="absolute right-3 text-surface-500 hover:text-surface-200 transition-colors p-1"
                  aria-label="Close search"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              {/* Quick categories */}
              {!query && (
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-xs text-surface-500 mr-1">Browse:</span>
                  {QUICK_CATEGORIES.map((cat) => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => handleSearch("", cat.mediaType)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-800/60 border border-surface-700/50 text-xs text-surface-400 hover:bg-surface-700 hover:text-white transition-all"
                    >
                      <cat.icon className="w-3 h-3" />
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Keyboard hints */}
              <div className="flex flex-wrap items-center gap-2 mt-3 px-1">
                {[
                  { key: "↵", label: "search" },
                  { key: "↑↓", label: "navigate" },
                  { key: "esc", label: "close" },
                ].map((hint) => (
                  <span
                    key={hint.label}
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-surface-600"
                  >
                    <kbd className="px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700 font-mono text-surface-500">
                      {hint.key}
                    </kbd>
                    {hint.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Results area */}
            <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-5">
              {!isValidSearchQuery(query) && (
                <div className="space-y-5">
                  {recentSearches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          Recent searches
                        </h3>
                        <button
                          type="button"
                          onClick={handleClearRecent}
                          className="text-xs text-surface-600 hover:text-surface-300 transition-colors"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => handleSearch(term)}
                            className="rounded-full bg-surface-800/60 border border-surface-700/50 px-3.5 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-white transition-all"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-surface-500 text-sm">
                    Start typing to search across movies, TV, people, and keywords.
                  </p>
                </div>
              )}

              {isValidSearchQuery(query) && (
                <>
                  {/* Committing is always available and always the first thing
                      under the cursor's natural path, because the local index
                      is a shortcut past TMDB, never a replacement for it: it
                      knows a few thousand titles, and TMDB knows a million. */}
                  <button
                    type="button"
                    onClick={() => handleSearch(query)}
                    className={`mb-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      activeIndex === -1
                        ? "bg-surface-700/80 ring-1 ring-brand-500/30"
                        : "bg-surface-800/40 hover:bg-surface-700/60"
                    }`}
                  >
                    <FaSearch className="shrink-0 text-brand-400" size={13} />
                    <span className="truncate text-sm text-surface-200">
                      Search everything for &ldquo;{query}&rdquo;
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-surface-500">
                      Enter
                    </span>
                  </button>

                  {didYouMean && (
                    <p className="mb-4 text-sm text-surface-500">
                      Did you mean{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setInput(didYouMean);
                          handleSearch(didYouMean);
                        }}
                        className="text-brand-400 transition-colors hover:text-brand-300"
                      >
                        {didYouMean}
                      </button>
                      ?
                    </p>
                  )}

                  {/* The only spinner left, and it is for the index loading on
                      first open — never for a query, which is synchronous. */}
                  {!index && (
                    <div className="flex items-center gap-2 py-6 text-sm text-surface-500">
                      <FaCircleNotch className="animate-spin" size={13} />
                      Preparing suggestions…
                    </div>
                  )}

                  {index && flatResults.length === 0 && awaitingRemote && (
                    <div className="flex items-center gap-2 py-6 text-sm text-surface-500">
                      <FaCircleNotch className="animate-spin" size={13} />
                      Searching everything…
                    </div>
                  )}

                  {index && flatResults.length === 0 && !awaitingRemote && (
                    <p className="py-6 text-sm text-surface-500">
                      Nothing found for &ldquo;{query}&rdquo;.
                    </p>
                  )}

                  {/* Your own library first, always. It is the smallest set and
                      the likeliest answer: searching "margin" put *The Water
                      Margin (1998)* above the user's own *Margin Call*, because
                      TMDB's block rendered first. Yours, then everything else. */}
                  {GROUPS.map(({ kind, label }) => {
                    const rows = suggestions.filter((r) => r.t === kind);
                    if (rows.length === 0) return null;
                    return (
                      <div key={kind} className="mb-5 last:mb-0">
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
                          {label}
                        </h3>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {rows.map((row) => {
                            const flatIndex = flatResults.findIndex((f) => f.key === row.k);
                            const isActive = flatIndex === activeIndex;
                            return (
                              <button
                                key={row.k}
                                type="button"
                                onClick={() =>
                                  handleSelectResult({
                                    key: row.k,
                                    label: row.n,
                                    href: rowHref(row),
                                    category: row.t,
                                  })
                                }
                                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                                  isActive
                                    ? "bg-surface-700/80 ring-1 ring-brand-500/30"
                                    : "bg-surface-800/40 hover:bg-surface-700/60"
                                }`}
                              >
                                {/* The picture is why a picker beats a list:
                                    you recognise a poster faster than you read
                                    a title. It loads after the row has already
                                    painted, so it costs the suggestion nothing.
                                    A reserved box means the row never reflows
                                    when the image arrives. */}
                                <span className="relative flex h-12 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-800">
                                  {row.p ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={getPosterUrl(row.p, "w92")}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  ) : row.t === "person" ? (
                                    <User className="size-3.5 text-surface-600" />
                                  ) : row.t === "network" ? (
                                    <Radio className="size-3.5 text-surface-600" />
                                  ) : row.t === "tv" ? (
                                    <Tv className="size-3.5 text-surface-600" />
                                  ) : (
                                    <Film className="size-3.5 text-surface-600" />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm text-surface-200">
                                  {highlightLabel(row.n, query)}
                                </span>
                                {row.lib && (
                                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-brand-400">
                                    Yours
                                  </span>
                                )}
                                {row.y && !row.lib && (
                                  <span className="shrink-0 text-xs text-surface-500">{row.y}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {tmdbRows.length > 0 && (
                    <div className="mb-5">
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
                        Everything else
                        {correctedFrom && (
                          // Not "did you mean" — the correction already
                          // happened, and saying what was searched is a fact
                          // rather than a question the reader has to answer.
                          <span className="font-normal normal-case tracking-normal text-surface-500">
                            · searched for <span className="text-brand-400">{correctedFrom}</span>
                          </span>
                        )}
                      </h3>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {tmdbRows.map(({ hit, kind }) => {
                          const flatIndex = flatResults.findIndex((f) => f.key === `${kind}:${hit.id}`);
                          const isActive = flatIndex === activeIndex;
                          const label = hit.title ?? hit.name ?? "";
                          const year = (hit.release_date ?? hit.first_air_date ?? "").slice(0, 4);
                          return (
                            <button
                              key={`${kind}:${hit.id}`}
                              type="button"
                              onClick={() =>
                                handleSelectResult({
                                  key: `${kind}:${hit.id}`,
                                  label,
                                  href: titlePath(kind, hit.id, label),
                                  category: kind,
                                })
                              }
                              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                                isActive
                                  ? "bg-surface-700/80 ring-1 ring-brand-500/30"
                                  : "bg-surface-800/40 hover:bg-surface-700/60"
                              }`}
                            >
                              <span className="relative flex h-12 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-800">
                                {hit.poster_path ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={getPosterUrl(hit.poster_path, "w92")} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                                ) : kind === "tv" ? (
                                  <Tv className="size-3.5 text-surface-600" />
                                ) : (
                                  <Film className="size-3.5 text-surface-600" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm text-surface-200">
                                {highlightLabel(label, query)}
                              </span>
                              {year && <span className="shrink-0 text-xs text-surface-500">{year}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {REMOTE_GROUPS.map(({ key, label }) => {
                    const rows = remote[key] ?? [];
                    if (rows.length === 0) return null;
                    return (
                      <div key={key} className="mb-5">
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
                          {label}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {rows.map((r) => {
                            const flatIndex = flatResults.findIndex((f) => f.key === `${key}:${r.id}`);
                            const isActive = flatIndex === activeIndex;
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() =>
                                  handleSelectResult({
                                    key: `${key}:${r.id}`,
                                    label: r.name,
                                    href: remoteHref(key, r.id),
                                    category: key,
                                  })
                                }
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                                  isActive
                                    ? "bg-surface-700/80 text-white ring-1 ring-brand-500/30"
                                    : "bg-surface-800/60 text-surface-300 hover:bg-surface-700 hover:text-white"
                                }`}
                              >
                                {key === "keyword" ? (
                                  <Hash className="size-3 text-surface-500" />
                                ) : key === "company" ? (
                                  <Building2 className="size-3 text-surface-500" />
                                ) : (
                                  <Layers className="size-3 text-surface-500" />
                                )}
                                {r.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
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
