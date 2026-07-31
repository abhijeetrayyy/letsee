import { fetchTmdb } from "@/utils/tmdbClient";
import type { createClient } from "@/utils/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const TMDB_API_KEY = process.env.TMDB_API_KEY;

/**
 * Ensure a show has a user_media_status row before recording episode progress.
 * Shows tracked only via watched_episodes (never explicitly added to a list)
 * need a default "watching" row so they show up in TV progress views.
 */
export async function ensureShowInMediaStatus(
  supabase: SupabaseClient,
  userId: string,
  showId: string,
) {
  const { data: existing } = await supabase
    .from("user_media_status")
    .select("status")
    .eq("user_id", userId)
    .eq("item_id", showId)
    .eq("item_type", "tv")
    .maybeSingle();

  if (existing) return;
  if (!TMDB_API_KEY) return;

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

/**
 * Re-derive show-level status from actual episode progress. This is the only
 * function allowed to auto-change user_media_status.status for a TV show —
 * every episode write path (single toggle, bulk mark, bulk delete, mark-up-to)
 * must call this afterward so status never drifts out of sync with
 * watched_episodes. Valid statuses are watchlist | watching | watched |
 * on_hold | dropped (migration 029's CHECK constraint) — "completed" is not
 * a valid value.
 */
export async function autoTransitionStatus(
  supabase: SupabaseClient,
  userId: string,
  showId: string,
) {
  if (!TMDB_API_KEY) return;

  const [{ data: statusRow }, { count: watchedCount }] = await Promise.all([
    supabase
      .from("user_media_status")
      .select("status")
      .eq("user_id", userId)
      .eq("item_id", showId)
      .eq("item_type", "tv")
      .maybeSingle(),
    supabase
      .from("watched_episodes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("show_id", showId),
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
    if (currentStatus !== "watched") newStatus = "watched";
  } else if (currentStatus === "watchlist" || !currentStatus) {
    newStatus = "watching";
  } else if (
    currentStatus === "watched" &&
    totalEpisodes > 0 &&
    watchedCount != null &&
    watchedCount < totalEpisodes
  ) {
    // Un-marking episodes on a fully-watched show reverts it to watching.
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
