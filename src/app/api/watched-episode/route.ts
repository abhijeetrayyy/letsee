import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/utils/apiResponse";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return jsonError("User isn't logged in", 401);
  }
  const userId = userData.user.id;

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
    return NextResponse.json(
      { action: "removed", message: "Episode marked as not watched" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  let runtimeMinutes: number | null = null;
  if (TMDB_API_KEY) {
    try {
      const { fetchTmdb } = await import("@/utils/tmdbClient");
      const res = await fetchTmdb(
        `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${TMDB_API_KEY}`
      );
      if (res.ok) {
        const epData = await res.json();
        const rt = epData?.runtime;
        if (typeof rt === "number" && rt > 0) runtimeMinutes = Math.round(rt);
      }
    } catch (e) {
      console.error("watched-episode fetch episode runtime:", e);
    }
  }

  const { error: insertError } = await supabase.from("watched_episodes").insert({
    user_id: userId,
    show_id: showId,
    season_number: seasonNumber,
    episode_number: episodeNumber,
    ...(runtimeMinutes != null && { runtime_minutes: runtimeMinutes }),
  });
  if (insertError) {
    console.error("watched-episode insert:", insertError);
    return jsonError("Failed to mark episode watched", 500);
  }
  await addShowToWatchedIfAtLeastOneEpisode(supabase, userId, showId);
  return NextResponse.json(
    { action: "added", message: "Episode marked as watched" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

async function addShowToWatchedIfAtLeastOneEpisode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  showId: string
) {
  const { data: alreadyInWatched } = await supabase
    .from("watched_items")
    .select("id")
    .eq("user_id", userId)
    .eq("item_id", showId)
    .maybeSingle();
  if (alreadyInWatched) return;
  if (!TMDB_API_KEY) return;
  const { fetchTmdb } = await import("@/utils/tmdbClient");
  const res = await fetchTmdb(
    `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}`
  );
  if (!res.ok) return;
  const showData = await res.json();
  const name = showData?.name ?? "Unknown";
  const poster = showData?.poster_path ?? null;
  const imgUrl = poster ? `https://image.tmdb.org/t/p/w342${poster}` : "";
  const adult = Boolean(showData?.adult);
  const genres = Array.isArray(showData?.genres)
    ? (showData.genres as { name?: string }[]).map((g) => g?.name ?? "").filter(Boolean)
    : [];
  const { error: insertError } = await supabase.from("watched_items").insert({
    user_id: userId,
    item_id: showId,
    item_name: name,
    item_type: "tv",
    image_url: imgUrl,
    item_adult: adult,
    genres,
  });
  if (insertError) {
    console.error("watched-episode addShowToWatched:", insertError);
    return;
  }
  const { error: incError } = await supabase.rpc("increment_watched_count", {
    p_user_id: userId,
  });
  if (incError) console.error("watched-episode increment_watched_count:", incError);
}

