import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";
import { ensureShowInMediaStatus, autoTransitionStatus } from "@/utils/tvMediaStatus";

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: { showId?: string; seasonNumber?: number; episodeNumber?: number };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const showId = body.showId != null ? String(body.showId).trim() : "";
  const seasonNumber = Number(body.seasonNumber);
  const episodeNumber = Number(body.episodeNumber);

  if (!showId || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return jsonError("showId and seasonNumber (>= 0) are required", 400);
  }
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    return jsonError("episodeNumber (>= 1) is required", 400);
  }

  const { data: existing, error: findError } = await supabase
    .from("watched_episodes")
    .select("id")
    .eq("user_id", userId)
    .eq("show_id", showId)
    .eq("season_number", seasonNumber)
    .eq("episode_number", episodeNumber)
    .maybeSingle();

  if (findError) {
    console.error("watched-episode find:", findError);
    return jsonError("Failed to check episode state", 500);
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("watched_episodes")
      .delete()
      .eq("user_id", userId)
      .eq("show_id", showId)
      .eq("season_number", seasonNumber)
      .eq("episode_number", episodeNumber);
    if (deleteError) {
      console.error("watched-episode delete:", deleteError);
      return jsonError("Failed to remove episode", 500);
    }
    // Un-marking has to re-derive status too. Skipping it here left a
    // completed show stuck on "watched" after you removed an episode.
    await autoTransitionStatus(supabase, userId, showId);
    return jsonSuccess({ action: "removed", message: "Episode marked as not watched" }, { maxAge: 0 });
  }

  const { error: insertError } = await supabase
    .from("watched_episodes")
    .insert({
      user_id: userId,
      show_id: showId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
    });
  if (insertError) {
    console.error("watched-episode insert:", insertError);
    return jsonError("Failed to mark episode watched", 500);
  }

  // Ensure show is in user_media_status
  await ensureShowInMediaStatus(supabase, userId, showId);

  // Auto-transition status (watchlist → watching, all episodes watched → watched)
  await autoTransitionStatus(supabase, userId, showId);

  return jsonSuccess({ action: "added", message: "Episode marked as watched" }, { maxAge: 0 });
}
