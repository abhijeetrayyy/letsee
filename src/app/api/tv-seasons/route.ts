import { NextRequest } from "next/server";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

/** GET /api/tv-seasons?showId=123 — Returns seasons list for MarkTVWatchedModal (profile/cards). */
export async function GET(req: NextRequest) {
  const showId = req.nextUrl.searchParams.get("showId");
  if (!showId?.trim()) {
    return jsonError("showId is required", 400);
  }

  const data = await getTvShowWithSeasons(showId.trim());
  if (!data) {
    return jsonError("Show not found", 404);
  }

  const seasons = (data.seasons as { season_number?: number; name?: string; episode_count?: number }[]) ?? [];
  const list = seasons
    .filter((s) => Number(s.season_number) >= 0)
    .map((s) => ({
      season_number: Number(s.season_number),
      name: s.name ?? `Season ${s.season_number}`,
      episode_count: Math.max(0, Number(s.episode_count ?? 0)),
    }))
    .sort((a, b) => a.season_number - b.season_number);

  return jsonSuccess({ seasons: list });
}
