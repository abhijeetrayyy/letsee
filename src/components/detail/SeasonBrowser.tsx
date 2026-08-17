"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Check, ChevronRight, Star } from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";
import { formatLongDate, parseTmdbDate, toIso, type ParsedDate } from "@/utils/person/dates";

/**
 * A season as a place you go, not a filter you apply.
 *
 * What this replaces was a strip of identical grey pills above a list. Pressing
 * one swapped the rows underneath and nothing else changed — no poster, no
 * year, no synopsis, no sense that Season 4 of Breaking Bad is a different
 * object from Season 1 rather than a different query string. A journal about
 * what people watch should be able to say where you are, and "where" needs
 * somewhere to be.
 *
 * So the picker carries the artwork and the panel below it is the season
 * itself: poster, year, episode count, how much of it you have seen, its
 * overview, its episodes.
 *
 * The shape of the problem, measured live over 1336 seasons across 55 shows:
 *
 *   season poster_path   777/1336   58%
 *   season overview      336/1336   25%
 *   season air_date     1287/1336   96%
 *
 * Three quarters of seasons have no overview and two fifths have no poster, so
 * the panel is built for the empty case first — a season with neither must
 * still look like a place, which is why the poster falls back to a numbered
 * tile rather than a grey rectangle.
 *
 * The extremes are worse than the brief assumed. The largest season count in
 * the sample was not 25 but 81 (BBC Proms), with Coronation Street at 68,
 * Emmerdale 56 and University Challenge 57 — 26 of the 55 shows carried 25 or
 * more. And the largest single season was 1833 episodes (Kyunki Saas Bhi Kabhi
 * Bahu Thi), with Johnny Carson's season 2 at 258. Both ends are handled by
 * the same two decisions: the rail scrolls horizontally with lazy-loaded
 * artwork so 81 cards cost one screen of images, and the episode list renders
 * a window with the full season one link away. A 1-episode season hits neither
 * path and simply renders its one row.
 *
 * Episode artwork splits the same way. Across nine ordinary seasons every
 * episode had a still, an overview and a rating — 90 of 90. Carson's 258-episode
 * season had 0 stills, 0 ratings and 1 overview. Runtime alone was 100% across
 * all 348. So the still is never load-bearing: its fallback carries the episode
 * number at size, which is the one thing every episode has.
 */

type SeasonSummary = {
  id?: number;
  season_number: number;
  name?: string | null;
  episode_count?: number | null;
  air_date?: string | null;
  overview?: string | null;
  poster_path?: string | null;
};

type Episode = {
  id: number;
  episode_number: number;
  name?: string | null;
  air_date?: string | null;
  overview?: string | null;
  still_path?: string | null;
  runtime?: number | null;
  vote_average?: number | null;
};

type WatchedRow = { season_number: number; episode_number: number };

/** First render shows this many; the rest arrive a page at a time. */
const INITIAL_EPISODES = 12;
const MORE_STEP = 24;

const key = (s: number, e: number) => `${s},${e}`;

/** Calendar day as an integer — see the same helper in NextEpisode.tsx. */
function dayIndex(p: ParsedDate): number {
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000);
}

export default function SeasonBrowser({
  showId,
  seasons,
  isAuthenticated,
}: {
  showId: string | number;
  seasons: SeasonSummary[];
  isAuthenticated: boolean;
}) {
  const ordered = useMemo(
    () =>
      [...(seasons ?? [])]
        .filter((s) => typeof s?.season_number === "number")
        .sort((a, b) => a.season_number - b.season_number),
    [seasons],
  );

  /**
   * Watched state on the same SWR key ProgressRibbon uses, deliberately.
   *
   * Identical key means one cache entry and one request between the two
   * components, and it means marking an episode here fills the matching square
   * in the ribbon above without either component knowing the other exists.
   */
  const { data: watchedData, mutate } = useSWR<{ episodes?: WatchedRow[] }>(
    isAuthenticated ? `/api/watched-episodes?showId=${showId}` : null,
    swrFetcher,
  );

  const [picked, setPicked] = useState<number | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState(INITIAL_EPISODES);
  const [today, setToday] = useState<ParsedDate | null>(null);

  // Read the clock after mount, never during render: the server is on UTC and
  // the reader is not, and a date comparison that disagrees across the two is
  // the hydration failure this repo has already been bitten by once.
  useEffect(() => {
    const n = new Date();
    setToday({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() });
  }, []);

  const watchedSet = useMemo(() => {
    const set = new Set<string>();
    for (const r of watchedData?.episodes ?? []) set.add(key(r.season_number, r.episode_number));
    return set;
  }, [watchedData]);

  const isWatched = useCallback(
    (s: number, e: number) => {
      const k = key(s, e);
      return k in pending ? pending[k] : watchedSet.has(k);
    },
    [pending, watchedSet],
  );

  const watchedPerSeason = useMemo(() => {
    const counts = new Map<number, number>();
    for (const r of watchedData?.episodes ?? []) {
      counts.set(r.season_number, (counts.get(r.season_number) ?? 0) + 1);
    }
    return counts;
  }, [watchedData]);

  /**
   * Open on the season you are actually in.
   *
   * Landing on season 1 of a show you are eleven seasons into is the picker
   * asking you to find your own place every time. The season in progress is
   * the first one part-finished; failing that, the one after the last you
   * completed.
   *
   * Frozen after the first read on purpose. Recomputing it would mean marking
   * the last episode of a season slides the whole panel to the next one while
   * your finger is still on the button.
   */
  const resumeOnce = useRef<number | null>(null);
  if (resumeOnce.current === null && watchedPerSeason.size > 0) {
    let inProgress: number | null = null;
    let lastTouched = -1;
    for (const s of ordered) {
      const seen = watchedPerSeason.get(s.season_number) ?? 0;
      if (seen > 0) lastTouched = s.season_number;
      if (inProgress === null && seen > 0 && seen < (s.episode_count ?? 0)) {
        inProgress = s.season_number;
      }
    }
    if (inProgress !== null) {
      resumeOnce.current = inProgress;
    } else if (lastTouched >= 0) {
      const i = ordered.findIndex((s) => s.season_number === lastTouched);
      resumeOnce.current = ordered[i + 1]?.season_number ?? lastTouched;
    }
  }

  const active = picked ?? resumeOnce.current ?? ordered[0]?.season_number ?? 1;
  const activeSeason = ordered.find((s) => s.season_number === active) ?? ordered[0];

  const { data: seasonData, isLoading } = useSWR<{ episodes?: Episode[] }>(
    ordered.length > 0
      ? `/api/tv-season-episodes?showId=${encodeURIComponent(String(showId))}&season=${active}`
      : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );
  const episodes = seasonData?.episodes ?? [];

  useEffect(() => {
    setVisible(INITIAL_EPISODES);
  }, [active]);

  // Keep the open season in view in the rail without touching page scroll.
  // `scrollIntoView` would drag the whole document when the rail sits below the
  // fold; setting scrollLeft directly moves only the strip.
  const railRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  useEffect(() => {
    const rail = railRef.current;
    const card = cardRefs.current[active];
    if (!rail || !card) return;
    const target = card.offsetLeft - rail.clientWidth / 2 + card.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);

  const toggle = useCallback(
    async (season: number, episode: number) => {
      if (!isAuthenticated) return;
      const k = key(season, episode);
      const next = !isWatched(season, episode);
      setPending((p) => ({ ...p, [k]: next }));
      try {
        // Same contract ProgressRibbon uses: POST toggles, the route deletes an
        // existing row and re-derives the show's status either way.
        await fetch("/api/watched-episode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId: String(showId),
            seasonNumber: season,
            episodeNumber: episode,
          }),
        });
        await mutate();
      } catch {
        setPending((p) => ({ ...p, [k]: !next }));
      } finally {
        setPending((p) => {
          const { [k]: _drop, ...rest } = p;
          return rest;
        });
      }
    },
    [isAuthenticated, isWatched, mutate, showId],
  );

  if (ordered.length === 0) return null;

  const shown = episodes.slice(0, visible);
  const remaining = episodes.length - shown.length;
  const activeYear = parseTmdbDate(activeSeason?.air_date)?.y ?? null;

  /**
   * Both counts read from the season summary until the episode list lands, so
   * the header states a number on first paint instead of flashing "0 episodes ·
   * 0 watched" for the length of a fetch. Once the list is here it wins: it is
   * the accurate count, and counting through `isWatched` picks up an optimistic
   * tap that the cached per-season tally has not seen yet.
   */
  const activeCount =
    episodes.length > 0 ? episodes.length : (activeSeason?.episode_count ?? 0);
  const seenHere =
    episodes.length > 0
      ? episodes.filter((e) => isWatched(active, e.episode_number)).length
      : (watchedPerSeason.get(active) ?? 0);

  return (
    <div className="space-y-5">
      {/* Season rail. Horizontal scroll with snap is the whole mobile story:
          one card sits comfortably at 375px, the next peeks in to advertise
          that there is more, and 81 of them cost nothing the browser has to
          lay out at once. `no-scrollbar` because the row of posters is its own
          affordance. */}
      <div
        ref={railRef}
        className="no-scrollbar relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
      >
        {ordered.map((s) => {
          const total = s.episode_count ?? 0;
          const seen = Math.min(watchedPerSeason.get(s.season_number) ?? 0, total);
          const pct = total > 0 ? Math.round((seen / total) * 100) : 0;
          const year = parseTmdbDate(s.air_date)?.y ?? null;
          const isOpen = s.season_number === active;
          return (
            <button
              key={s.season_number}
              type="button"
              ref={(el) => {
                cardRefs.current[s.season_number] = el;
              }}
              onClick={() => setPicked(s.season_number)}
              aria-pressed={isOpen}
              className={`w-[104px] shrink-0 snap-start overflow-hidden rounded-xl border text-left transition-colors sm:w-[124px] ${
                isOpen
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-surface-800 bg-surface-900/40 hover:border-surface-600"
              }`}
            >
              <div className="relative aspect-[2/3] bg-surface-800">
                {s.poster_path ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`https://image.tmdb.org/t/p/w185${s.poster_path}`}
                    alt=""
                    loading="lazy"
                    className={`h-full w-full object-cover transition-opacity ${
                      isOpen ? "" : "opacity-70"
                    }`}
                  />
                ) : (
                  /* 42% of seasons have no poster. A numbered tile is a
                     recognisable object; an empty grey box is not. */
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="font-mono text-2xl tabular-nums text-surface-600">
                      {String(s.season_number).padStart(2, "0")}
                    </span>
                  </div>
                )}
                {total > 0 && seen > 0 && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-950/70">
                    <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
              <div className="px-2 py-1.5">
                <p
                  className={`truncate text-xs font-semibold ${
                    isOpen ? "text-brand-300" : "text-surface-300"
                  }`}
                >
                  {s.name?.trim() || `Season ${s.season_number}`}
                </p>
                <p className="truncate font-mono text-[10px] tabular-nums text-surface-500">
                  {year ? `${year} · ` : ""}
                  {total} ep{total === 1 ? "" : "s"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* The season itself */}
      {activeSeason && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900/40 p-4 sm:p-5">
          {/* Poster beside the heading on mobile too, at thumbnail size — it is
              what tells you which place you are standing in. */}
          <div className="flex gap-4">
            {activeSeason.poster_path && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`https://image.tmdb.org/t/p/w185${activeSeason.poster_path}`}
                alt=""
                className="hidden w-24 shrink-0 self-start rounded-lg sm:block"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-white">
                {activeSeason.name?.trim() || `Season ${activeSeason.season_number}`}
              </h3>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-surface-500">
                {activeYear ? `${activeYear} · ` : ""}
                {activeCount} episode{activeCount === 1 ? "" : "s"}
                {seenHere > 0 && (
                  <span className="text-brand-400">
                    {" · "}
                    {seenHere} watched
                  </span>
                )}
              </p>
              {/* Only a quarter of seasons carry one. The block below simply
                  is not there for the other three quarters.

                  `hlimit` bare, at its own 5-line default: overriding
                  `--max-line` would put an arbitrary-property utility and
                  `.hlimit` in the same cascade layer, and which one wins
                  depends on emission order rather than on anything written
                  here. Five lines is the house clamp; this is not the place to
                  find out whether it can be beaten. */}
              {activeSeason.overview?.trim() && (
                <p className="hlimit mt-3 text-sm leading-relaxed text-surface-400">
                  {activeSeason.overview}
                </p>
              )}
            </div>
          </div>

          {/* Episodes */}
          <div className="mt-5 space-y-2">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex animate-pulse gap-3 rounded-xl border border-surface-800/60 p-2.5"
                >
                  <div className="aspect-video w-24 shrink-0 rounded-lg bg-surface-800 sm:w-36" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3.5 w-2/3 rounded bg-surface-800" />
                    <div className="h-3 w-1/3 rounded bg-surface-800" />
                  </div>
                </div>
              ))}

            {!isLoading && episodes.length === 0 && (
              <p className="py-6 text-center text-sm text-surface-500">
                TMDB lists no episodes for this season.
              </p>
            )}

            {shown.map((ep) => {
              const on = isWatched(active, ep.episode_number);
              const date = parseTmdbDate(ep.air_date);
              const unaired = date != null && today != null && dayIndex(date) > dayIndex(today);
              const rating =
                typeof ep.vote_average === "number" && ep.vote_average > 0
                  ? ep.vote_average.toFixed(1)
                  : null;
              return (
                <div
                  key={ep.id}
                  className={`flex gap-3 rounded-xl border p-2.5 transition-colors ${
                    on
                      ? "border-brand-500/30 bg-brand-500/5"
                      : "border-surface-800/60 hover:border-surface-700"
                  }`}
                >
                  <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-surface-800 sm:w-36">
                    {ep.still_path ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                        alt=""
                        loading="lazy"
                        className={`h-full w-full object-cover ${on ? "" : "opacity-90"}`}
                      />
                    ) : (
                      /* Whole seasons come with no stills at all. The number is
                         the one field every episode has, so it becomes the
                         image rather than sitting under a "no image" label. */
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-mono text-lg tabular-nums text-surface-600">
                          {String(ep.episode_number).padStart(2, "0")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      <span className="font-mono text-xs tabular-nums text-surface-500">
                        E{String(ep.episode_number).padStart(2, "0")}
                      </span>{" "}
                      {ep.name?.trim() || "Untitled"}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-surface-500">
                      {date ? (
                        <time dateTime={toIso(date)}>{formatLongDate(date)}</time>
                      ) : (
                        "Air date TBA"
                      )}
                      {typeof ep.runtime === "number" && ep.runtime > 0 && ` · ${ep.runtime}m`}
                    </p>
                    {rating && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent-gold">
                        <Star className="size-3 fill-current" />
                        {rating}
                      </span>
                    )}
                  </div>

                  {/* One tap, same as the ribbon. Unaired episodes get a label
                      instead of a control, because there is nothing truthful to
                      record yet. */}
                  {unaired ? (
                    <span className="h-fit shrink-0 self-center rounded-lg bg-surface-800/70 px-2 py-1 text-[11px] font-medium text-surface-400">
                      Unaired
                    </span>
                  ) : (
                    isAuthenticated && (
                      <button
                        type="button"
                        onClick={() => toggle(active, ep.episode_number)}
                        aria-pressed={on}
                        aria-label={`Episode ${ep.episode_number}${on ? ", watched" : ", mark watched"}`}
                        className={`flex size-10 shrink-0 items-center justify-center self-center rounded-lg border transition-colors ${
                          on
                            ? "border-brand-500/40 bg-brand-500/20 text-brand-400 hover:bg-brand-500/30"
                            : "border-surface-700 bg-surface-800/60 text-surface-500 hover:text-surface-200"
                        }`}
                      >
                        <Check className="size-4" />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>

          {remaining > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setVisible((n) => n + MORE_STEP)}
                className="rounded-xl border border-surface-700 bg-surface-800/60 px-4 py-2 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-700"
              >
                Show {Math.min(remaining, MORE_STEP)} more
              </button>
              <Link
                href={`/app/tv/${showId}/season/${activeSeason.season_number}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-400 transition-colors hover:text-brand-300"
              >
                All {episodes.length} episodes
                <ChevronRight className="size-4" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
