import { cache } from "react";
import { unstable_cache } from "next/cache";
import { tmdbFetchJson } from "@/utils/tmdb";

/**
 * Two calls, and the second one is optional.
 *
 * The throttle dictates the shape. `fetchTmdb` awaits `waitForSlot()` BEFORE
 * every request regardless of cache state, so the 120ms gap is paid even on a
 * warm Data Cache hit. That makes a wide fan-out expensive in a way that
 * caching the *response* does not fix — only caching the whole computation
 * does.
 */

const DAY = 86400;
const WEEK = 604800;

/**
 * Call A. One request, and `cache()` so it is made once per render.
 *
 * It was previously issued twice — once in `generateMetadata`, once in the
 * page — which is two throttle slots and two parses of a payload measured at
 * up to 395KB for Spielberg.
 *
 * `movie_credits`/`tv_credits` are deliberately not appended: verified across
 * twelve people that `combined_credits` is a strict union of both by credit_id
 * and a field superset, so adding them takes Cruise from 143KB to 391KB for
 * nothing. `tagged_images` (posters only, broken paging) and `changes`/`latest`
 * (empty or silently ignored) are likewise omitted.
 */
export const getPerson = cache(async (id: string) => {
  const res = await tmdbFetchJson<Record<string, any>>(
    `https://api.themoviedb.org/3/person/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US&append_to_response=external_ids,combined_credits,images`,
    "Person",
    { revalidate: DAY },
  );
  return res.data ?? null;
});

export type TitleGraph = {
  id: number;
  mediaType: "movie" | "tv";
  /** Top-billed only — beyond ~15 it is spear-carriers, and they flood the counter. */
  cast: { id: number; name: string; profile_path: string | null; order: number }[];
  crew: { id: number; name: string; profile_path: string | null; job: string }[];
  video: { key: string; name: string; type: string; official: boolean } | null;
};

/** The jobs worth counting as a collaboration. Unrestricted, every gaffer wins. */
const CREW_JOBS = new Set([
  "Director", "Screenplay", "Writer", "Story", "Producer", "Executive Producer",
  "Director of Photography", "Editor", "Original Music Composer", "Production Design",
]);

/**
 * One title's people and one trailer, reduced before it is cached.
 *
 * Cached PER TITLE and called un-nested, which is the whole point: an
 * `unstable_cache` function invoked inside another one does not read its own
 * entry, so nesting these under a per-person wrapper would have re-fetched all
 * fourteen titles on every person-page miss and shared nothing. Flat, a
 * blockbuster seeded by twenty different actors is fetched once a week in
 * total.
 *
 * Only the reduction is stored — Inception's raw credits are 206KB, and what
 * survives here is a few hundred bytes.
 */
export const getTitleGraph = (mediaType: "movie" | "tv", id: number) =>
  unstable_cache(
    async (): Promise<TitleGraph | null> => {
      const url =
        mediaType === "movie"
          ? `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos`
          : // NEVER aggregate_credits: measured 143KB vs 9.6KB on Breaking Bad,
            // and the extra is every guest star in every season.
            `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos`;

      const res = await tmdbFetchJson<any>(url, "Title graph", { revalidate: WEEK });
      const d = res.data;
      if (!d) return null;

      const vids: any[] = d.videos?.results ?? [];
      const yt = vids.filter((v) => v.site === "YouTube" && v.key);
      const pick =
        yt.find((v) => v.official && v.type === "Trailer") ??
        yt.find((v) => v.official && v.type === "Teaser") ??
        yt.find((v) => v.type === "Trailer") ??
        yt.find((v) => v.type === "Featurette") ??
        null;

      return {
        id,
        mediaType,
        cast: (d.credits?.cast ?? []).slice(0, 15).map((c: any) => ({
          id: c.id, name: c.name, profile_path: c.profile_path ?? null, order: c.order ?? 99,
        })),
        crew: (d.credits?.crew ?? [])
          .filter((c: any) => CREW_JOBS.has(c.job))
          .map((c: any) => ({ id: c.id, name: c.name, profile_path: c.profile_path ?? null, job: c.job })),
        video: pick ? { key: pick.key, name: pick.name, type: pick.type, official: Boolean(pick.official) } : null,
      };
    },
    ["person-title-graph", mediaType, String(id)],
    { revalidate: WEEK, tags: [`title-graph-${mediaType}-${id}`] },
  )();

/**
 * Issue the fan-out in bounded waves.
 *
 * A bare `Promise.all` is wrong here for a subtle reason: `waitForSlot()` reads
 * `inFlight` before the caller increments it, so a simultaneous batch all
 * observes zero in flight and takes the fast path — a 142-call batch measured
 * peak concurrency 142 against a nominal cap of 8. Explicit waves are correct
 * under that bug and stay correct if it is ever fixed.
 */
export async function inWaves<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}
