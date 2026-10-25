import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { tmdbConfigured } from "@/utils/tmdbClient";
import { guard } from "@/lib/limits/guard";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";
import { seriesRuntime } from "@/utils/title/seriesRuntime";
import type { SeasonRuntime } from "@/utils/title/glance";

/**
 * GET /api/series-runtime?id= — how long a series runs, season by season, for
 * the series page's "49 hours to watch it all" and "9 hours left".
 *
 * Asked for by the page's at-a-glance tiles in the browser, not in the page
 * build: summing every season meant one TMDB call per season, and the build
 * waited for the slowest — Grey's Anatomy, 23 seasons, some at 0.55–1.09s
 * (Vercel request log, 25 Oct 2026). Nothing about you in it, so it's cached at
 * the edge for everyone, and the answer itself for a week (seriesRuntime).
 */
export type SeriesRuntimeResponse = { runtimes: SeasonRuntime[] | null };

type Show = {
  last_episode_to_air?: { season_number?: number; episode_number?: number } | null;
  seasons?: { season_number: number; episode_count?: number | null; name?: string }[];
};

export async function GET(request: NextRequest) {
  const limited = await guard("tmdb", request);
  if (limited) return limited;
  if (!tmdbConfigured()) return jsonError("TMDB_READ_TOKEN is missing on the server.", 500);

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return jsonError("Missing or invalid show id.", 400);

  const show = (await getTvShowWithSeasons(id)) as Show | null;
  if (!show) return jsonError("Couldn't load that show.", 502);

  const last = show.last_episode_to_air;
  const lastAired = last?.season_number != null && last.episode_number != null ? { s: last.season_number, e: last.episode_number } : null;
  // The same seasons the series page lists: no specials.
  const seasons = (show.seasons ?? []).filter((s) => s.name !== "Specials");
  const runtimes = await seriesRuntime(id, seasons, lastAired);

  const body: SeriesRuntimeResponse = { runtimes };
  return jsonSuccess(body, { maxAge: 43200, staleWhileRevalidate: 86400 });
}
