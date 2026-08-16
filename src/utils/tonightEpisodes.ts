/**
 * "We've got 45 minutes" — the next episode of something you're both mid-way
 * through.
 *
 * This is the case Letterboxd structurally cannot serve: their atomic unit is
 * one person logging one film. It's also the single most common real answer to
 * "what are we watching" on a weeknight, and until now Tonight couldn't give
 * it — the resolver only knew how to suggest whole titles.
 *
 * ── The rule that matters ───────────────────────────────────────────────────
 * When two people are at different points in a show, the group's next episode
 * is the one the person **furthest behind** hasn't seen. Watching A's next
 * episode when B is two behind doesn't just skip B's episodes — it spoils
 * them. So the episode is chosen by minimum progress across the room, the same
 * "protect whoever is worst served" principle the taste-fit score uses.
 *
 * ── Why this needs a season fetch ───────────────────────────────────────────
 * /api/continue-watching computes a next episode from season *summaries*
 * (episode_count) and therefore cannot tell an aired episode from an unaired
 * one, or know an episode's runtime. Both matter here: a runtime budget is the
 * whole point of the question, and offering an episode that doesn't exist yet
 * is worse than offering nothing. So this fetches the actual season.
 */

import type { createClient } from "@/utils/supabase/server";
import { getSeasonEpisodes, getTvShowWithSeasons } from "@/utils/tmdbTvShow";
import type { TonightParticipant } from "@/utils/tonight";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Shows considered per resolve. Each costs a show fetch plus a season fetch. */
const MAX_SHOWS = 6;

export type EpisodePick = {
  showId: string;
  showName: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  stillPath: string | null;
  overview: string;
  runtime: number | null;
  genres: string[];
  /** Participants who have this show as `watching`. */
  watchedBy: string[];
  /** How many episodes the furthest-behind participant has seen. */
  progress: number;
};

type SeasonSummary = { season_number?: number; episode_count?: number };
type TmdbEpisode = {
  episode_number?: number;
  name?: string;
  air_date?: string;
  runtime?: number;
  still_path?: string | null;
  overview?: string;
};

function hasAired(airDate: string | undefined): boolean {
  if (!airDate) return false;
  // Date-only comparison: an episode airing today counts as available.
  return new Date(`${airDate}T00:00:00Z`).getTime() <= Date.now();
}

/**
 * Shows the room is jointly mid-way through, with the episode to play next.
 *
 * Ordered by how much of the room is watching, then by how far in they are —
 * a show two people are deep into is a better answer than one person's
 * half-forgotten pilot.
 */
export async function findEpisodePicks(
  supabase: SupabaseClient,
  participants: TonightParticipant[],
  maxRuntime: number | null,
  rejected: Set<string>,
): Promise<EpisodePick[]> {
  const userIds = participants.map((p) => p.userId);

  const { data: watching, error } = await supabase
    .from("user_media_status")
    .select("user_id, item_id, item_name, image_url, genres")
    .in("user_id", userIds)
    .eq("item_type", "tv")
    .eq("status", "watching");

  if (error || !watching || watching.length === 0) return [];

  // Group by show, keeping who in the room is watching it.
  type ShowMeta = { name: string; image: string | null; genres: string[]; watchers: string[] };
  const shows = new Map<string, ShowMeta>();
  for (const row of watching) {
    const showId = String(row.item_id);
    if (rejected.has(showId)) continue;
    const entry: ShowMeta = shows.get(showId) ?? {
      name: row.item_name ?? "",
      image: row.image_url ?? null,
      genres: Array.isArray(row.genres) ? row.genres : [],
      watchers: [],
    };
    entry.watchers.push(row.user_id as string);
    if (!entry.name && row.item_name) entry.name = row.item_name;
    shows.set(showId, entry);
  }

  if (shows.size === 0) return [];

  const candidates = [...shows.entries()]
    .sort((a, b) => b[1].watchers.length - a[1].watchers.length)
    .slice(0, MAX_SHOWS);

  const showIds = candidates.map(([id]) => id);

  // One query for everyone's episode history across all candidate shows.
  const { data: episodeRows } = await supabase
    .from("watched_episodes")
    .select("user_id, show_id, season_number, episode_number")
    .in("user_id", userIds)
    .in("show_id", showIds);

  const seenByUserShow = new Map<string, Set<string>>();
  for (const row of episodeRows ?? []) {
    if (Number(row.season_number) <= 0) continue; // specials aren't "next up"
    const key = `${row.user_id}::${row.show_id}`;
    const set = seenByUserShow.get(key) ?? new Set<string>();
    set.add(`${row.season_number},${row.episode_number}`);
    seenByUserShow.set(key, set);
  }

  const picks = await Promise.all(
    candidates.map(([showId, meta]) => resolveShow(showId, meta, participants, seenByUserShow)),
  );

  return picks
    .filter((p): p is EpisodePick => p !== null)
    .filter((p) => !maxRuntime || !p.runtime || p.runtime <= maxRuntime)
    .sort((a, b) => b.watchedBy.length - a.watchedBy.length || b.progress - a.progress);
}

async function resolveShow(
  showId: string,
  meta: { name: string; image: string | null; genres: string[]; watchers: string[] },
  participants: TonightParticipant[],
  seenByUserShow: Map<string, Set<string>>,
): Promise<EpisodePick | null> {
  const show = await getTvShowWithSeasons(showId);
  if (!show) return null;

  const seasons = (Array.isArray(show.seasons) ? show.seasons : []) as SeasonSummary[];
  const ordered = seasons
    .map((s) => ({ number: Number(s.season_number), count: Number(s.episode_count) || 0 }))
    .filter((s) => Number.isInteger(s.number) && s.number > 0 && s.count > 0)
    .sort((a, b) => a.number - b.number);

  if (ordered.length === 0) return null;

  /**
   * The furthest-behind watcher decides. Anyone in the room who hasn't started
   * the show at all is ignored rather than dragging the group back to the
   * pilot — they can join mid-run, but nobody already watching gets skipped
   * past.
   */
  let target: { season: number; episode: number } | null = null;
  let minProgress = Infinity;

  for (const userId of meta.watchers) {
    const seen = seenByUserShow.get(`${userId}::${showId}`) ?? new Set<string>();
    if (seen.size === 0) continue;

    let next: { season: number; episode: number } | null = null;
    for (const season of ordered) {
      for (let ep = 1; ep <= season.count; ep += 1) {
        if (!seen.has(`${season.number},${ep}`)) {
          next = { season: season.number, episode: ep };
          break;
        }
      }
      if (next) break;
    }
    // No `next` means that person has finished everything released — they
    // can't be the one holding the group back.
    if (!next) continue;

    if (seen.size < minProgress) {
      minProgress = seen.size;
      target = next;
    }
  }

  if (!target || minProgress === Infinity) return null;

  // Now the actual season, for runtime and air date.
  const season = await getSeasonEpisodes(showId, target.season);
  const episodes = (Array.isArray(season?.episodes) ? season.episodes : []) as TmdbEpisode[];
  const episode = episodes.find((e) => Number(e.episode_number) === target.episode);

  // An episode TMDB doesn't list, or one that hasn't aired, is not an answer.
  if (!episode || !hasAired(episode.air_date)) return null;

  return {
    showId,
    showName: (show.name as string) ?? meta.name,
    posterPath: (show.poster_path as string) ?? meta.image,
    seasonNumber: target.season,
    episodeNumber: target.episode,
    episodeName: episode.name ?? `Episode ${target.episode}`,
    stillPath: episode.still_path ?? null,
    overview: episode.overview ?? "",
    runtime: Number.isFinite(episode.runtime) && episode.runtime! > 0 ? episode.runtime! : null,
    genres: Array.isArray(show.genres)
      ? (show.genres as { name?: string }[]).map((g) => g.name ?? "").filter(Boolean)
      : meta.genres,
    watchedBy: meta.watchers,
    progress: minProgress,
  };
}

/** The evidence line for an episode pick. */
export function buildEpisodeReason(
  pick: EpisodePick,
  participants: TonightParticipant[],
): string {
  const names = pick.watchedBy
    .map((id) => participants.find((p) => p.userId === id)?.username)
    .filter((n): n is string => !!n);

  const where = `S${pick.seasonNumber}E${pick.episodeNumber}`;

  if (participants.length > 1 && names.length >= 2) {
    return `You're both partway through ${pick.showName} — ${where} is next for whoever's behind.`;
  }
  if (participants.length > 1 && names.length === 1) {
    return `${names[0]} is partway through ${pick.showName}. ${where} is next.`;
  }
  return `You're ${pick.progress} ${pick.progress === 1 ? "episode" : "episodes"} into ${pick.showName}. ${where} is next.`;
}
