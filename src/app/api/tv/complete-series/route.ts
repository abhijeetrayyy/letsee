import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";
import { syncWatchedItem } from "@/utils/tvMediaStatus";

/**
 * POST /api/tv/complete-series  { showId }
 *
 * "I finished this show" in one call: every episode marked watched, the show
 * set to watched, and watched_items kept in step so it reaches the profile,
 * diary, and the rating/review widgets.
 *
 * This exists because saying "Watched" used to open the episode modal, and
 * for a show whose episodes were already all ticked the modal's diff was
 * empty — Save changes did nothing and there was no way out of "watching".
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  let body: { showId?: string | number };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const showId = body.showId != null ? String(body.showId) : null;
  if (!showId) return jsonError("showId is required", 400);

  const show = await getTvShowWithSeasons(showId);
  if (!show) return jsonError("Show not found", 404);

  const supabase = await createClient();

  const seasons = (show.seasons as { season_number?: number; episode_count?: number }[]) ?? [];
  const rows: {
    user_id: string;
    show_id: string;
    season_number: number;
    episode_number: number;
  }[] = [];

  for (const season of seasons) {
    const sn = Number(season?.season_number);
    // Season 0 is specials; TMDB leaves them out of number_of_episodes, so
    // including them here would push progress past 100%.
    if (!Number.isFinite(sn) || sn <= 0) continue;
    const count = Math.max(0, Number(season?.episode_count ?? 0));
    for (let ep = 1; ep <= count; ep += 1) {
      rows.push({ user_id: userId, show_id: showId, season_number: sn, episode_number: ep });
    }
  }

  if (rows.length > 0) {
    const { error: epError } = await supabase
      .from("watched_episodes")
      .upsert(rows, {
        onConflict: "user_id,show_id,season_number,episode_number",
        ignoreDuplicates: true,
      });
    if (epError) {
      console.error("complete-series episodes:", epError);
      return jsonError(epError.message, 500);
    }
  }

  const posterPath = (show as { poster_path?: string | null }).poster_path ?? null;
  const name = (show as { name?: string }).name ?? "Unknown";
  const genres = Array.isArray((show as { genres?: { name?: string }[] }).genres)
    ? (show as { genres: { name?: string }[] }).genres.map((g) => g?.name ?? "").filter(Boolean)
    : [];

  const { error: statusError } = await supabase.from("user_media_status").upsert(
    {
      user_id: userId,
      item_id: showId,
      item_type: "tv",
      item_name: name,
      ...(posterPath ? { image_url: `https://image.tmdb.org/t/p/w342${posterPath}` } : {}),
      genres,
      status: "watched",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id,item_type" },
  );

  if (statusError) {
    console.error("complete-series status:", statusError);
    return jsonError(statusError.message, 500);
  }

  await syncWatchedItem(supabase, userId, showId, true, {
    name,
    poster: posterPath,
    genres,
  });

  try {
    await supabase.rpc("recount_user_stats", { p_user_id: userId });
  } catch {
    // Non-critical
  }

  return jsonSuccess({ ok: true, episodesMarked: rows.length });
}
