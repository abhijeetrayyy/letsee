/**
 * A room for a series (docs/IDEAS_2026-10.md §6.1): where everyone in a group
 * is in the show they're watching together, and the next episode they can all
 * watch — the one after whoever's furthest behind. Plain functions, tested.
 */
import { nextEpisode, positionOf, upTo, type Ep, type SeasonInfo } from "@/lib/logging/episodes";

export type Seat<P> = { person: P; at: Ep | null; seen: number };

/**
 * Everyone's seat, furthest along first, with how far that is in aired
 * episodes; the slowest, and the next episode you can all watch together.
 */
export function whosWhere<P>(
  members: { person: P; watched: Set<string> }[],
  seasons: SeasonInfo[],
  lastAired: Ep | null,
): { seats: Seat<P>[]; aired: number; together: Ep | null; started: number } {
  const aired = upTo(seasons, { s: Number.MAX_SAFE_INTEGER, e: 0 }, lastAired).length;
  const seats = members
    .map((m) => {
      const at = positionOf(seasons, m.watched, lastAired);
      return { person: m.person, at, seen: at ? upTo(seasons, at, lastAired).length : 0 };
    })
    .sort((a, b) => b.seen - a.seen);
  const started = seats.filter((s) => s.at).length;
  // The episode after the slowest person's place: the next one nobody has to wait for.
  const slowest = seats.length ? seats[seats.length - 1] : null;
  const behind = slowest?.at ? new Set(upTo(seasons, slowest.at, lastAired).map((e) => `${e.s}:${e.e}`)) : new Set<string>();
  const together = seats.length ? nextEpisode(seasons, behind, lastAired) : null;
  return { seats, aired, together, started };
}
