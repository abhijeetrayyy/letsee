"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { SlidersHorizontal, X } from "lucide-react";
import TitleCard from "@components/ds/TitleCard";
import Sheet from "@components/ds/Sheet";
import { peopleOnTitles } from "@/lib/db/search";
import type { RoomPerson } from "@/lib/db/rooms";
import { swrFetcher } from "@/utils/swrFetcher";
import {
  appliedCount,
  activeFilters,
  genreIdsFor,
  browseHeadline,
  browseQueryString,
  buildBrowseUrl,
  withBrowseFilters,
  BROWSE_SORTS,
  MAX_BROWSE_PAGE,
  type BrowseFilterKey,
  type BrowseParams,
} from "@/utils/browseUrl";
import { DECADES, LANGUAGES, SORT_LABELS, genreLabel, genresFor, languageLabel } from "@/staticData/browseFilters";
import { MOODS } from "@/staticData/moods";

/**
 * Browse, inside Search (docs/design/PAGES.md §4): for when you don't know
 * what you want. Films or series, then genre, language, decade and order —
 * in a bar on a desktop, in a sheet behind *Filters · 2* on a phone — and a
 * grid of the canonical card with your people's faces on what they've seen.
 *
 * Every filter lives in the URL (`/app/search?browse=1&genre=18…`), written
 * with the History API so Back steps through what you tried and nothing asks
 * the server for the page. The grid comes from `/api/browse`, which the CDN
 * keeps for an hour per query; a keyword, studio, network or collection from
 * a title page arrives as one more filter you can remove.
 */
type Page = {
  labels: Partial<Record<BrowseFilterKey, string>>;
  totalPages: number;
  total: number;
  page: number;
  items: { id: number; title: string; poster_path: string | null; date: string | null }[];
};

function go(p: BrowseParams, patch: Partial<BrowseParams>) {
  window.history.pushState(null, "", buildBrowseUrl(withBrowseFilters(p, patch)));
  window.scrollTo({ top: 0, behavior: "instant" });
}

export default function Browse({ params, yourPeople }: { params: BrowseParams; yourPeople: RoomPerson[] }) {
  const p = params;
  const [sheet, setSheet] = useState(false);
  const base = browseQueryString({ ...p, page: 1 });

  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite<Page>(
    (i, prev: Page | null) => {
      if (prev && (i + 1 > prev.totalPages || i + 1 > MAX_BROWSE_PAGE)) return null;
      const qs = browseQueryString({ ...p, page: i + 1 });
      return `/api/browse${qs ? `?${qs}` : ""}`;
    },
    swrFetcher,
    { revalidateOnFocus: false, revalidateFirstPage: false },
  );

  const first = data?.[0];
  // Genre, language and decade are named here without a round trip; a
  // keyword, studio, network or collection by the server.
  // A mood knows its own name, and a facet whose name TMDB didn't send (it
  // drops a connection now and then) reads as a word, never as an id.
  const mood = MOODS.find((m) => m.params.keyword && m.params.keyword === p.keyword);
  const fallback: Partial<Record<BrowseFilterKey, string>> = {
    ...(p.keyword ? { keyword: "Tagged" } : {}),
    ...(p.company ? { company: "This studio" } : {}),
    ...(p.network ? { network: "This network" } : {}),
    ...(p.collection ? { collection: "This collection" } : {}),
  };
  const labels: Partial<Record<BrowseFilterKey, string>> = {
    ...fallback,
    ...first?.labels,
    ...(mood ? { keyword: mood.label } : {}),
    ...(p.genre ? { genre: genreLabel(p.genre, p.type) } : {}),
    ...(p.lang ? { lang: languageLabel(p.lang) } : {}),
    ...(p.decade ? { decade: `${p.decade}s` } : {}),
  };
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (data ?? []).flatMap((pg) => pg.items).filter((i) => !seen.has(i.id) && seen.add(i.id));
  }, [data]);
  const total = first?.total ?? 0;
  const more = !!first && size < first.totalPages && size < MAX_BROWSE_PAGE;
  const chips = activeFilters(p, labels);
  const count = appliedCount(p);
  const noun = p.type === "tv" ? "series" : "films";

  const keys = items.map((i) => `${p.type}:${i.id}`);
  const { data: seenBy } = useSWR(
    yourPeople.length && keys.length ? ["browse-seen-by", base, keys.length, yourPeople.length] : null,
    () => peopleOnTitles(yourPeople, keys),
    { revalidateOnFocus: false },
  );

  const typeIsPinned = Boolean(p.collection || p.network);
  const segment = (on: boolean) =>
    `inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"}`;

  return (
    <section aria-labelledby="browse-title" className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="browse-title" className="text-3xl text-ink-0 sm:text-4xl">
            {browseHeadline(p, labels)}
          </h2>
          <p className="mt-1 font-mono text-xs uppercase tracking-wide text-ink-500">
            {isLoading ? " " : `${total.toLocaleString("en-GB")} ${noun}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.history.pushState(null, "", "/app/search")}
          aria-label="Close browse"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-400 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!typeIsPinned &&
          (["movie", "tv"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={p.type === t} onClick={() => go(p, { type: t })} className={segment(p.type === t)}>
              {t === "tv" ? "Series" : "Films"}
            </button>
          ))}
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input hover:bg-hover md:hidden"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
          {count > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-action font-mono text-xs text-on-action">{count}</span>}
        </button>
      </div>

      {/* Desktop: the controls in a bar. Phone: the same controls in a sheet. */}
      <div className="hidden md:block">
        <Controls p={p} layout="bar" />
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters" description={`${total.toLocaleString("en-GB")} ${noun}`}>
        <Controls p={p} layout="sheet" />
        <button
          type="button"
          onClick={() => setSheet(false)}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-action text-base font-semibold text-on-action hover:bg-action-hover"
        >
          Show {total.toLocaleString("en-GB")} {noun}
        </button>
      </Sheet>

      {/* Nothing chosen yet: a mood is an easier start than a filter. */}
      {chips.length === 0 && (
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" aria-label="Moods">
          {MOODS.filter((m) => !m.params.genre || genreIdsFor(p.type).has(Number(m.params.genre))).map((m) => (
            <li key={m.key} className="shrink-0">
              <button type="button" onClick={() => go(p, { ...m.params })} className="inline-flex h-9 items-center rounded-full bg-raised px-3.5 text-sm text-ink-200 ring-1 ring-inset ring-line-strong hover:bg-hover hover:text-ink-0">
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {chips.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2" aria-label="Applied filters">
          {chips.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => go(p, { [c.key]: undefined })}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-raised pl-3 pr-2 text-sm text-ink-0 ring-1 ring-inset ring-line-strong hover:bg-hover"
              >
                {c.label}
                <X className="size-3.5 text-ink-400" aria-hidden />
                <span className="sr-only">Remove</span>
              </button>
            </li>
          ))}
          {chips.length > 1 && (
            <li>
              <button type="button" onClick={() => go(p, { keyword: undefined, company: undefined, network: undefined, collection: undefined, genre: undefined, lang: undefined, decade: undefined })} className="text-sm text-ink-500 underline decoration-line-input underline-offset-4 hover:text-ink-0">
                Clear all
              </button>
            </li>
          )}
        </ul>
      )}

      {isLoading ? (
        <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <li key={i} className="aspect-2/3 rounded-media bg-raised" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="py-6 text-sm text-ink-400">
          {chips.length > 1 ? "Nothing matches all of that. Remove a filter to widen it." : p.company ? "TMDB doesn't roll subsidiaries into their parent studio, so a studio can genuinely list very little." : "Nothing came back for this one."}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((i, n) => (
            <li key={i.id} className="min-w-0">
              <TitleCard
                eager={n < 6}
                id={i.id}
                title={i.title}
                mediaType={p.type}
                posterPath={i.poster_path}
                releaseDate={i.date}
                people={(seenBy?.get(`${p.type}:${i.id}`) ?? []).map((x) => ({ username: x.username, avatarUrl: x.avatarUrl }))}
              />
            </li>
          ))}
        </ul>
      )}

      {more && (
        <button
          type="button"
          onClick={() => void setSize(size + 1)}
          disabled={isValidating}
          className="inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0 disabled:opacity-60"
        >
          {isValidating ? "Loading…" : `Showing ${items.length} of ${total.toLocaleString("en-GB")} · More`}
        </button>
      )}
    </section>
  );
}

/** Genre, language, decade and order — one set of controls, laid out as a bar or a sheet. */
function Controls({ p, layout }: { p: BrowseParams; layout: "bar" | "sheet" }) {
  const genres = genresFor(p.type);
  const select =
    "h-10 rounded-control bg-raised px-3 text-sm text-ink-0 ring-1 ring-inset ring-line-input focus:outline-none focus-visible:ring-2 focus-visible:ring-focus";
  const pill = (on: boolean) =>
    `inline-flex h-9 items-center rounded-full px-3.5 text-sm transition-colors ${on ? "bg-action font-medium text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"}`;

  if (layout === "bar") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label>
          <span className="sr-only">Genre</span>
          <select className={select} value={p.genre ?? ""} onChange={(e) => go(p, { genre: e.target.value || undefined })}>
            <option value="">Any genre</option>
            {genres.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Language</span>
          <select className={select} value={p.lang ?? ""} onChange={(e) => go(p, { lang: e.target.value || undefined })}>
            <option value="">Any language</option>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Decade</span>
          <select className={select} value={p.decade ?? ""} onChange={(e) => go(p, { decade: e.target.value || undefined })}>
            <option value="">Any decade</option>
            {DECADES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {/* A collection reads in release order; a sort over nine films is a control with no good answer. */}
        {!p.collection && (
          <label className="ml-auto">
            <span className="sr-only">Order</span>
            <select className={select} value={p.sort} onChange={(e) => go(p, { sort: e.target.value as BrowseParams["sort"] })}>
              {BROWSE_SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-0">Genre</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!p.genre} onClick={() => go(p, { genre: undefined })} className={pill(!p.genre)}>
            Any
          </button>
          {genres.map((g) => (
            <button key={g.value} type="button" aria-pressed={p.genre === g.value} onClick={() => go(p, { genre: p.genre === g.value ? undefined : g.value })} className={pill(p.genre === g.value)}>
              {g.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-0">Language</span>
        <select className={select} value={p.lang ?? ""} onChange={(e) => go(p, { lang: e.target.value || undefined })}>
          <option value="">Any language</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-0">Decade</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!p.decade} onClick={() => go(p, { decade: undefined })} className={pill(!p.decade)}>
            Any
          </button>
          {DECADES.map((d) => (
            <button key={d.value} type="button" aria-pressed={p.decade === d.value} onClick={() => go(p, { decade: p.decade === d.value ? undefined : d.value })} className={pill(p.decade === d.value)}>
              {d.label}
            </button>
          ))}
        </div>
      </fieldset>
      {!p.collection && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-0">Order</legend>
          <div className="flex flex-wrap gap-2">
            {BROWSE_SORTS.map((s) => (
              <button key={s} type="button" aria-pressed={p.sort === s} onClick={() => go(p, { sort: s })} className={pill(p.sort === s)}>
                {SORT_LABELS[s]}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
