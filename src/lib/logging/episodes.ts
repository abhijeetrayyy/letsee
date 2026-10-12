/**
 * The next episode of a series, for its primary action (docs/design/RETHINK.md
 * §8, "Episode tracking"): once you've started a show, the one thing you do
 * on its page is tick the episode you just watched. Plain functions, tested.
 *
 * "Next" is the first episode you haven't marked, in order, that has aired —
 * so a gap you skipped comes back first, specials (season 0) never count, and
 * an episode that hasn't aired yet is never offered. Past the last aired
 * episode you are caught up.
 */
export type SeasonInfo = { season_number: number; episode_count: number };
export type Ep = { s: number; e: number };

export const epKey = (s: number, e: number) => `${s}:${e}`;

function after(a: Ep, b: Ep): boolean {
  return a.s > b.s || (a.s === b.s && a.e > b.e);
}

/** Every regular episode in order, up to and including the last aired one. */
function aired(seasons: SeasonInfo[], lastAiredRaw: Ep | null): Ep[] {
  // TMDB sometimes names a special as the last episode to air; a special says
  // nothing about which regular episodes are out, so it is ignored.
  const lastAired = lastAiredRaw && lastAiredRaw.s > 0 ? lastAiredRaw : null;
  const out: Ep[] = [];
  for (const season of [...seasons].filter((x) => x.season_number > 0 && x.episode_count > 0).sort((a, b) => a.season_number - b.season_number)) {
    for (let e = 1; e <= season.episode_count; e++) {
      const ep = { s: season.season_number, e };
      if (lastAired && after(ep, lastAired)) return out;
      out.push(ep);
    }
  }
  return out;
}

export function nextEpisode(seasons: SeasonInfo[], watched: Set<string>, lastAired: Ep | null): Ep | null {
  return aired(seasons, lastAired).find((ep) => !watched.has(epKey(ep.s, ep.e))) ?? null;
}

/** How far through the aired episodes you are. */
export function progressOf(seasons: SeasonInfo[], watched: Set<string>, lastAired: Ep | null): { seen: number; aired: number } {
  const list = aired(seasons, lastAired);
  return { seen: list.filter((ep) => watched.has(epKey(ep.s, ep.e))).length, aired: list.length };
}

/** "S02 · E01". */
export function episodeLabel(ep: Ep): string {
  return `S${String(ep.s).padStart(2, "0")} · E${String(ep.e).padStart(2, "0")}`;
}

/**
 * The aired episodes before `target` you haven't marked, in order — what
 * "S01 E01–E04 aren't marked" offers after you tick E05 with gaps behind it
 * (docs/design/PAGES.md, the season page). Specials never count.
 */
export function earlierUnwatched(seasons: SeasonInfo[], watched: Set<string>, target: Ep, lastAired: Ep | null): Ep[] {
  return aired(seasons, lastAired).filter((ep) => after(target, ep) && !watched.has(epKey(ep.s, ep.e)));
}

/**
 * How to name a run of episodes in one short line: "S01 E03" for one,
 * "S01 E01–E04" for a run in one season with no gaps, otherwise a count
 * ("6 earlier episodes").
 */
export function rangeLabel(eps: Ep[]): string {
  if (!eps.length) return "";
  const code = (ep: Ep) => `E${String(ep.e).padStart(2, "0")}`;
  const season = `S${String(eps[0].s).padStart(2, "0")}`;
  if (eps.length === 1) return `${season} ${code(eps[0])}`;
  const oneSeason = eps.every((ep) => ep.s === eps[0].s);
  const contiguous = eps.every((ep, i) => i === 0 || ep.e === eps[i - 1].e + 1);
  if (oneSeason && contiguous) return `${season} ${code(eps[0])}–${code(eps[eps.length - 1])}`;
  return `${eps.length} earlier episodes`;
}

/**
 * Whether an episode is out: dated today or earlier, or — undated — no later
 * than the series' last aired episode. An undated episode past that is an
 * announcement, not something to tick.
 */
export function isOut(ep: Ep, airDate: string | null | undefined, lastAired: Ep | null, today: { y: number; m: number; d: number }): boolean {
  if (airDate) return !notOutYet(airDate, today);
  const last = lastAired && lastAired.s > 0 ? lastAired : null;
  return !!last && !after(ep, last);
}

/** Whether an air date (YYYY-MM-DD) is after today, in the reader's own day (`useToday`). */
export function notOutYet(airDate: string | null | undefined, today: { y: number; m: number; d: number }): boolean {
  if (!airDate) return false;
  const [y, m, d] = airDate.split("-").map(Number);
  if (!y || !m || !d) return false;
  return Date.UTC(y, m - 1, d) > Date.UTC(today.y, today.m - 1, today.d);
}

/**
 * Whether the episode button should lead: once you've started the show (any
 * episode marked, or the show set to Watching) and there is an aired episode
 * left. A show you haven't begun leads with Log it; a show you've caught up
 * on says so and leads with Log it again.
 */
export function leadsWithEpisode(watched: Set<string>, status: string | null, next: Ep | null): boolean {
  return !!next && (watched.size > 0 || status === "watching");
}

/**
 * Where you are: the control under a series' marks (ds/SeriesPosition). The
 * owner (11 Oct 2026): "I've watched this much" had to be said one episode
 * at a time, or in a modal three steps away; it should be one step. So a
 * season, a number, done — and the number means *through here*: every aired
 * episode up to it is watched, nothing past it is.
 */

/** Every aired regular episode up to and including `pos`. */
export function upTo(seasons: SeasonInfo[], pos: Ep, lastAired: Ep | null): Ep[] {
  return aired(seasons, lastAired).filter((ep) => !after(ep, pos));
}

/** The furthest aired episode you've marked, in order — or nothing. */
export function positionOf(seasons: SeasonInfo[], watched: Set<string>, lastAired: Ep | null): Ep | null {
  const list = aired(seasons, lastAired);
  for (let i = list.length - 1; i >= 0; i--) if (watched.has(epKey(list[i].s, list[i].e))) return list[i];
  return null;
}

/** Each regular season with how much of it is out and how much you've seen. */
export function seasonsOf(seasons: SeasonInfo[], watched: Set<string>, lastAired: Ep | null): { s: number; listed: number; aired: number; seen: number }[] {
  const out = aired(seasons, lastAired);
  return [...seasons]
    .filter((x) => x.season_number > 0 && x.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map((x) => {
      const mine = out.filter((ep) => ep.s === x.season_number);
      return { s: x.season_number, listed: x.episode_count, aired: mine.length, seen: mine.filter((ep) => watched.has(epKey(ep.s, ep.e))).length };
    });
}

/**
 * Whether you've reached an episode: it's marked, or something later is.
 * A reaction to it opens then (lib/people/reactions) — "as you catch up",
 * not only on the exact tick, so skipping an episode doesn't lock you out.
 */
export function reached(watched: Set<string>, s: number, e: number): boolean {
  if (watched.has(epKey(s, e))) return true;
  for (const k of watched) {
    const [ws, we] = k.split(":").map(Number);
    if (ws > 0 && (ws > s || (ws === s && we > e))) return true;
  }
  return false;
}
