/**
 * One series on a profile's Series progress, said in one line, and whether
 * its row offers the next-episode check. Plain functions, tested
 * (tests/unit/series-progress.test.ts).
 */
import { episodeLabel } from "./episodes";
import { statusWord, type Status } from "./titleState";

export type SeriesProgress = {
  episodes_watched: number;
  total_episodes: number;
  next_season: number | null;
  next_episode: number | null;
  all_complete: boolean;
  caught_up: boolean;
  next_air_date: string | null;
  tv_status: string | null;
};

function airsOn(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
}

/** Started means an episode marked, or the show set to Watching — the series page's rule too. */
export function hasStarted(p: SeriesProgress): boolean {
  return p.episodes_watched > 0 || p.tv_status === "watching";
}

/** "Next S02 · E03", "Caught up · next airs 12 Mar", "Finished", "Want to watch · 62 episodes" — plus Stopped when it applies. */
export function seriesLine(p: SeriesProgress): string {
  const word = p.tv_status ? statusWord(p.tv_status as Status) : null;
  if (!hasStarted(p)) return [word ?? "Not started", `${p.total_episodes} ${p.total_episodes === 1 ? "episode" : "episodes"}`].join(" · ");
  const where = p.all_complete
    ? "Finished"
    : p.caught_up
      ? p.next_air_date
        ? `Caught up · next airs ${airsOn(p.next_air_date)}`
        : "Caught up"
      : p.next_season && p.next_episode
        ? `Next ${episodeLabel({ s: p.next_season, e: p.next_episode })}`
        : null;
  // Watching and Watched are what the line already says; Stopped and Want to watch are not.
  return [where, word && word !== "Watching" && word !== "Watched" ? word : null].filter(Boolean).join(" · ");
}

/** The row's check: your own profile, a show you're inside of, with an aired episode left. */
export function offersNextCheck(p: SeriesProgress, isOwner: boolean): boolean {
  return isOwner && hasStarted(p) && !p.all_complete && !p.caught_up && !!p.next_season && !!p.next_episode;
}
