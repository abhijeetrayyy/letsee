"use client";

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "@components/ui/AppLink";
import toast from "react-hot-toast";
import { Search, Undo2, ArrowRight } from "lucide-react";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";

type Candidate = {
  id: string;
  itemType: "movie" | "tv";
  name: string;
  posterPath: string | null;
  year: string | null;
  voteAverage: number;
  genres: string[];
};

/**
 * One tap marks a title seen, a second marks it a favourite, a third clears it.
 * The previous version had a mode switch at the top of the page and secondary
 * buttons that only appeared on hover — you had to remember which mode you were
 * in, and on a touch screen the other two actions were unreachable. Cycling on
 * the tile itself needs no memory and behaves the same on every input.
 */
type Mark = "seen" | "loved";

/**
 * A "run" is a bounded set worth working through in one sitting. Era is how
 * people actually recall their own watching, and finishing one ends somewhere,
 * which an endless popularity list never does.
 */
type Run = {
  id: string;
  label: string;
  caption: string;
  params: Record<string, string>;
};

const RUNS: Run[] = [
  { id: "now", label: "Right now", caption: "What everyone is watching this week", params: { source: "trending" } },
  { id: "2020s", label: "The 2020s", caption: "Released 2020 onward", params: { source: "popular", decade: "2020" } },
  { id: "2010s", label: "The 2010s", caption: "Released 2010–2019", params: { source: "popular", decade: "2010" } },
  { id: "2000s", label: "The 2000s", caption: "Released 2000–2009", params: { source: "popular", decade: "2000" } },
  { id: "1990s", label: "The 1990s", caption: "Released 1990–1999", params: { source: "popular", decade: "1990" } },
  { id: "hindi", label: "Hindi", caption: "Hindi-language cinema", params: { source: "popular", language: "hi" } },
  { id: "korean", label: "Korean", caption: "Korean-language cinema", params: { source: "popular", language: "ko" } },
  { id: "acclaimed", label: "Acclaimed", caption: "The highest rated of all time", params: { source: "top_rated" } },
];

const MILESTONES = [10, 25, 50, 100, 200];

export default function QuickAddClient({ initialType = "movie" }: { initialType?: "movie" | "tv" }) {
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const { refresh: refreshInteractions } = useMediaInteraction();

  const [type, setType] = useState<"movie" | "tv">(initialType);
  const [runId, setRunId] = useState("2010s");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [items, setItems] = useState<Candidate[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [picked, setPicked] = useState<Map<string, Mark>>(new Map());
  const [total, setTotal] = useState(0);

  const pickedRef = useRef<Map<string, Mark>>(new Map());
  const pendingRef = useRef<Map<string, { item: Candidate; mark: Mark | null }>>(new Map());
  const flushedRef = useRef<Set<string>>(new Set());
  const historyRef = useRef<{ item: Candidate; previous: Mark | undefined }[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestoneRef = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const run = RUNS.find((r) => r.id === runId) ?? RUNS[0];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const buildUrl = useCallback(
    (p: number) => {
      const params = new URLSearchParams({ type, page: String(p), ...run.params });
      if (debouncedQuery) {
        params.set("query", debouncedQuery);
        params.delete("decade");
        params.delete("language");
      }
      return `/api/quick-add/feed?${params.toString()}`;
    },
    [type, run, debouncedQuery],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setPage(1);
    fetch(buildUrl(1), { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setItems(d.items ?? []);
        setTotalPages(d.totalPages ?? 1);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setFailed(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [buildUrl, reloadKey]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(page + 1), { credentials: "include", cache: "no-store" });
      const d = await res.json();
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...(d.items ?? []).filter((i: Candidate) => !seen.has(i.id))];
      });
      setPage((p) => p + 1);
    } finally {
      setLoadingMore(false);
    }
  }, [buildUrl, page, totalPages, loadingMore]);

  /** Batched so a burst of taps costs one request, never blocking the grid. */
  const flush = useCallback(async () => {
    const batch = Array.from(pendingRef.current.values());
    if (batch.length === 0) return;
    pendingRef.current.clear();
    try {
      const res = await fetch("/api/quick-add/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entries: batch.map(({ item, mark }) => ({
            itemId: item.id,
            itemType: item.itemType,
            name: item.name,
            imgUrl: item.posterPath ? `https://image.tmdb.org/t/p/w342${item.posterPath}` : null,
            genres: item.genres,
            status: "watched",
            favorite: mark === "loved",
            remove: mark === null,
          })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      for (const { item, mark } of batch) {
        if (mark === null) flushedRef.current.delete(item.id);
        else flushedRef.current.add(item.id);
      }
    } catch {
      toast.error("Some marks didn't save. Check your connection.");
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 800);
  }, [flush]);

  useEffect(() => {
    const onLeave = () => { void flush(); };
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      void flush();
    };
  }, [flush]);

  const commit = useCallback(
    (item: Candidate, next: Mark | null, remember = true) => {
      const current = pickedRef.current;
      if (remember) historyRef.current.push({ item, previous: current.get(item.id) });

      const map = new Map(current);
      if (next === null) map.delete(item.id);
      else map.set(item.id, next);

      pickedRef.current = map;
      setPicked(map);
      setTotal(map.size);

      if (next === null && !flushedRef.current.has(item.id)) pendingRef.current.delete(item.id);
      else pendingRef.current.set(item.id, { item, mark: next });

      const hit = MILESTONES.find((m) => m === map.size);
      if (hit && hit > milestoneRef.current) {
        milestoneRef.current = hit;
        toast.success(`${hit} logged`, { id: "qa-milestone" });
      }
      scheduleFlush();
    },
    [scheduleFlush],
  );

  /** seen -> loved -> clear. */
  const cycle = useCallback(
    (item: Candidate) => {
      const now = pickedRef.current.get(item.id);
      commit(item, now === undefined ? "seen" : now === "seen" ? "loved" : null);
    },
    [commit],
  );

  const undo = useCallback(() => {
    const last = historyRef.current.pop();
    if (!last) return;
    commit(last.item, last.previous ?? null, false);
  }, [commit]);

  // Desktop path: sweep the grid without leaving the keyboard. Position comes
  // from whatever is actually focused rather than from state — tabbing into the
  // grid doesn't go through React, so tracked state starts out wrong and the
  // first arrow press would jump to the top-left instead of moving.
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const grid = gridRef.current;
    if (!grid) return;
    const cells = Array.from(grid.children);
    const here = cells.findIndex((c) => c.contains(document.activeElement));
    if (here < 0) return;

    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1;
    const max = cells.length - 1;
    let next = here;
    if (e.key === "ArrowRight") next = Math.min(max, here + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, here - 1);
    else if (e.key === "ArrowDown") next = Math.min(max, here + cols);
    else if (e.key === "ArrowUp") next = Math.max(0, here - cols);
    else return;

    e.preventDefault();
    (cells[next]?.querySelector("button") as HTMLElement | null)?.focus();
  };

  const finish = async () => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    await flush();
    await Promise.all([refreshPreferences(), refreshInteractions()]);
  };

  const runProgress = useMemo(
    () => items.filter((i) => picked.has(i.id)).length,
    [items, picked],
  );

  return (
    <div className="min-h-screen pb-24">
      {/* Header — states the job, then gets out of the way */}
      <header className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-8 pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
          Quick add
        </p>
        <h1 className="mt-1.5 text-2xl sm:text-[2rem] font-bold tracking-tight text-white">
          Your back catalogue
        </h1>
        <p className="mt-1.5 text-sm text-surface-400">
          Tap the ones you&apos;ve seen. Tap again if you loved it.
        </p>
      </header>

      {/* Runs — a bounded set to work through, not a filter form */}
      <div className="sticky top-14 z-30 border-y border-surface-800/70 bg-surface-950/95 backdrop-blur">
        {/* Stacked on small screens: sharing one row squeezed the runs down to
            two visible chips, which hid the main navigation of the page. */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 flex-1">
            {RUNS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { setRunId(r.id); setQuery(""); }}
                aria-pressed={r.id === runId && !debouncedQuery}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  r.id === runId && !debouncedQuery
                    ? "bg-surface-100 text-surface-950"
                    : "text-surface-400 hover:text-surface-100 hover:bg-surface-800/70"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-surface-800">
              {(["movie", "tv"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    type === t ? "bg-surface-800 text-white" : "text-surface-500 hover:text-surface-200"
                  }`}
                >
                  {t === "movie" ? "Films" : "TV"}
                </button>
              ))}
            </div>
            <div className="relative flex-1 sm:flex-none sm:w-56">
              <Search className="size-3.5 text-surface-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a title"
                aria-label="Search for a specific title"
                className="w-full bg-surface-900 text-sm text-surface-200 placeholder:text-surface-600 rounded-lg pl-8 pr-2.5 py-1.5 border border-surface-800 focus:border-surface-600 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-5">
        {/* Where you are in this run */}
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <p className="text-sm text-surface-400">
            {debouncedQuery ? (
              <>Results for <span className="text-surface-200">{debouncedQuery}</span></>
            ) : (
              run.caption
            )}
          </p>
          {runProgress > 0 && (
            <p className="shrink-0 text-sm tabular-nums text-surface-500">
              <span className="text-accent-gold font-semibold">{runProgress}</span> marked here
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-md bg-surface-900 animate-pulse" />
            ))}
          </div>
        ) : failed ? (
          <div className="py-24 text-center">
            <p className="text-surface-200 font-medium">Couldn&apos;t load titles</p>
            <p className="text-sm text-surface-500 mt-1">The film database didn&apos;t respond.</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-4 px-4 py-2 rounded-lg bg-surface-800 text-surface-200 text-sm font-medium hover:bg-surface-700"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-surface-200 font-medium">
              {debouncedQuery ? "Nothing found" : `Nothing left in ${run.label}`}
            </p>
            <p className="text-sm text-surface-500 mt-1">
              {debouncedQuery ? "Try a different spelling." : "You've logged all of these. Pick another run above."}
            </p>
          </div>
        ) : (
          <>
            <div
              ref={gridRef}
              role="grid"
              aria-label={`${run.label} — tap to mark as seen`}
              onKeyDown={onGridKeyDown}
              className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-1.5"
            >
              {items.map((item) => (
                <Tile
                  key={`${item.itemType}-${item.id}`}
                  item={item}
                  mark={picked.get(item.id)}
                  onActivate={() => cycle(item)}
                />
              ))}
            </div>

            {page < totalPages && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-5 py-2.5 rounded-lg bg-surface-900 text-surface-300 text-sm font-medium border border-surface-800 hover:bg-surface-800 hover:text-white disabled:opacity-60 transition-colors"
                >
                  {loadingMore ? "Loading…" : "More from this run"}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Always mounted, so landing the first mark doesn't shift the grid */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-800 bg-surface-950/95 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <p className="text-sm text-surface-300 tabular-nums">
            <span className="text-lg font-semibold text-white">{total}</span>
            <span className="text-surface-500"> logged this session</span>
          </p>

          <button
            type="button"
            onClick={undo}
            disabled={total === 0 && historyRef.current.length === 0}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-surface-400 hover:text-white hover:bg-surface-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 className="size-4" />
            <span className="hidden sm:inline">Undo</span>
          </button>

          <Link
            href="/app/profile"
            onClick={finish}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand-500 text-surface-950 text-sm font-semibold hover:bg-brand-400 transition-colors"
          >
            Done
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The mark is a grease-pencil ring, borrowed from the chinagraph editors used
 * to circle frames on a contact sheet. Across a dense grid a ring registers at
 * a glance where a corner badge does not, and it makes marking feel like an act
 * rather than ticking a form.
 */
function Tile({
  item,
  mark,
  onActivate,
}: {
  item: Candidate;
  mark: Mark | undefined;
  onActivate: () => void;
}) {
  const state = mark === "loved" ? "Loved" : mark === "seen" ? "Seen" : "Not marked";
  return (
    <div role="gridcell" className="group relative">
      <button
        type="button"
        onClick={onActivate}
        aria-label={`${item.name}${item.year ? `, ${item.year}` : ""}. ${state}. Activate to change.`}
        className="block w-full aspect-[2/3] rounded-md overflow-hidden bg-surface-900 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950"
      >
        <img
          src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
          alt=""
          loading="lazy"
          className={`w-full h-full object-cover transition-[filter,transform] duration-200 ${
            mark ? "saturate-[.35] brightness-[.55] scale-[1.02]" : "group-hover:brightness-110"
          }`}
        />

        {mark && (
          <svg
            viewBox="0 0 100 150"
            className="absolute inset-0 w-full h-full pointer-events-none text-accent-gold"
            aria-hidden
          >
            {/* Deliberately imperfect: drawn by hand, not stamped */}
            <ellipse
              cx="50" cy="75" rx="34" ry="48"
              fill={mark === "loved" ? "currentColor" : "none"}
              fillOpacity={mark === "loved" ? 0.16 : 0}
              stroke="currentColor"
              strokeWidth={mark === "loved" ? 5 : 3.5}
              strokeLinecap="round"
              strokeDasharray="300"
              transform="rotate(-4 50 75)"
              className="qa-ring"
            />
            {mark === "loved" && (
              <path
                d="M50 96c-9-7-16-12-16-19a8 8 0 0 1 16-4 8 8 0 0 1 16 4c0 7-7 12-16 19z"
                fill="currentColor"
              />
            )}
          </svg>
        )}

        {/* Title on demand — the poster is the recognition unit, but a quiet
            fallback matters for anything less than iconic */}
        <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-surface-950 via-surface-950/85 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <span className="block text-[10px] leading-tight text-surface-200 line-clamp-2 text-left">
            {item.name}
          </span>
        </span>
      </button>
    </div>
  );
}
