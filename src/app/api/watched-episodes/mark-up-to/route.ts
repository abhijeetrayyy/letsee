import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { fetchTmdb } from "@/utils/tmdbClient";
import { ensureShowInMediaStatus, autoTransitionStatus } from "@/utils/tvMediaStatus";

/**
 * POST /api/watched-episodes/mark-up-to
 * Mark all episodes up to and including a specific episode as watched.
 * This marks:
 * - All episodes in seasons before the target season
 * - All episodes in the target season up to and including the target episode
 * Request body: { showId, seasonNumber, episodeNumber, showName?, imageUrl?, adult?, genres? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Not authenticated", 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const { showId, seasonNumber, episodeNumber, showName, imageUrl, adult, genres } = body;

  if (!showId || seasonNumber == null || episodeNumber == null) {
    return jsonError("showId, seasonNumber, and episodeNumber are required", 400);
  }

  // Fetch all seasons from TMDB to know which episodes exist
  const tmdbRes = await fetchTmdb(
    `https://api.themoviedb.org/3/tv/${showId}?api_key=${process.env.TMDB_API_KEY}`
  );

  if (!tmdbRes.ok) {
    return jsonError("Failed to fetch show data from TMDB", 500);
  }

  const showData = await tmdbRes.json();
  const seasons = showData.seasons ?? [];

  // Build list of episodes to mark as watched
  const episodesToMark: { season_number: number; episode_number: number }[] = [];

  for (const season of seasons) {
    const seasonNum = season.season_number;
    if (seasonNum < 0) continue; // Skip specials

    if (seasonNum < seasonNumber) {
      // Mark all episodes in this season
      for (let ep = 1; ep <= season.episode_count; ep++) {
        episodesToMark.push({ season_number: seasonNum, episode_number: ep });
      }
    } else if (seasonNum === seasonNumber) {
      // Mark episodes up to and including target episode
      for (let ep = 1; ep <= episodeNumber; ep++) {
        episodesToMark.push({ season_number: seasonNum, episode_number: ep });
      }
      break; // No need to process further seasons
    } else {
      break; // Past the target season
    }
  }

  if (episodesToMark.length === 0) {
    return jsonError("No episodes to mark", 400);
  }

  // Ensure show is in watched_items
  const { data: existingWatched } = await supabase
    .from("watched_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("item_id", showId)
    .eq("item_type", "tv")
    .single();

  if (!existingWatched) {
    const name = showName || showData.name || "Unknown Show";
    const img = imageUrl || showData.poster_path || null;
    const isAdult = adult ?? showData.adult ?? false;
    const genreList = genres || showData.genres?.map((g: any) => g.name) || [];

    await supabase.from("watched_items").insert({
      user_id: user.id,
      item_id: showId,
      item_name: name,
      item_type: "tv",
      image_url: img,
      item_adult: isAdult,
      genres: genreList,
      is_watched: true,
    });
  }

  // Upsert episodes (ignore duplicates)
  const episodeRows = episodesToMark.map((ep) => ({
    user_id: user.id,
    show_id: showId,
    season_number: ep.season_number,
    episode_number: ep.episode_number,
  }));

  const { error: upsertError } = await supabase
    .from("watched_episodes")
    .upsert(episodeRows, {
      onConflict: "user_id,show_id,season_number,episode_number",
      ignoreDuplicates: true,
    });

  if (upsertError) {
    return new Response(
      JSON.stringify({ error: upsertError.message }),
      { status: 500 }
    );
  }

  await ensureShowInMediaStatus(supabase, user.id, String(showId));
  await autoTransitionStatus(supabase, user.id, String(showId));

  const { data: statusRow } = await supabase
    .from("user_media_status")
    .select("status")
    .eq("user_id", user.id)
    .eq("item_id", showId)
    .eq("item_type", "tv")
    .maybeSingle();

  return new Response(
    JSON.stringify({
      message: `Marked ${episodesToMark.length} episode(s) as watched up to S${seasonNumber}E${episodeNumber}`,
      count: episodesToMark.length,
      status: statusRow?.status ?? "watching",
    })
  );
}
