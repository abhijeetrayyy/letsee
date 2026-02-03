import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return jsonError("User isn't logged in", 401);
  }
  const userId = userData.user.id;

  const showId = req.nextUrl.searchParams.get("showId")?.trim();
  if (!showId) {
    return jsonError("showId query parameter is required", 400);
  }

  if (!process.env.TMDB_API_KEY) {
    return jsonError("TMDB API key is missing", 500);
  }

  const watchedRes = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("user_id", userId)
    .eq("show_id", showId);

  if (watchedRes.error) {
    console.error("tv-progress watched:", watchedRes.error);
    return jsonError("Failed to fetch progress", 500);
  }

  const watched = watchedRes.data ?? [];
  const watchedSet = new Set(watched.map((r) => `${r.season_number},${r.episode_number}`));

  const showData = await getTvShowWithSeasons(showId);
  if (!showData) {
    return jsonError("Show not found", 404);
  }
  const showName = (showData?.name as string) ?? "Unknown";
  const seasons = Array.isArray(showData?.seasons) ? showData.seasons : [];

  const seasonCounts = new Map<number, number>();
  const allEpisodes: { s: number; e: number }[] = [];
  for (const season of seasons) {
    const sn = Number(season.season_number);
    if (sn < 0 || Number.isNaN(sn)) continue;
    const count = Number(season.episode_count) || 0;
    seasonCounts.set(sn, count);
    for (let ep = 1; ep <= count; ep++) allEpisodes.push({ s: sn, e: ep });
  }
  allEpisodes.sort((a, b) => a.s - b.s || a.e - b.e);

  let seasonsCompleted = 0;
  for (const [sn, total] of seasonCounts.entries()) {
    let watchedInSeason = 0;
    for (let ep = 1; ep <= total; ep++) {
      if (watchedSet.has(`${sn},${ep}`)) watchedInSeason++;
    }
    if (total > 0 && watchedInSeason >= total) seasonsCompleted++;
  }

  const next = allEpisodes.find(({ s, e }) => !watchedSet.has(`${s},${e}`));

  return jsonSuccess(
    {
      show_id: showId,
      show_name: showName,
      seasons_completed: seasonsCompleted,
      episodes_watched: watched.length,
      next_season: next?.s ?? null,
      next_episode: next?.e ?? null,
      all_complete: !next,
    },
    { maxAge: 0 }
  );
}
