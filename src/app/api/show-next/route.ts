import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { tmdbConfigured } from "@/utils/tmdbClient";
import { guard } from "@/lib/limits/guard";

/**
 * Runs in Washington, next to TMDB, not in Seoul with the database (vercel.json):
 * this is TMDB work, and a TMDB call from Seoul measured ~0.5s (25 Oct 2026).
 */
export const preferredRegion = "iad1";

/**
 * GET /api/show-next?id=  — a series' next episode to air, whether it's
 * still going, and its seasons (for where everyone is in a series room). For "S3 returns 14 Nov" on a show you put on hold
 * (docs/IDEAS_2026-10.md §5.2): a paused show with a date is one you keep,
 * not one you drop.
 *
 * Nothing about you in it, so it's cached at the edge for everyone: TMDB
 * hears from this route about a show once per half-day, whoever asks. Each
 * on-hold row asks only for its own show, and only when shown.
 */
type Show = {
  status?: string;
  next_episode_to_air?: { season_number?: number; episode_number?: number; air_date?: string | null } | null;
  last_episode_to_air?: { season_number?: number; episode_number?: number } | null;
  seasons?: { season_number?: number; episode_count?: number }[];
};

export type ShowNext = {
  next: { s: number; e: number; airDate: string } | null;
  /** TMDB's "Returning Series", "Ended", "Canceled", "In Production"… */
  status: string | null;
  /** The seasons and the last aired episode — where everyone is in a series room (rooms/SeriesTogether). */
  seasons: { season_number: number; episode_count: number }[];
  lastAired: { s: number; e: number } | null;
};

export async function GET(request: NextRequest) {
  const limited = await guard("tmdb", request);
  if (limited) return limited;
  if (!tmdbConfigured()) return jsonError("TMDB_READ_TOKEN is missing on the server.", 500);

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return jsonError("Missing or invalid show id.", 400);

  let data: Show;
  try {
    data = await serverFetchJson<Show>(`https://api.themoviedb.org/3/tv/${id}`, { timeoutMs: 8000 });
  } catch (err) {
    return jsonError((err as Error).message ?? "Failed to fetch that show.", 502);
  }

  const n = data.next_episode_to_air;
  const l = data.last_episode_to_air;
  const body: ShowNext = {
    next: n?.air_date && n.season_number && n.episode_number ? { s: n.season_number, e: n.episode_number, airDate: n.air_date } : null,
    status: data.status ?? null,
    seasons: (data.seasons ?? []).map((x) => ({ season_number: Number(x.season_number ?? 0), episode_count: Number(x.episode_count ?? 0) })),
    lastAired: l?.season_number && l.episode_number ? { s: l.season_number, e: l.episode_number } : null,
  };
  return jsonSuccess(body, { maxAge: 43200, staleWhileRevalidate: 86400 });
}
