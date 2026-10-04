import { unstable_cache } from "next/cache";
import { fetchTmdb } from "@/utils/tmdbClient";
import { seasonRuntimes, type Ep, type SeasonRuntime } from "@/utils/title/glance";

/**
 * How long a series actually runs, season by season — for "49 hours to watch
 * it all" and "9 hours left".
 *
 * The show payload can't say. `episode_run_time` is empty on most shows now,
 * and `last_episode_to_air.runtime` is one episode — often a finale: Stranger
 * Things' is 129 minutes, which times 42 episodes would claim 90 hours. The
 * season payloads carry every episode's own runtime.
 *
 * What is cached is the answer, not the seasons. A season payload is 50–150KB
 * of guest stars and crew, and caching each one is a data-cache write per
 * season per regeneration — the ISR write units this app has spent months
 * cutting. So the seasons are fetched uncached and only the result — a few
 * numbers per season — is kept, for a week, keyed on the last aired episode:
 * a new episode is a new key, so the total moves when the show does.
 *
 * Capped: past 30 seasons (Coronation Street has 68) the fetches stop being
 * cheap, and the tile is simply left out.
 */
const MAX_SEASONS = 30;
const WEEK = 604800;

type SeasonPayload = { episodes?: { episode_number: number; runtime?: number | null }[] } | null;

/** Some seasons didn't load: the answer is still worth showing, but not worth keeping for a week. */
class Partial extends Error {
  constructor(readonly result: SeasonRuntime[] | null) {
    super("series runtime: partial");
  }
}

async function measure(showId: string, list: { season_number: number; episode_count?: number | null }[], lastAired: Ep) {
  const key = process.env.TMDB_API_KEY;
  const payloads: SeasonPayload[] = await Promise.all(
    list.map((s) =>
      fetchTmdb(`https://api.themoviedb.org/3/tv/${showId}/season/${s.season_number}?api_key=${key}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<SeasonPayload>) : null))
        .catch(() => null),
    ),
  );
  // Nothing came back: TMDB is down or refusing. Throwing keeps that out of
  // the cache, so the next render tries again rather than a week from now.
  if (payloads.every((p) => !p)) throw new Error("series runtime: no season loaded");
  const result = seasonRuntimes(
    list.map((s, i) => ({ s: s.season_number, count: s.episode_count ?? 0, episodes: payloads[i]?.episodes ?? null })),
    lastAired,
  );
  // Thrown, so unstable_cache keeps nothing; caught below and shown this once.
  if (payloads.some((p) => !p)) throw new Partial(result);
  return result;
}

export async function seriesRuntime(
  showId: string,
  seasons: { season_number: number; episode_count?: number | null }[],
  lastAired: Ep | null,
): Promise<SeasonRuntime[] | null> {
  if (!lastAired || !process.env.TMDB_API_KEY) return null;
  // A special as the last episode out says nothing about the regular ones —
  // read it as "everything listed has aired", as progressOf does.
  if (lastAired.s <= 0) {
    const regular = seasons.filter((s) => s.season_number > 0 && (s.episode_count ?? 0) > 0);
    const top = regular.reduce<{ season_number: number; episode_count?: number | null } | null>((a, s) => (!a || s.season_number > a.season_number ? s : a), null);
    if (!top) return null;
    lastAired = { s: top.season_number, e: top.episode_count ?? 0 };
  }
  const last = lastAired;
  const list = seasons.filter((s) => s.season_number > 0 && s.season_number <= last.s && (s.episode_count ?? 0) > 0);
  if (list.length === 0 || list.length > MAX_SEASONS) return null;
  try {
    return await unstable_cache(() => measure(showId, list, last), ["series-runtime", showId, `${last.s}x${last.e}`], {
      revalidate: WEEK,
    })();
  } catch (e) {
    return e instanceof Partial ? e.result : null;
  }
}
