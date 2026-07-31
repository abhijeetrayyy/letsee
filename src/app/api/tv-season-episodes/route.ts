import { NextRequest } from "next/server";
import { getSeasonEpisodes } from "@/utils/tmdbTvShow";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

/** GET /api/tv-season-episodes?showId=123&season=1 — Episode list for a single season. */
export async function GET(req: NextRequest) {
  const showId = req.nextUrl.searchParams.get("showId");
  const season = req.nextUrl.searchParams.get("season");
  if (!showId?.trim() || !season?.trim()) {
    return jsonError("showId and season are required", 400);
  }

  const data = await getSeasonEpisodes(showId.trim(), season.trim());
  if (!data) {
    return jsonError("Season not found", 404);
  }

  const episodes = (data.episodes as unknown[]) ?? [];
  return jsonSuccess({ episodes });
}
