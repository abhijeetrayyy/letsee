import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

const VALID_STATUSES = ["watchlist", "watching", "watched"] as const;
type QuickStatus = (typeof VALID_STATUSES)[number];

type Entry = {
  itemId: string | number;
  itemType?: string;
  name?: string;
  imgUrl?: string | null;
  genres?: string[];
  status?: string;
  favorite?: boolean;
  /** Undo a pick that was already written in an earlier batch. */
  remove?: boolean;
};

const MAX_ENTRIES = 200;

/**
 * POST /api/quick-add/bulk  { entries: [...] }
 *
 * Writes a whole batch of quick-add picks in one round trip. Ticking forty
 * titles should cost one request, not forty — the existing single-item
 * endpoint made a fast grid feel slow and hammered the database.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  let body: { entries?: Entry[] };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0) return jsonError("entries is required", 400);
  if (entries.length > MAX_ENTRIES) {
    return jsonError(`At most ${MAX_ENTRIES} entries per request`, 400);
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const statusRows: Record<string, unknown>[] = [];
  const watchedRows: Record<string, unknown>[] = [];
  const favoriteRows: Record<string, unknown>[] = [];
  const removeIds: string[] = [];

  for (const e of entries) {
    const itemId = e.itemId != null ? String(e.itemId) : null;
    if (!itemId) continue;

    // Un-ticking a poster after its batch already went out has to undo the
    // write, or the grid would show it unpicked while the row stayed saved.
    if (e.remove) {
      removeIds.push(itemId);
      continue;
    }
    const itemType = e.itemType === "tv" ? "tv" : "movie";
    const itemName = typeof e.name === "string" ? e.name : "";
    const imageUrl = typeof e.imgUrl === "string" && e.imgUrl.trim() ? e.imgUrl.trim() : null;
    const genres = Array.isArray(e.genres) ? e.genres : [];

    if (e.favorite) {
      favoriteRows.push({
        user_id: userId, item_id: itemId, item_type: itemType,
        item_name: itemName, image_url: imageUrl, genres,
      });
    }

    const status = VALID_STATUSES.includes(e.status as QuickStatus)
      ? (e.status as QuickStatus)
      : null;
    if (!status) continue;

    statusRows.push({
      user_id: userId, item_id: itemId, item_type: itemType, item_name: itemName,
      ...(imageUrl ? { image_url: imageUrl } : {}),
      genres, status, updated_at: now,
    });

    // Mirror to watched_items, which is what the profile grid and diary read.
    if (status === "watched") {
      watchedRows.push({
        user_id: userId, item_id: itemId, item_type: itemType, item_name: itemName,
        ...(imageUrl ? { image_url: imageUrl } : {}),
        genres, is_watched: true, watched_at: now,
      });
    }
  }

  if (removeIds.length > 0) {
    // Quick-add only ever created these rows, so removing them here is safe.
    await Promise.all([
      supabase.from("user_media_status").delete().eq("user_id", userId).in("item_id", removeIds),
      supabase.from("favorite_items").delete().eq("user_id", userId).in("item_id", removeIds),
      supabase.from("watched_items").delete().eq("user_id", userId).in("item_id", removeIds),
    ]);
  }

  if (statusRows.length > 0) {
    const { error } = await supabase
      .from("user_media_status")
      .upsert(statusRows, { onConflict: "user_id,item_id" });
    if (error) {
      console.error("quick-add status:", error);
      return jsonError(error.message, 500);
    }
  }

  if (watchedRows.length > 0) {
    const { error } = await supabase
      .from("watched_items")
      .upsert(watchedRows, { onConflict: "user_id,item_id" });
    if (error) console.error("quick-add watched_items mirror:", error);
  }

  if (favoriteRows.length > 0) {
    const { error } = await supabase
      .from("favorite_items")
      .upsert(favoriteRows, { onConflict: "user_id,item_id" });
    if (error) console.error("quick-add favorites:", error);
  }

  try {
    await supabase.rpc("recount_user_stats", { p_user_id: userId });
  } catch {
    // Non-critical; stats are eventually consistent.
  }

  void supabase
    .rpc("check_achievements", { p_user_id: userId, p_action: "watch" })
    .then(
      ({ data }) => {
        for (const row of data ?? []) {
          void supabase.rpc("award_achievement", {
            p_user_id: userId,
            p_achievement_id: row.achievement_id,
          });
        }
      },
      () => {},
    );

  return jsonSuccess({
    ok: true,
    saved: statusRows.length,
    favorites: favoriteRows.length,
  });
}
