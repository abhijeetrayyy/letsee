/**
 * A series' cast and crew, reduced before anything is cached.
 *
 * `aggregate_credits` is nearly the whole weight of a series payload. Measured
 * on Law & Order: SVU it is 2.6MB of a 2.7MB response, against 89KB for every
 * other key the detail page appends. Appended, it took that response past
 * Next's 2MB data-cache limit — 3.7MB as Next measures it, body base64'd — so
 * the page's main fetch was never cached, ran twice per render (metadata and
 * page; the abort signal in tmdbClient opts out of Next's in-request dedupe),
 * and logged its full URL on every failed write.
 *
 * Fetched on its own and reduced here, what gets cached is the ranked rows the
 * page renders rather than every guest star of twenty-seven seasons. Inside
 * `unstable_cache` Next treats the fetch as no-store, so the raw body never
 * attempts the data cache at all.
 */
import { unstable_cache } from "next/cache";
import { tmdbFetchJson, type TmdbResult } from "@/utils/tmdb";
import { seriesCast, type AggregateCastEntry, type SeriesCastMember } from "@/utils/title/tvCast";
import { seriesCrew, type AggregateCrewEntry, type SeriesCrewMember } from "@/utils/title/tvCrew";

export type SeriesPeople = {
  cast: SeriesCastMember[];
  crew: SeriesCrewMember[];
};

type AggregateCredits = { cast?: AggregateCastEntry[]; crew?: AggregateCrewEntry[] };

/**
 * Empty arrays mean TMDB holds no aggregate for the show; callers fall back to
 * the `credits` stub exactly as `seriesCast` and `seriesCrew` would have.
 *
 * `revalidate` is the caller's, not fixed here, because `unstable_cache`
 * lowers the enclosing page's ISR window to its own — a shorter one here
 * would cost the cast page writes its own fetches deliberately avoid.
 */
export async function getSeriesPeople(
  id: string,
  { castLimit, crewPerDepartment, revalidate }: { castLimit: number; crewPerDepartment: number; revalidate: number },
): Promise<TmdbResult<SeriesPeople>> {
  try {
    const data = await unstable_cache(
      async (): Promise<SeriesPeople> => {
        const { data: credits, error } = await tmdbFetchJson<AggregateCredits>(
          `https://api.themoviedb.org/3/tv/${id}/aggregate_credits?language=en-US`,
          "TV aggregate credits",
          { cache: "no-store" },
        );
        // Thrown, not returned: `unstable_cache` keeps whatever resolves, and
        // an empty cast held for a whole window is worse than another request.
        if (!credits) throw new Error(error ?? "TV aggregate credits: no data");
        return {
          cast: seriesCast(credits, undefined, castLimit),
          crew: seriesCrew(credits, undefined, crewPerDepartment),
        };
      },
      ["tv-series-people-v1", id, String(castLimit), String(crewPerDepartment)],
      { revalidate },
    )();
    return { data };
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }
}
