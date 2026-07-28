import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

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

  // Auto-transition status (plan_to_watch → watching, all watched → completed)
  await autoTransitionStatus(supabase, userId, showId);

  return jsonSuccess({ action: "added", message: "Episode marked as watched" }, { maxAge: 0 });
}

async function ensureShowInMediaStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  showId: string,
) {
  const { data: existing } = await supabase
    .from("user_media_status")
    .select("status")
    .eq("user_id", userId)
    .eq("item_id", showId)
    .maybeSingle();

  if (existing) return;

  if (!TMDB_API_KEY) return;

  const { fetchTmdb } = await import("@/utils/tmdbClient");
  const res = await fetchTmdb(
    `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}`,
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

  const { error } = await supabase.from("user_media_status").upsert(
    {
      user_id: userId,
      item_id: showId,
      item_type: "tv",
      item_name: name,
      image_url: imgUrl,
      item_adult: adult,
      genres,
      status: "watching",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id" },
  );
  if (error) console.error("ensureShowInMediaStatus:", error);
}

async function autoTransitionStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  showId: string,
) {
  if (!TMDB_API_KEY) return;

  const [{ data: statusRow }, { count: watchedCount }, { fetchTmdb }] = await Promise.all([
    supabase
      .from("user_media_status")
      .select("status")
      .eq("user_id", userId)
      .eq("item_id", showId)
      .maybeSingle(),
    supabase
      .from("watched_episodes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("show_id", showId),
    import("@/utils/tmdbClient"),
  ]);

  const currentStatus = (statusRow as { status?: string } | null)?.status;

  const res = await fetchTmdb(
    `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}`,
  );
  if (!res.ok) return;
  const showData = await res.json();
  const totalEpisodes = showData?.number_of_episodes;

  let newStatus: string | null = null;

  if (
    totalEpisodes > 0 &&
    watchedCount != null &&
    watchedCount >= totalEpisodes
  ) {
    if (currentStatus !== "completed") {
      newStatus = "completed";
    }
  } else if (currentStatus === "watchlist" || !currentStatus) {
    newStatus = "watching";
  }

  if (newStatus) {
    await supabase.from("user_media_status").upsert(
      {
        user_id: userId,
        item_id: showId,
        item_type: "tv",
        status: newStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_id" },
    );
  }
}
