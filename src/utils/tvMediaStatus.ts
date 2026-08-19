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
  const { data: existing, error: readError } = await supabase
    .from("user_media_status")
    .select("status")
    .eq("user_id", userId)
    .eq("item_id", showId)
    .eq("item_type", "tv")
    .maybeSingle();

  /**
   * A failed read is not an empty result, and here the difference is destructive.
   *
   * `maybeSingle()` returns `data: null` both when there is no row and when the
   * query errored — an RLS hiccup, a pooler timeout, a dropped connection. The
   * code below treats null as "this show is not tracked yet" and upserts
   * `status: "watching"` with ON CONFLICT DO UPDATE, which rewrites whatever
   * was actually there. So a user who had finished a series and ticked one more
   * episode during a moment of database flakiness had their show quietly
   * demoted from `watched` back to `watching`: real state loss, no log, no
   * toast, no way to tell it happened.
   *
   * Bail instead. The episode row is already written by the caller; the status
   * re-derives on the next tick.
   */
  if (readError) {
    console.error("ensureShowInMediaStatus: status read failed, not writing:", readError);
    return;
  }

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
    { onConflict: "user_id,item_id,item_type" },
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
    // Season 0 is specials, which TMDB excludes from number_of_episodes.
    // Counting them made progress exceed 100% and flipped shows to "watched"
    // early, so the two sides of the comparison have to agree.
    supabase
      .from("watched_episodes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("show_id", showId)
      .gt("season_number", 0),
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
      { onConflict: "user_id,item_id,item_type" },
    );

    await syncWatchedItem(supabase, userId, showId, newStatus === "watched", {
      name: showData?.name ?? null,
      poster: showData?.poster_path ?? null,
      genres: Array.isArray(showData?.genres)
        ? (showData.genres as { name?: string }[]).map((g) => g?.name ?? "").filter(Boolean)
        : [],
    });
  }
}

/**
 * Keep `watched_items` in step with a show's status.
 *
 * This is the fix for the single most confusing bug in the product: completing
 * a series through the episode modal only ever wrote `watched_episodes`, and
 * `watched_items` is what actually gates rating, reviewing, the profile Films
 * grid and the diary. So a finished show couldn't be rated or reviewed and
 * never appeared on the profile — while the profile header count, which reads
 * `user_media_status`, insisted you had watched it.
 *
 * `is_watched=false` rather than deleting, so a rating/review/diary entry
 * written earlier survives a show dropping back to "watching".
 */
/** Minimal show metadata for writing a watched_items row. */
export async function fetchShowMeta(
  showId: string,
): Promise<{ name: string | null; poster: string | null; genres: string[] }> {
  const empty = { name: null, poster: null, genres: [] as string[] };
  if (!TMDB_API_KEY) return empty;
  try {
    const res = await fetchTmdb(
      `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}`,
    );
    if (!res.ok) return empty;
    const data = await res.json();
    return {
      name: data?.name ?? null,
      poster: data?.poster_path ?? null,
      genres: Array.isArray(data?.genres)
        ? (data.genres as { name?: string }[]).map((g) => g?.name ?? "").filter(Boolean)
        : [],
    };
  } catch {
    return empty;
  }
}

export async function syncWatchedItem(
  supabase: SupabaseClient,
  userId: string,
  showId: string,
  watched: boolean,
  meta: { name: string | null; poster: string | null; genres: string[] },
) {
  const { data: existing, error: readError } = await supabase
    .from("watched_items")
    .select("id, is_watched")
    .eq("user_id", userId)
    .eq("item_id", showId)
    // This function is only ever about a series; without the type it could
    // find the film that shares the id and demote that instead.
    .eq("item_type", "tv")
    .maybeSingle();

  // Same reasoning as ensureShowInMediaStatus: both branches below decide what
  // to write from this row, and a failed read is indistinguishable from "no
  // row". Doing nothing is the only safe answer to a question that errored.
  if (readError) {
    console.error("syncWatchedItem: read failed, not writing:", readError);
    return;
  }

  if (!watched) {
    // Only ever demote a row we already have; never create one just to say no.
    if (existing && existing.is_watched) {
      await supabase
        .from("watched_items")
        .update({ is_watched: false })
        .eq("id", existing.id);
    }
    return;
  }

  const imageUrl = meta.poster ? `https://image.tmdb.org/t/p/w342${meta.poster}` : null;

  const { error } = await supabase.from("watched_items").upsert(
    {
      user_id: userId,
      item_id: showId,
      item_type: "tv",
      item_name: meta.name ?? "Unknown",
      ...(imageUrl ? { image_url: imageUrl } : {}),
      genres: meta.genres,
      is_watched: true,
      watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id,item_type" },
  );

  if (error) console.error("syncWatchedItem:", error);
}
