/**
 * Where someone you live with is in a series, beside where you are
 * (docs/IDEAS_2026-10.md §4.4) — "priya's at S02·E02, 2 behind you" — so
 * "shall we watch the next one?" has an answer before anyone asks.
 */
import { episodeLabel, upTo, type Ep, type SeasonInfo } from "@/lib/logging/episodes";

export function householdLine(name: string, theirs: Ep | null, mine: Ep | null, seasons: SeasonInfo[], lastAired: Ep | null): string {
  if (!theirs) return mine ? `${name} hasn't started it` : `Neither of you has started it`;
  const at = `${name}'s at ${episodeLabel(theirs)}`;
  if (!mine) return at;
  const gap = upTo(seasons, theirs, lastAired).length - upTo(seasons, mine, lastAired).length;
  if (gap === 0) return `${name}'s with you at ${episodeLabel(theirs)}`;
  const n = Math.abs(gap);
  return `${at} — ${n} ${n === 1 ? "episode" : "episodes"} ${gap < 0 ? "behind you" : "ahead"}`;
}
