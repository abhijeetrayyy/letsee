import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

import { guard } from "@/lib/limits/guard";
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
  const limited = await guard("write", req);
  if (limited) return limited;
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
  /** Ids to remove, per type: a film and a series can share an id. */
  const removals = new Map<"movie" | "tv", string[]>();

  for (const e of entries) {
    const itemId = e.itemId != null ? String(e.itemId) : null;
    if (!itemId) continue;

    // Un-ticking a poster after its batch already went out has to undo the
    // write, or the grid would show it unpicked while the row stayed saved.
    if (e.remove) {
      const t = e.itemType === "tv" ? "tv" : "movie";
      removals.set(t, [...(removals.get(t) ?? []), itemId]);
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
        genres, is_watched: true,
      });
    }
  }

  // Quick-add only ever created these rows, so removing them here is safe.
  // Quick-add is a film-and-series grid, so each delete names its type: ids
  // crossed with types (in ids, in types) also took the film's twin series.
  await Promise.all(
    [...removals].flatMap(([t, ids]) => [
      supabase.from("user_media_status").delete().eq("user_id", userId).eq("item_type", t).in("item_id", ids),
      supabase.from("favorite_items").delete().eq("user_id", userId).eq("item_type", t).in("item_id", ids),
      supabase.from("watched_items").delete().eq("user_id", userId).eq("item_type", t).in("item_id", ids),
    ]),
  );

  if (statusRows.length > 0) {
    const { error } = await supabase
      .from("user_media_status")
      .upsert(statusRows, { onConflict: "user_id,item_id,item_type" });
    if (error) {
      console.error("quick-add status:", error);
      return jsonError(error.message, 500);
    }
  }

  if (watchedRows.length > 0) {
    const { error } = await supabase
      .from("watched_items")
      .upsert(watchedRows, { onConflict: "user_id,item_id,item_type" });
    if (error) console.error("quick-add watched_items mirror:", error);
    // No dated viewing: this is a back catalogue — films seen over years,
    // marked in one sitting. Dating them all today filled the diary, and
    // everyone's "On letsee lately", with a month of films "watched today".
    // Seen is enough; the date is for what you log as it happens.
  }

  if (favoriteRows.length > 0) {
    const { error } = await supabase
      .from("favorite_items")
      .upsert(favoriteRows, { onConflict: "user_id,item_id,item_type" });
    if (error) console.error("quick-add favorites:", error);
  }

  // Counters are maintained by 069/078's statement triggers on
  // user_media_status, favorite_items and watched_episodes — the write above
  // already recounted inside its own transaction. An explicit recount here is a
  // second cross-region round trip for a number that is already correct.

  return jsonSuccess({
    ok: true,
    saved: statusRows.length,
    favorites: favoriteRows.length,
  });
}
