"use client";

import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Check, Heart, Clock, Search, Loader2, Sparkles } from "lucide-react";
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

/** What a single tap does. Watched is the default because it's the common case. */
type Mark = "watched" | "watchlist" | "favorite";

const MARKS: { key: Mark; label: string; icon: React.ReactNode; ring: string; chip: string }[] = [
  { key: "watched", label: "Seen it", icon: <Check className="size-4" />, ring: "ring-brand-400", chip: "bg-brand-500 text-surface-950" },
  { key: "watchlist", label: "Want to see", icon: <Clock className="size-4" />, ring: "ring-sky-400", chip: "bg-sky-500 text-surface-950" },
  { key: "favorite", label: "Love it", icon: <Heart className="size-4" />, ring: "ring-rose-400", chip: "bg-rose-500 text-white" },
];

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970];
const MILESTONES = [5, 10, 25, 50, 100];

export default function QuickAddClient({ initialType = "movie" }: { initialType?: "movie" | "tv" }) {
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const { refresh: refreshInteractions } = useMediaInteraction();

  const [type, setType] = useState<"movie" | "tv">(initialType);
  const [source, setSource] = useState("popular");
  const [decade, setDecade] = useState<string>("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mark, setMark] = useState<Mark>("watched");
  const [reloadKey, setReloadKey] = useState(0);

  const [items, setItems] = useState<Candidate[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  /** id -> what the user marked it as, this session. */
  const [picked, setPicked] = useState<Map<string, Mark>>(new Map());
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const pendingRef = useRef<Map<string, { item: Candidate; mark: Mark; remove?: boolean }>>(new Map());
  /** Ids already written by an earlier batch, so un-picking can undo them. */
  const flushedRef = useRef<Set<string>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestoneRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const buildUrl = useCallback(
    (p: number) => {
      const params = new URLSearchParams({ type, source, page: String(p) });
      if (decade) params.set("decade", decade);
      if (debouncedQuery) params.set("query", debouncedQuery);
      return `/api/quick-add/feed?${params.toString()}`;
    },
    [type, source, decade, debouncedQuery],
  );

  // Reload whenever the filters change.
  const [failed, setFailed] = useState(false);

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
        // Distinct from an empty result — telling someone they've logged
        // everything because TMDB blipped would be nonsense.
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

  /**
   * Writes are batched and flushed on a short timer, so a burst of taps costs
   * one request. Marks are optimistic — the grid never waits on the network.
   */
  const flush = useCallback(async () => {
    const batch = Array.from(pendingRef.current.values());
    if (batch.length === 0) return;
    pendingRef.current.clear();
    setSaving(true);
    try {
      const res = await fetch("/api/quick-add/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entries: batch.map(({ item, mark: m, remove }) => ({
            itemId: item.id,
            itemType: item.itemType,
            name: item.name,
            imgUrl: item.posterPath ? `https://image.tmdb.org/t/p/w342${item.posterPath}` : null,
            genres: item.genres,
            // "Love it" also counts as seen — you can't love what you haven't watched.
            status: m === "favorite" ? "watched" : m,
            favorite: m === "favorite",
            remove,
          })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      for (const { item, remove } of batch) {
        if (remove) flushedRef.current.delete(item.id);
        else flushedRef.current.add(item.id);
      }
    } catch {
      toast.error("Some picks didn't save. Check your connection.");
    } finally {
      setSaving(false);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 900);
  }, [flush]);

  // Don't lose a batch that's still queued when the user leaves.
  useEffect(() => {
    const onLeave = () => { void flush(); };
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      void flush();
    };
  }, [flush]);

  // Mirrors `picked` so pick() can read the current selection without a stale
  // closure. The state updater itself must stay pure — React invokes it twice
  // in development, which double-counted every tap when the tally lived inside.
  const pickedRef = useRef<Map<string, Mark>>(new Map());

  const pick = useCallback(
    (item: Candidate, m: Mark) => {
      const current = pickedRef.current;
      const unpicking = current.get(item.id) === m;
      const next = new Map(current);

      if (unpicking) {
        next.delete(item.id);
        pendingRef.current.delete(item.id);
        // Already saved? Queue an explicit undo rather than just forgetting it.
        if (flushedRef.current.has(item.id)) {
          pendingRef.current.set(item.id, { item, mark: m, remove: true });
        }
      } else {
        next.set(item.id, m);
        pendingRef.current.set(item.id, { item, mark: m });
      }

      const isNew = !current.has(item.id);
      pickedRef.current = next;
      setPicked(next);

      const total = next.size;
      setSavedCount(total);

      if (isNew) {
        const hit = MILESTONES.find((x) => x === total);
        if (hit && hit > milestoneRef.current) {
          milestoneRef.current = hit;
          toast.success(`${hit} titles logged 🎉`, { id: "quick-add-milestone" });
        }
      }

      scheduleFlush();
    },
    [scheduleFlush],
  );

  const finish = async () => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    await flush();
    await Promise.all([refreshPreferences(), refreshInteractions()]);
    toast.success(`Added ${savedCount} title${savedCount === 1 ? "" : "s"} to your profile`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-32">
      <header className="pt-8 pb-5">
        <div className="flex items-center gap-2 text-brand-400 mb-2">
          <Sparkles className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Quick add</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          Build your profile in a couple of minutes
        </h1>
        <p className="mt-1.5 text-sm text-surface-400">
          Tap everything you recognise. Nothing here is anything you&apos;ve already logged.
        </p>
      </header>

      {/* What a tap does */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {MARKS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMark(m.key)}
            aria-pressed={mark === m.key}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
              mark === m.key
                ? `${m.chip} border-transparent`
                : "bg-surface-800/60 text-surface-300 border-surface-700/50 hover:text-white"
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
        <span className="text-xs text-surface-500 ml-1">← a tap marks it as this</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="inline-flex rounded-lg overflow-hidden border border-surface-700/50">
          {(["movie", "tv"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                type === t ? "bg-surface-700 text-white" : "bg-surface-900 text-surface-400 hover:text-surface-200"
              }`}
            >
              {t === "movie" ? "Movies" : "TV"}
            </button>
          ))}
        </div>

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-200"
        >
          <option value="popular">Popular</option>
          <option value="top_rated">Top rated</option>
          <option value="trending">Trending now</option>
        </select>

        <select
          value={decade}
          onChange={(e) => setDecade(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-200"
        >
          <option value="">Any decade</option>
          {DECADES.map((d) => (
            <option key={d} value={d}>{d}s</option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[12rem]">
          <Search className="size-3.5 text-surface-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Or search for something specific…"
            className="w-full bg-surface-800 text-sm text-surface-200 placeholder:text-surface-500 rounded-lg pl-9 pr-3 py-2 border border-surface-700 focus:border-brand-500 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-surface-800/60 animate-pulse" />
          ))}
        </div>
      ) : failed ? (
        <div className="py-20 text-center">
          <p className="text-surface-300 font-medium">Couldn&apos;t load titles</p>
          <p className="text-sm text-surface-500 mt-1">The film database didn&apos;t respond.</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-4 px-4 py-2 rounded-xl bg-surface-800 text-surface-200 text-sm font-medium border border-surface-700/50 hover:bg-surface-700"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-surface-300 font-medium">Nothing left here</p>
          <p className="text-sm text-surface-500 mt-1">
            You&apos;ve logged everything in this filter. Try another decade or switch to TV.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {items.map((item) => {
            const chosen = picked.get(item.id);
            const meta = chosen ? MARKS.find((m) => m.key === chosen)! : null;
            return (
              <div key={`${item.itemType}-${item.id}`} className="group relative">
                <button
                  type="button"
                  onClick={() => pick(item, mark)}
                  aria-pressed={!!chosen}
                  title={`${item.name}${item.year ? ` (${item.year})` : ""}`}
                  className={`block w-full aspect-[2/3] rounded-xl overflow-hidden bg-surface-800 ring-2 transition-all ${
                    chosen ? `${meta!.ring} scale-[0.96]` : "ring-transparent hover:ring-surface-600"
                  }`}
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
                    alt={item.name}
                    loading="lazy"
                    className={`w-full h-full object-cover transition-opacity ${chosen ? "opacity-55" : "opacity-100"}`}
                  />
                  {meta && (
                    <span className={`absolute top-1.5 right-1.5 size-6 rounded-full grid place-items-center ${meta.chip}`}>
                      {meta.icon}
                    </span>
                  )}
                </button>

                {/* The other two marks, without switching the global mode */}
                <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {MARKS.filter((m) => m.key !== mark).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => pick(item, m.key)}
                      title={m.label}
                      aria-label={`${m.label}: ${item.name}`}
                      className="flex-1 h-7 grid place-items-center rounded-lg bg-surface-950/85 text-surface-300 hover:text-white backdrop-blur-sm"
                    >
                      {m.icon}
                    </button>
                  ))}
                </div>

                <p className="mt-1.5 text-[11px] text-surface-400 truncate" title={item.name}>
                  {item.name}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {page < totalPages && items.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="px-5 py-2.5 rounded-xl bg-surface-800 text-surface-200 text-sm font-medium border border-surface-700/50 hover:bg-surface-700 disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Show me more"}
          </button>
        </div>
      )}

      {/* Running tally — the point is watching this number climb */}
      {savedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-700/60 bg-surface-950/95 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {savedCount} title{savedCount === 1 ? "" : "s"} added
                {saving && <Loader2 className="inline size-3 ml-2 animate-spin text-surface-500" />}
              </p>
              <p className="text-[11px] text-surface-500 truncate">
                Saved as you go — you can stop whenever you like.
              </p>
            </div>
            <Link
              href="/app/profile"
              onClick={finish}
              className="ml-auto shrink-0 px-4 py-2.5 rounded-xl bg-brand-500 text-surface-950 text-sm font-semibold hover:bg-brand-400 transition-colors"
            >
              Done — see my profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
