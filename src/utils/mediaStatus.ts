/**
 * The one way a title's status gets written, and what follows from it.
 *
 * Three routes used to carry their own copy of "upsert the status row, mirror
 * it to watched_items, and if it is watched make sure a viewing exists" — the
 * status route, /api/viewings and the importer — and the copies had already
 * drifted on which TV statuses survive a log. This is the copy. Every writer
 * of `user_media_status.status` calls it, or calls `ensureFirstViewings`
 * directly when it has written the row itself.
 *
 * `watched_at` is never written here. Since 095 the date belongs to the
 * viewing and the projection trigger keeps the mirror column equal to the
 * most recent one; a status change must not move a diary date.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type MediaStatus = "watchlist" | "watching" | "watched" | "on_hold" | "dropped";

export type StatusWrite = {
  itemId: string;
  itemType: "movie" | "tv";
  status: MediaStatus;
  itemName: string;
  imageUrl?: string | null;
  adult?: boolean;
  genres?: string[];
  /** Extra columns for the status row (the save context, `saved_at`). */
  extra?: Record<string, unknown>;
  /**
   * `false`: watched, but not on a day — "I've seen it", marked from a poster
   * or a quick mark, says nothing about today. No dated viewing is made, so
   * fifty films marked in a sitting don't fill the diary (or anyone's "On
   * letsee lately") as watched today. Default true: a log is a dated event.
   */
  dated?: boolean;
};

/**
 * Make sure every title in `items` has at least one dated viewing.
 *
 * One round trip through `ensure_first_viewings` (095), which inserts a
 * viewing dated today for each title that has none and ignores the rest —
 * so a re-tick of "Watched" can never invent a rewatch, and an import with
 * no dates still leaves a diary entry behind.
 */
export async function ensureFirstViewings(
  supabase: SupabaseClient,
  items: { itemId: string; itemType: "movie" | "tv" }[],
): Promise<void> {
  const list = items
    .filter((i) => i.itemId && (i.itemType === "movie" || i.itemType === "tv"))
    .map((i) => ({ item_id: i.itemId, item_type: i.itemType }));
  if (!list.length) return;
  const { error } = await supabase.rpc("ensure_first_viewings", { p_items: list });
  if (error) console.error("ensure_first_viewings:", error);
}

/**
 * Write a status, keep the legacy mirror in step, and make sure a watched
 * title has a viewing. Returns an error message, or null.
 */
export async function writeStatus(
  supabase: SupabaseClient,
  userId: string,
  input: StatusWrite,
): Promise<string | null> {
  const imageUrl = input.imageUrl?.trim() || null;
  const base = {
    user_id: userId,
    item_id: input.itemId,
    item_type: input.itemType,
    item_name: input.itemName,
    // Omit image_url entirely when not supplied so status-only updates
    // (the TV status dropdown) don't blank out an existing poster.
    ...(imageUrl ? { image_url: imageUrl } : {}),
    item_adult: input.adult === true,
    genres: input.genres ?? [],
  };

  const { error } = await supabase.from("user_media_status").upsert(
    { ...base, status: input.status, updated_at: new Date().toISOString(), ...(input.extra ?? {}) },
    { onConflict: "user_id,item_id,item_type" },
  );
  if (error) {
    console.error("writeStatus:", error);
    return error.message;
  }

  /**
   * "Seen it" is every status except watchlist: watching, on_hold and dropped
   * all mean you started it. Only watchlist means you have not.
   */
  const seen = input.status !== "watchlist";
  if (seen) {
    const { error: mirrorError } = await supabase
      .from("watched_items")
      .upsert({ ...base, is_watched: true }, { onConflict: "user_id,item_id,item_type" });
    if (mirrorError) console.error("writeStatus mirror:", mirrorError);
    if (input.status === "watched" && input.dated !== false) {
      await ensureFirstViewings(supabase, [{ itemId: input.itemId, itemType: input.itemType }]);
    }
  } else {
    // is_watched=false rather than delete, so an existing rating, diary entry
    // and review survive being moved back to "plan to watch". The viewings
    // survive too: a diary is a record of what happened, and wanting to watch
    // something again is not evidence that you never did.
    const { error: demoteError } = await supabase
      .from("watched_items")
      .update({ is_watched: false })
      .eq("user_id", userId)
      .eq("item_id", input.itemId)
      .eq("item_type", input.itemType)
      .eq("is_watched", true);
    if (demoteError) console.error("writeStatus demote:", demoteError);
  }
  return null;
}
