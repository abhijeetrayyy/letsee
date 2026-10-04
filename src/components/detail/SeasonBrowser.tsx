"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { ArrowRight } from "lucide-react";
import EpisodeRow from "@components/ds/EpisodeRow";
import { swrFetcher } from "@/utils/swrFetcher";
import { parseTmdbDate } from "@/utils/person/dates";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { useToday } from "@/hooks/useToday";
import { fetchRoomList, type RoomPerson } from "@/lib/db/rooms";
import { peopleOnEpisodes } from "@/lib/db/episodes";
import { epKey, isOut, type Ep } from "@/lib/logging/episodes";
import { useEpisodeMarks } from "@components/tv/useEpisodeMarks";
import { seasonPath } from "@/utils/urls";

import Rail from "@components/ds/Rail";
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
 * Episodes are `EpisodeRow`s (docs/design/SYSTEM.md §8) and marking them goes
 * through `useEpisodeMarks`, the same as on the season page: no stills or
 * overviews for what you haven't watched, one check per row, faces of your
 * people who've seen each one, and "Mark E01–E04 too?" when you tick past a gap.
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
  runtime?: number | null;
  episode_type?: string | null;
};

/**
 * First render shows this many; the rest arrive a page at a time. Five, from
 * where you are: at eight a finished season alone was over a phone screen and
 * the series page ran to six (PAGES.md budgets four). The season page lists
 * every episode.
 */
const INITIAL_EPISODES = 5;

const code = (n: number) => `E${String(n).padStart(2, "0")}`;
const MORE_STEP = 24;

export default function SeasonBrowser({
  showId,
  showName,
  seasons,
  isAuthenticated,
  lastAired = null,
}: {
  showId: string | number;
  /** Only so the links it emits can carry a name. */
  showName?: string;
  seasons: SeasonSummary[];
  isAuthenticated: boolean;
  lastAired?: Ep | null;
}) {
  const id = String(showId);
  // Specials last: they are rarely where anyone starts.
  const ordered = useMemo(
    () =>
      [...(seasons ?? [])]
        .filter((s) => typeof s?.season_number === "number" && (s.episode_count ?? 0) > 0)
        .sort((a, b) => (a.season_number === 0 ? 1e6 : a.season_number) - (b.season_number === 0 ? 1e6 : b.season_number)),
    [seasons],
  );
  const infos = useMemo(() => ordered.map((s) => ({ season_number: s.season_number, episode_count: s.episode_count ?? 0 })), [ordered]);
  const marks = useEpisodeMarks(id, { seasons: infos, lastAired, enabled: isAuthenticated });

  const { user, status: authStatus } = useAuth();
  const me = user?.id ?? null;
  const { data: rooms } = useSWR(me ? ["rooms", me] : null, () => fetchRoomList(me!), { revalidateOnFocus: false });
  const yourPeople = useMemo<RoomPerson[]>(() => (rooms?.people ?? []).slice(0, 24).map((p) => p.person), [rooms]);
  const { data: theirs } = useSWR(yourPeople.length ? ["episode-people", id, "all", yourPeople.map((p) => p.id).join(",")] : null, () => peopleOnEpisodes(yourPeople, id), {
    revalidateOnFocus: false,
  });

  const [picked, setPicked] = useState<number | null>(null);
  // How many rows are open, per season: switching season starts it over.
  const [more, setMore] = useState<{ season: number | null; n: number }>({ season: null, n: INITIAL_EPISODES });
  const today = useToday();

  const watchedPerSeason = useMemo(() => {
    const counts = new Map<number, number>();
    for (const k of marks.watched) {
      const s = Number(k.split(":")[0]);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return counts;
  }, [marks.watched]);

  /**
   * Open on the season you are actually in.
   *
   * Landing on season 1 of a show you are eleven seasons into is the picker
   * asking you to find your own place every time. The season in progress is
   * the first one part-finished; failing that, the one after the last you
   * completed.
   *
   * Decided once, when your progress first arrives, on purpose. Recomputing
   * it would mean marking the last episode of a season slides the whole panel
   * to the next one while your finger is still on the button.
   */
  const [resume, setResume] = useState<number | null | undefined>(undefined);
  if (resume === undefined && marks.ready) {
    let inProgress: number | null = null;
    let lastTouched = -1;
    for (const s of ordered) {
      if (s.season_number === 0) continue;
      const seen = watchedPerSeason.get(s.season_number) ?? 0;
      if (seen > 0) lastTouched = s.season_number;
      if (inProgress === null && seen > 0 && seen < (s.episode_count ?? 0)) inProgress = s.season_number;
    }
    if (inProgress !== null) {
      setResume(inProgress);
    } else if (lastTouched >= 0) {
      const i = ordered.findIndex((s) => s.season_number === lastTouched);
      const after = ordered[i + 1];
      setResume(after && after.season_number !== 0 ? after.season_number : lastTouched);
    } else {
      setResume(null);
    }
  }

  const active = picked ?? resume ?? ordered[0]?.season_number ?? 1;
  const activeSeason = ordered.find((s) => s.season_number === active) ?? ordered[0];

  const { data: seasonData, isLoading } = useSWR<{ episodes?: Episode[] }>(
    ordered.length > 0 ? `/api/tv-season-episodes?showId=${encodeURIComponent(id)}&season=${active}` : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );
  const episodes = seasonData?.episodes ?? [];

  const visible = more.season === active ? more.n : INITIAL_EPISODES;

  /**
   * Open the list where you are, not at E01. Halfway through a season the
   * first rows are episodes you've seen; the list starts one before the first
   * you haven't, with the ones above folded into a line. Decided once per
   * season, like `resume`, so ticking an episode doesn't slide the rows out
   * from under your finger.
   */
  const [from, setFrom] = useState<{ season: number; start: number } | null>(null);
  // Only once your progress is in — or once we know you're signed out. Before
  // the session has been read, "not signed in" just means "not yet".
  if (episodes.length > 0 && (marks.ready || authStatus === "anon") && from?.season !== active) {
    const firstUnseen = isAuthenticated ? episodes.findIndex((e) => !marks.isWatched(active, e.episode_number)) : -1;
    setFrom({ season: active, start: firstUnseen > 1 ? firstUnseen - 1 : 0 });
  }
  const start = from?.season === active ? from.start : 0;

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

  if (ordered.length === 0) return null;

  const shown = episodes.slice(start, start + visible);
  const remaining = episodes.length - start - shown.length;
  const activeYear = parseTmdbDate(activeSeason?.air_date)?.y ?? null;

  /**
   * Both counts read from the season summary until the episode list lands, so
   * the header states a number on first paint instead of flashing "0 episodes ·
   * 0 watched" for the length of a fetch. Once the list is here it wins: it is
   * the accurate count, and counting through `isWatched` picks up an optimistic
   * tap that the cached per-season tally has not seen yet.
   */
  const activeCount = episodes.length > 0 ? episodes.length : (activeSeason?.episode_count ?? 0);
  const seenHere =
    episodes.length > 0
      ? episodes.filter((e) => marks.isWatched(active, e.episode_number)).length
      : (watchedPerSeason.get(active) ?? 0);
  const seasonName = (s: SeasonSummary) => s.name?.trim() || (s.season_number === 0 ? "Specials" : `Season ${s.season_number}`);

  return (
    <div className="flex flex-col gap-5">
      {/* Season rail. Horizontal scroll with snap is the whole mobile story:
          one card sits comfortably at 375px, the next peeks in to advertise
          that there is more, and 81 of them cost nothing the browser has to
          lay out at once. */}
      {ordered.length > 1 && (
        <Rail>
          <div ref={railRef} className="no-scrollbar relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
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
                  className="group w-22 shrink-0 snap-start text-left sm:w-26"
                >
                  <div
                    className={`relative aspect-2/3 overflow-hidden rounded-media bg-raised transition-opacity ${
                      isOpen ? "ring-2 ring-ink-0" : "opacity-60 ring-1 ring-inset ring-line group-hover:opacity-100"
                    }`}
                  >
                    {s.poster_path ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`https://image.tmdb.org/t/p/w185${s.poster_path}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      /* 42% of seasons have no poster. A numbered tile is a
                         recognisable object; an empty grey box is not. */
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-mono text-2xl tabular-nums text-ink-500">
                          {s.season_number === 0 ? "SP" : String(s.season_number).padStart(2, "0")}
                        </span>
                      </div>
                    )}
                    {total > 0 && seen > 0 && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-page/70">
                        <div className="h-full bg-action" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <p className={`mt-1.5 truncate text-xs font-medium ${isOpen ? "text-ink-0" : "text-ink-400"}`}>{seasonName(s)}</p>
                  <p className="truncate font-mono text-xs tabular-nums text-ink-500">
                    {seen > 0 ? `${seen} of ${total}` : (year ?? `${total} eps`)}
                  </p>
                </button>
              );
            })}
          </div>
        </Rail>
      )}

      {/* The season itself */}
      {activeSeason && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-lg font-semibold text-ink-0">{seasonName(activeSeason)}</h3>
            <p className="font-mono text-xs tabular-nums text-ink-500">
              {activeYear ? `${activeYear} · ` : ""}
              {activeCount} episode{activeCount === 1 ? "" : "s"}
              {isAuthenticated && seenHere > 0 && <span className="text-ink-200">{` · ${seenHere} watched`}</span>}
            </p>
          </div>
          {/* Only a quarter of seasons carry an overview; for the rest this
              block simply is not there. */}
          {activeSeason.overview?.trim() && <p className="line-clamp-3 text-sm leading-relaxed text-ink-400">{activeSeason.overview}</p>}

          {isLoading ? (
            <div className="flex flex-col" aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex min-h-11 items-center gap-3 border-b border-line py-2">
                  <div className="h-3 w-8 rounded bg-raised" />
                  <div className="h-4 flex-1 rounded bg-raised" />
                  <div className="size-11 rounded-full bg-raised" />
                </div>
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <p className="py-4 text-sm text-ink-500">TMDB lists no episodes for this season yet.</p>
          ) : (
            <ol className="flex flex-col">
              {start > 0 && (
                <li className="border-b border-line">
                  {/* Opens the earlier rows above the ones on screen — the window
                      grows to cover both, so the next episode stays in view — and
                      keeps focus in the list, on the first row it brought back. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      const list = e.currentTarget.closest("ol");
                      setFrom({ season: active, start: 0 });
                      setMore({ season: active, n: start + visible });
                      requestAnimationFrame(() => list?.querySelector<HTMLElement>("li button, li a")?.focus());
                    }}
                    className="flex min-h-11 w-full items-center gap-2 py-2 text-left text-sm text-ink-400 transition-colors hover:text-ink-0"
                  >
                    <span className="font-mono text-xs tabular-nums text-ink-500">
                      {code(episodes[0].episode_number)}
                      {start > 1 ? `–${code(episodes[start - 1].episode_number)}` : ""}
                    </span>
                    {isAuthenticated ? "Watched" : "Earlier"} · show
                  </button>
                </li>
              )}
              {shown.map((ep) => (
                <EpisodeRow
                  key={ep.id}
                  showId={id}
                  showName={showName}
                  season={active}
                  ep={ep}
                  signedIn={isAuthenticated}
                  watched={marks.isWatched(active, ep.episode_number)}
                  busy={epKey(active, ep.episode_number) in marks.pending}
                  notOut={today ? !isOut({ s: active, e: ep.episode_number }, ep.air_date, lastAired, today) : false}
                  people={(theirs?.get(epKey(active, ep.episode_number)) ?? []).map((p) => ({ username: p.username, avatarUrl: p.avatarUrl }))}
                  onToggle={() => void marks.toggle({ s: active, e: ep.episode_number })}
                />
              ))}
            </ol>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setMore({ season: active, n: visible + MORE_STEP })}
                className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
              >
                Show {Math.min(remaining, MORE_STEP)} more
              </button>
            )}
            <Link
              href={seasonPath(showId, activeSeason.season_number, showName)}
              className="inline-flex items-center gap-1 text-sm font-medium text-ink-300 transition-colors hover:text-ink-0"
            >
              Open {seasonName(activeSeason)}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
