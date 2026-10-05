"use client";

import { Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Search as SearchIcon } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import Faces from "@components/ds/Faces";
import { QuickMarkButton } from "@components/ds/QuickMarks";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { buildVocabulary, correctQuery } from "@/lib/search/correct";
import { searchMeta, type SearchMeta } from "@/lib/search/meta";
import NaturalSearch from "@components/search/NaturalSearch";
import NewOnYourServices from "@components/home/NewOnYourServices";
import { useSearchIndex } from "@components/header/useSearchIndex";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchRoomList, type RoomPerson } from "@/lib/db/rooms";
import { fetchPeopleActivity } from "@/lib/db/peopleActivity";
import { peopleOnTitles, searchLists, searchUsers, sharedLoves } from "@/lib/db/search";
import { groupWeek } from "@/lib/people/home";
import { queryIndex } from "@/utils/searchIndex";
import { rankByName } from "@/lib/search/rank";
import { buildBrowseUrl, parseBrowseParams } from "@/utils/browseUrl";
import Browse from "./Browse";
import { MOODS } from "@/staticData/moods";
import { getPosterUrl } from "@/utils/imageUrl";
import { listPath, personPath, titlePath } from "@/utils/urls";

import Rail from "@components/ds/Rail";
/**
 * Search, one implementation (docs/design/PAGES.md §4).
 *
 * The query lives in the URL (`?q=`, `?scope=`, `?mode=describe`), written
 * with the History API so typing never asks the server for anything. Before
 * typing: recent searches, what's new on your services, what your people have
 * been watching, what's popular, and ways to browse — which open browse in
 * place (`?browse=1`, `./Browse`). While typing: Titles ·
 * People · Lists. Titles show which of your people have seen them and log in
 * one tap; people are introduced by what you share, never by counts. Arrow
 * keys move through the results.
 */
type Scope = "titles" | "people" | "lists";
type Title = { itemId: string; itemType: "movie" | "tv"; itemName: string; imageUrl: string | null; year: number | null; meta?: SearchMeta };
type Crew = { id: number; name: string; image: string | null; known: string | null };
type TmdbHit = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  profile_path?: string | null;
  known_for_department?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  original_language?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  overview?: string | null;
};

const RECENT_KEY = "recent_searches";
export const MAX_RECENT = 8;

/** A short, opinionated set — the full genre list is a wall, not a prompt. */
const GENRES = [
  { id: 18, name: "Drama" },
  { id: 35, name: "Comedy" },
  { id: 53, name: "Thriller" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 27, name: "Horror" },
  { id: 16, name: "Animation" },
  { id: 99, name: "Documentary" },
  { id: 28, name: "Action" },
];

export function readRecent(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function writeRecent(terms: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(terms.slice(0, MAX_RECENT)));
  } catch {
    // Not remembered this time.
  }
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Update the URL without a navigation: typing must not cost a request. */
function writeParams(next: URLSearchParams) {
  const s = next.toString();
  window.history.replaceState(null, "", `/app/search${s ? `?${s}` : ""}`);
}

const tmdbFetcher = async (url: string): Promise<TmdbHit[]> => {
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
};

export default function SearchV2() {
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  );
}

function SearchPage() {
  const params = useSearchParams();
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;

  const [q, setQ] = useState(() => params.get("q") ?? "");
  const scope: Scope = params.get("scope") === "people" ? "people" : params.get("scope") === "lists" ? "lists" : "titles";
  const describe = params.get("mode") === "describe";
  const browsing = params.get("browse") === "1";
  const browseParams = useMemo(() => parseBrowseParams(Object.fromEntries(params.entries())), [params]);
  const dq = useDebounced(q.trim(), 300);
  // Empty on the server and in the first render, then read from this browser:
  // read during render, the page hydrated with recent searches the server never
  // drew, and React threw the whole page away and rebuilt it.
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage only exists after mount
    setRecent(readRecent());
  }, []);

  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);

  // On a desktop the field is ready for typing on arrival ("/" from anywhere
  // lands here). Not on a phone, where focusing would throw up the keyboard
  // over what you came to browse.
  useEffect(() => {
    if (window.matchMedia("(min-width: 48rem)").matches) input.current?.focus();
  }, []);

  // Keep `?q=` in step with the field, quietly.
  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    if (dq) next.set("q", dq);
    else next.delete("q");
    if (next.toString() !== new URLSearchParams(window.location.search).toString()) writeParams(next);
  }, [dq]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    writeParams(next);
  };

  const remember = useCallback(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const next = [term, ...readRecent().filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
    writeRecent(next);
    setRecent(next);
  }, [q]);

  /** Arrow keys walk the results; Escape returns to the field. */
  const onResultsKey = (e: React.KeyboardEvent) => {
    const items = [...(results.current?.querySelectorAll<HTMLElement>("[data-result]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" && at < items.length - 1) {
      e.preventDefault();
      items[at + 1]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (at <= 0) input.current?.focus();
      else items[at - 1]?.focus();
    } else if (e.key === "Escape") {
      input.current?.focus();
    }
  };

  const { data: list } = useSWR(me ? ["rooms", me] : null, () => fetchRoomList(me!), { revalidateOnFocus: false });
  const yourPeople = useMemo(() => (list?.people ?? []).slice(0, 24).map((p) => p.person), [list]);

  const chip = (on: boolean) =>
    `inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"}`;

  return (
    <div className="mx-auto flex w-full max-w-app flex-col gap-8 px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      <h1 className="text-4xl text-ink-0 sm:text-5xl">Search</h1>

      <div role="search" className="flex w-full max-w-read flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">{describe ? "Describe what you want to watch" : "Search films, series, people and lists"}</span>
          {!describe && (
            <>
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
              <input
                ref={input}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    results.current?.querySelector<HTMLElement>("[data-result]")?.focus();
                  }
                  if (e.key === "Enter") remember();
                }}
                placeholder={scope === "people" ? "People on letsee, cast and crew" : scope === "lists" ? "Lists by name" : "Films, series, people, lists"}
                className="h-12 w-full rounded-card bg-raised pl-12 pr-11 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
            </>
          )}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {!describe && q.trim() && (
            <>
              {(["titles", "people", "lists"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={scope === s} onClick={() => setParam("scope", s === "titles" ? null : s)} className={chip(scope === s)}>
                  {s === "titles" ? "Titles" : s === "people" ? "People" : "Lists"}
                </button>
              ))}
            </>
          )}
          <button type="button" aria-pressed={describe} onClick={() => setParam("mode", describe ? null : "describe")} className={`${chip(describe)} ml-auto`}>
            {describe ? "Back to search" : "Describe it instead"}
          </button>
        </div>
      </div>

      {describe ? (
        <NaturalSearch />
      ) : (
        <div ref={results} onKeyDown={onResultsKey} onClickCapture={(e) => (e.target as HTMLElement).closest("[data-result]") && remember()}>
          {!q.trim() && browsing ? (
            <Browse params={browseParams} yourPeople={yourPeople} />
          ) : !q.trim() ? (
            <BeforeTyping recent={recent} pick={(t) => setQ(t)} clear={() => {
                writeRecent([]);
                setRecent([]);
              }} me={me} yourPeople={yourPeople} />
          ) : (
            <div className="max-w-read">
              {scope === "people" ? <PeopleResults q={dq} me={me} /> : scope === "lists" ? <ListResults q={dq} /> : <TitleResults q={q.trim()} dq={dq} yourPeople={yourPeople} onSuggest={setQ} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Before typing ──────────────────────────────────────────────────────── */

function BeforeTyping({
  recent,
  pick,
  clear,
  me,
  yourPeople,
}: {
  recent: string[];
  pick: (t: string) => void;
  clear: () => void;
  me: string | null;
  yourPeople: RoomPerson[];
}) {
  const index = useSearchIndex(true);
  const popular = useMemo(
    () => (index?.rows ?? []).filter((r) => !r.lib && (r.t === "movie" || r.t === "tv")).slice(0, 15),
    [index],
  );
  const ids = yourPeople.map((p) => p.id);
  const { data: activity } = useSWR(ids.length ? ["people-month", ids.join(",")] : null, () => fetchPeopleActivity(ids, 30), { revalidateOnFocus: false });
  const withPeople = activity ? groupWeek(activity.viewings).slice(0, 12) : [];
  const byId = new Map(yourPeople.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-10">
      {recent.length > 0 && (
        <section aria-labelledby="recent">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="recent" className="text-2xl text-ink-0 sm:text-3xl">
              Recent
            </h2>
            <button type="button" onClick={clear} className="text-sm text-ink-500 hover:text-ink-0">
              Clear
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {recent.map((t) => (
              <li key={t}>
                <button type="button" onClick={() => pick(t)} className="inline-flex h-9 items-center rounded-full bg-raised px-3.5 text-sm text-ink-200 ring-1 ring-inset ring-line-strong hover:bg-hover hover:text-ink-0">
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {me && <NewOnYourServices />}

      {withPeople.length > 0 && (
        <section aria-labelledby="with-people">
          <h2 id="with-people" className="mb-4 text-2xl text-ink-0 sm:text-3xl">
            Your people have been watching
          </h2>
          <Shelf>
            {withPeople.map((g, n) => (
              <li key={`${g.itemType}:${g.itemId}`} className="w-36 shrink-0 snap-start sm:w-44">
                <Link href={titlePath(g.itemType, g.itemId, g.itemName)} className="block">
                  <img src={getPosterUrl(g.imageUrl, "w342")} alt={g.itemName} loading={n < 3 ? "eager" : "lazy"} className="img-fade aspect-2/3 w-full rounded-media bg-hover object-cover" />
                </Link>
                <span className="mt-2 flex items-center gap-2">
                  <Faces people={g.userIds.map((id) => byId.get(id)).filter((p): p is RoomPerson => !!p)} size={20} />
                  <span className="truncate text-xs text-ink-400">{g.itemName}</span>
                </span>
              </li>
            ))}
          </Shelf>
        </section>
      )}

      {popular.length > 0 && (
        <section aria-labelledby="popular">
          <h2 id="popular" className="mb-4 text-2xl text-ink-0 sm:text-3xl">
            Popular now
          </h2>
          <Shelf>
            {popular.map((r, n) => {
              const [type, id] = r.k.split(":");
              return (
                <li key={r.k} className="w-36 shrink-0 snap-start sm:w-44">
                  <Link href={titlePath(type === "tv" ? "tv" : "movie", id, r.n)} className="block">
                    <img src={getPosterUrl(r.p ?? null, "w342")} alt={r.n} loading={n < 3 ? "eager" : "lazy"} className="img-fade aspect-2/3 w-full rounded-media bg-hover object-cover" />
                    <span className="mt-1.5 block truncate text-xs text-ink-400">{r.n}</span>
                  </Link>
                </li>
              );
            })}
          </Shelf>
        </section>
      )}

      <section aria-labelledby="browse">
        <h2 id="browse" className="mb-4 text-2xl text-ink-0 sm:text-3xl">
          Browse
        </h2>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={buildBrowseUrl({})} onClick={openBrowse} className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input hover:bg-hover">
              All films
            </Link>
          </li>
          <li>
            <Link href={buildBrowseUrl({ type: "tv" })} onClick={openBrowse} className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input hover:bg-hover">
              All series
            </Link>
          </li>
          {GENRES.map((g) => (
            <li key={g.id}>
              <Link href={buildBrowseUrl({ genre: String(g.id) })} onClick={openBrowse} className="inline-flex h-9 items-center rounded-full px-3.5 text-sm text-ink-300 ring-1 ring-inset ring-line-strong hover:bg-hover hover:text-ink-0">
                {g.name}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mb-2 mt-5 text-sm font-medium text-ink-0">Or a mood</p>
        <ul className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <li key={m.key}>
              <Link href={buildBrowseUrl(m.params)} onClick={openBrowse} className="inline-flex h-9 items-center rounded-full bg-raised px-3.5 text-sm text-ink-200 ring-1 ring-inset ring-line-strong hover:bg-hover hover:text-ink-0">
                {m.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Browse opens in place: the History API, so the static Search page isn't fetched again. */
function openBrowse(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  window.history.pushState(null, "", e.currentTarget.getAttribute("href"));
  window.scrollTo({ top: 0, behavior: "instant" });
}

function Shelf({ children }: { children: React.ReactNode }) {
  return <Rail><ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 sm:scroll-px-6 lg:scroll-px-8 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">{children}</ul></Rail>;
}

/* ── Titles ─────────────────────────────────────────────────────────────── */

/**
 * Titles for a query — and, when the query is misspelt, for what it was meant
 * to be. `correctQuery` replaces unknown words with the nearest words of real
 * titles in the index; when what was typed finds fewer than three titles and a
 * correction exists, the correction's results are shown under "Showing
 * results for…" with a way back to the literal search, and when what was typed
 * does fine, the correction is only offered ("Did you mean…?").
 */
export function TitleResults({
  q,
  dq,
  yourPeople,
  onSuggest,
  limit = 20,
}: {
  q: string;
  dq: string;
  yourPeople: RoomPerson[];
  onSuggest?: (q: string) => void;
  /** How many to show — the quick-search panel shows the top few. */
  limit?: number;
}) {
  const index = useSearchIndex(true);
  const vocab = useMemo(() => buildVocabulary((index?.rows ?? []).map((r) => r.n)), [index]);
  const corrected = useMemo(() => (dq.length >= 3 ? correctQuery(dq, vocab) : null), [dq, vocab]);
  /** The query someone asked to see literally, after "Search instead for…". */
  const [literal, setLiteral] = useState<string | null>(null);
  const { data: hits, isLoading } = useSWR(dq.length >= 2 ? `/api/search?query=${encodeURIComponent(dq)}` : null, tmdbFetcher, { revalidateOnFocus: false });
  const { data: fixedHits } = useSWR(corrected && literal !== dq ? `/api/search?query=${encodeURIComponent(corrected)}` : null, tmdbFetcher, {
    revalidateOnFocus: false,
  });
  const titleHits = (h: TmdbHit[] | undefined) => (h ?? []).filter((x) => x.media_type === "movie" || x.media_type === "tv");
  const weak = !!hits && titleHits(hits).length < 3;
  const showFixed = !!corrected && literal !== dq && weak && titleHits(fixedHits).length > titleHits(hits).length;
  const shownQuery = showFixed ? corrected! : q;
  const local = useMemo<Title[]>(
    () =>
      queryIndex(index, shownQuery, 30)
        .filter((r) => r.t === "movie" || r.t === "tv")
        .slice(0, 10)
        .map((r) => ({ itemId: r.k.split(":")[1], itemType: r.t as "movie" | "tv", itemName: r.n, imageUrl: r.p ?? null, year: r.y })),
    [index, shownQuery],
  );

  const titles = useMemo(() => {
    const all: Title[] = ((showFixed ? fixedHits : hits) ?? [])
      .filter((h) => h.media_type === "movie" || h.media_type === "tv")
      .map((h) => ({
        itemId: String(h.id),
        itemType: h.media_type as "movie" | "tv",
        itemName: h.title ?? h.name ?? "",
        imageUrl: h.poster_path ?? null,
        year: Number((h.release_date ?? h.first_air_date ?? "").slice(0, 4)) || null,
        meta: searchMeta(h),
      }))
      .filter((t) => t.itemName);
    const byKey = new Map(all.map((t) => [`${t.itemType}:${t.itemId}`, t]));
    // Your library has no years; TMDB's row for the same title does, so "Dune"
    // from your library isn't left undated beside "Dune · 1984".
    const mine = local.map((t) => {
      const twin = byKey.get(`${t.itemType}:${t.itemId}`);
      return twin ? { ...t, year: t.year ?? twin.year, imageUrl: t.imageUrl ?? twin.imageUrl, meta: twin.meta } : t;
    });
    const seen = new Set(mine.map((t) => `${t.itemType}:${t.itemId}`));
    const remote = all.filter((t) => !seen.has(`${t.itemType}:${t.itemId}`));
    return rankByName([...mine, ...remote], shownQuery).slice(0, limit);
  }, [local, hits, fixedHits, showFixed, shownQuery, limit]);
  const { getStatus } = useContext(UserPrefrenceContext);

  const keys = titles.map((t) => `${t.itemType}:${t.itemId}`);
  const { data: seenBy } = useSWR(yourPeople.length && keys.length ? ["seen-by", keys.join(","), yourPeople.length] : null, () => peopleOnTitles(yourPeople, keys), {
    revalidateOnFocus: false,
  });

  const notice = showFixed ? (
    <p className="mb-2 text-sm text-ink-400" role="status">
      Showing results for <span className="font-medium text-ink-0">{corrected}</span>.{" "}
      <button type="button" onClick={() => setLiteral(dq)} className="underline decoration-line-input underline-offset-4 hover:text-ink-0">
        Search instead for {dq}
      </button>
    </p>
  ) : corrected && literal !== dq && hits && onSuggest ? (
    <p className="mb-2 text-sm text-ink-400">
      Did you mean{" "}
      <button type="button" onClick={() => onSuggest(corrected)} className="font-medium text-ink-0 underline decoration-line-input underline-offset-4">
        {corrected}
      </button>
      ?
    </p>
  ) : null;

  if (!titles.length)
    return (
      <>
        {notice}
        <Nothing loading={isLoading || dq !== q}>No films or series by that name.</Nothing>
      </>
    );

  return (
    <>
    {notice}
    <ul className="divide-y divide-line" aria-label="Titles">
      {titles.map((t, n) => {
        const k = `${t.itemType}:${t.itemId}`;
        const who = seenBy?.get(k) ?? [];
        return (
          <li key={k} className="flex items-center gap-3 py-2">
            <Link
              data-result
              href={titlePath(t.itemType, t.itemId, t.itemName)}
              className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-1 transition-colors hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <img src={getPosterUrl(t.imageUrl, "w92")} alt="" loading={n < 6 ? "eager" : "lazy"} className="aspect-2/3 w-10 shrink-0 rounded-media bg-hover object-cover" />
              <span className="min-w-0">
                <span className="block truncate font-display text-base text-ink-0">{t.itemName}</span>
                <span className="block text-xs text-ink-500">
                  {[t.year, t.itemType === "tv" ? "Series" : "Film", t.meta?.genre].filter(Boolean).join(" · ")}
                  {t.meta?.rating != null && <span className="tabular-nums"> · ★ {t.meta.rating.toFixed(1)}</span>}
                  {/* Where you stand, as words; the button beside the row changes it. */}
                  {(() => {
                    const st = getStatus(t.itemId, t.itemType);
                    const word = st === "watched" ? "Watched" : st === "watchlist" ? "Watch later" : st === "watching" ? "Watching" : null;
                    return word ? <span className="text-accent"> · {word}</span> : null;
                  })()}
                  {who.length > 0 && ` · seen by ${who[0].username}${who.length > 1 ? ` and ${who.length - 1} more of your people` : ""}`}
                </span>
                {/* What it is, in a line: the difference between two titles with one name. */}
                {t.meta?.blurb && <span className="mt-0.5 block truncate text-xs text-ink-400">{t.meta.blurb}</span>}
              </span>
            </Link>
            {who.length > 0 && <Faces people={who} size={22} />}
            {/* Mark it without opening it (ds/QuickMarks). */}
            <QuickMarkButton title={{ itemId: t.itemId, itemType: t.itemType, itemName: t.itemName, imageUrl: t.imageUrl }} className="shrink-0" />
          </li>
        );
      })}
    </ul>
    </>
  );
}

/* ── People ─────────────────────────────────────────────────────────────── */

/** `limit` caps each group (members, cast and crew) — the quick-search panel shows a few. */
export function PeopleResults({ q, me, limit = 10 }: { q: string; me: string | null; limit?: number }) {
  const { data: users, isLoading } = useSWR(q.length >= 2 ? ["users", q, me] : null, () => searchUsers(q, me), { revalidateOnFocus: false });
  const { data: loves } = useSWR(me && users?.length ? ["loves", me, users.map((u) => u.id).join(",")] : null, () => sharedLoves(me!, users!), {
    revalidateOnFocus: false,
  });
  const { data: hits } = useSWR(q.length >= 2 ? `/api/search?query=${encodeURIComponent(q)}&media_type=person` : null, tmdbFetcher, { revalidateOnFocus: false });
  const crew: Crew[] = (hits ?? []).slice(0, limit).map((h) => ({ id: h.id, name: h.name ?? "", image: h.profile_path ?? null, known: h.known_for_department ?? null }));

  if (!users?.length && !crew.length) return <Nothing loading={isLoading}>No one by that name.</Nothing>;

  return (
    <div className="flex flex-col gap-8">
      {(users?.length ?? 0) > 0 && (
        <section aria-label="People on letsee">
          <h2 className="mb-2 font-sans text-xs font-medium tracking-normal text-ink-500">On letsee</h2>
          <ul className="divide-y divide-line">
            {users!.slice(0, limit).map((u) => (
              <li key={u.id}>
                <Link
                  data-result
                  href={`/app/profile/${encodeURIComponent(u.username)}`}
                  className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <Avatar src={u.avatarUrl} name={u.username} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium text-ink-0">{u.username}</span>
                    {loves?.get(u.id) && (
                      <span className="block truncate text-sm text-ink-400">
                        You both loved <span className="font-display text-ink-200">{loves.get(u.id)}</span>
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {crew.length > 0 && (
        <section aria-label="Cast and crew">
          <h2 className="mb-2 font-sans text-xs font-medium tracking-normal text-ink-500">Cast and crew</h2>
          <ul className="divide-y divide-line">
            {crew.map((c) => (
              <li key={c.id}>
                <Link
                  data-result
                  href={personPath(c.id, c.name)}
                  className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {c.image ? (
                    <img src={getPosterUrl(c.image, "w92")} alt="" loading="lazy" className="size-10 shrink-0 rounded-full bg-hover object-cover" />
                  ) : (
                    <Avatar name={c.name} size={40} />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-base text-ink-0">{c.name}</span>
                    {c.known && <span className="block text-xs text-ink-500">{c.known}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ── Lists ──────────────────────────────────────────────────────────────── */

function ListResults({ q }: { q: string }) {
  const { data: lists, isLoading } = useSWR(q.length >= 2 ? ["lists", q] : null, () => searchLists(q), { revalidateOnFocus: false });
  if (!lists?.length) return <Nothing loading={isLoading}>No lists by that name.</Nothing>;
  return (
    <ul className="divide-y divide-line" aria-label="Lists">
      {lists.map((l) => (
        <li key={l.id}>
          <Link
            data-result
            href={listPath(l.id, l.name)}
            className="-mx-2 block rounded-control px-2 py-3 transition-colors hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="block truncate font-display text-lg text-ink-0">{l.name}</span>
            <span className="block truncate text-sm text-ink-500">
              {l.owner ? `by ${l.owner}` : "A list"}
              {l.description ? ` · ${l.description}` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Nothing({ loading, children }: { loading?: boolean; children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-ink-500">{loading ? "Looking…" : children}</p>;
}

