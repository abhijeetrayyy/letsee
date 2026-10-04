"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { useSearchIndex } from "@components/header/useSearchIndex";
import { queryIndex } from "@/utils/searchIndex";
import { getPosterUrl } from "@/utils/imageUrl";

/**
 * Pick a film or series by name (docs/design/SYSTEM.md §8, Input and gates).
 *
 * Suggestions come from the local search index — your own library first, then
 * the popular slice — and appear as you type with nothing leaving the browser.
 * TMDB is asked once, only when you stop typing and the index has fewer than
 * five matches, which is the same economy the header search keeps.
 */
export type PickedTitle = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  year: number | null;
};

type TmdbHit = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
};

/**
 * The search behind the picker, for anything else that lists titles by name
 * (the Log it sheet): local index first, TMDB once when it has too little.
 */
export function useTitleSearch(query: string) {
  const [remote, setRemote] = useState<{ query: string; hits: PickedTitle[] } | null>(null);
  const [asking, setAsking] = useState(false);
  const index = useSearchIndex(true);

  const local = useMemo<PickedTitle[]>(
    () =>
      queryIndex(index, query, 20)
        .filter((r) => r.t === "movie" || r.t === "tv")
        .slice(0, 8)
        .map((r) => ({
          itemId: r.k.split(":")[1],
          itemType: r.t as "movie" | "tv",
          itemName: r.n,
          imageUrl: r.p ?? null,
          year: r.y,
        })),
    [index, query],
  );

  const q = query.trim();
  const needsRemote = q.length >= 2 && local.length < 5;

  useEffect(() => {
    if (!needsRemote) {
      setAsking(false);
      return;
    }
    let stale = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAsking(true);
      try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = res.ok ? await res.json() : null;
        const hits = (Array.isArray(data?.results) ? (data.results as TmdbHit[]) : [])
          .filter((h) => h.media_type === "movie" || h.media_type === "tv")
          .slice(0, 8)
          .map((h) => ({
            itemId: String(h.id),
            itemType: h.media_type as "movie" | "tv",
            itemName: h.title ?? h.name ?? "",
            imageUrl: h.poster_path ?? null,
            year: Number((h.release_date ?? h.first_air_date ?? "").slice(0, 4)) || null,
          }));
        if (!stale) setRemote({ query: q, hits });
      } catch {
        // Aborted or offline: the local suggestions stand.
      } finally {
        if (!stale) setAsking(false);
      }
    }, 450);
    return () => {
      stale = true;
      clearTimeout(timer);
      controller.abort();
      // A newer query takes over, or none is needed: either way this one's
      // spinner must not outlive it.
      setAsking(false);
    };
  }, [q, needsRemote]);

  const results = useMemo(() => {
    const seen = new Set(local.map((t) => `${t.itemType}:${t.itemId}`));
    const extra = remote?.query === q ? remote.hits.filter((t) => !seen.has(`${t.itemType}:${t.itemId}`)) : [];
    return [...local, ...extra].slice(0, 10);
  }, [local, remote, q]);

  return { q, results, asking };
}

export default function TitlePicker({
  onPick,
  placeholder = "A film or series",
  autoFocus = true,
}: {
  onPick: (title: PickedTitle) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const { q, results, asking } = useTitleSearch(query);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  return (
    <div className="grid gap-3">
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-control bg-raised pl-10 pr-10 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        {asking && <LoaderCircle className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-500" aria-hidden />}
      </label>
      {q && (
        <ul className="-mx-2 grid gap-0.5" aria-label="Matches">
          {results.map((t) => (
            <li key={`${t.itemType}:${t.itemId}`}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <img src={getPosterUrl(t.imageUrl, "w92")} alt="" loading="lazy" decoding="async" className="aspect-2/3 w-9 shrink-0 rounded-media bg-hover object-cover" />
                <span className="min-w-0">
                  <span className="block truncate font-display text-base text-ink-0">{t.itemName}</span>
                  <span className="block text-xs text-ink-500">
                    {[t.year, t.itemType === "tv" ? "Series" : "Film"].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!asking && results.length === 0 && q.length >= 2 && <li className="px-2 py-3 text-sm text-ink-500">Nothing by that name.</li>}
        </ul>
      )}
    </div>
  );
}
