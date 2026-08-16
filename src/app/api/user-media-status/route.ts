import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

const VALID_STATUSES = ["watchlist", "watching", "watched", "on_hold", "dropped"] as const;
type MediaStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(s: unknown): s is MediaStatus {
  return typeof s === "string" && VALID_STATUSES.includes(s as MediaStatus);
}

export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const itemId = body.itemId != null ? String(body.itemId) : null;
  const itemType = body.itemType === "tv" ? "tv" : "movie";
  const status = body.status;
  const itemName = typeof body.name === "string" ? body.name : (body.itemName as string) || "";
  const rawImageUrl = typeof body.imgUrl === "string" ? body.imgUrl : (body.imageUrl as string) || "";
  const imageUrl = rawImageUrl.trim() || null;
  const adult = body.adult === true;
  const genres = Array.isArray(body.genres) ? (body.genres as string[]) : [];

  if (!itemId) return jsonError("itemId is required", 400);
  if (!isValidStatus(status)) return jsonError("Invalid status. Must be one of: watchlist, watching, watched, on_hold, dropped", 400);

  const { error } = await supabase.from("user_media_status").upsert(
    {
      user_id: userId,
      item_id: itemId,
      item_type: itemType,
      item_name: itemName,
      // Omit image_url entirely when not supplied so status-only updates
      // (e.g. the TV status dropdown) don't blank out an existing poster.
      ...(imageUrl ? { image_url: imageUrl } : {}),
      item_adult: adult,
      genres,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id,item_type" }
  );

  if (error) {
    console.error("user-media-status upsert:", error);
    return jsonError(error.message, 500);
  }

  // Mirror writes to watched_items for backward compatibility with profile/diary/reviews
  // that still read from watched_items
  if (status === "watched") {
    const { error: watchedItemsError } = await supabase.from("watched_items").upsert(
      {
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        item_name: itemName,
        ...(imageUrl ? { image_url: imageUrl } : {}),
        item_adult: adult,
        genres,
        is_watched: true,
        watched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_id,item_type" }
    );

    if (watchedItemsError) {
      console.error("user-media-status watched_items mirror upsert:", watchedItemsError);
    }
  } else {
    // Moving *away* from watched (to dropped, on_hold, watching, watchlist)
    // has to demote the mirror too, or the title keeps showing in the profile
    // Films grid and diary. is_watched=false rather than delete, so an
    // existing rating, diary entry and review survive the move.
    const { error: demoteError } = await supabase
      .from("watched_items")
      .update({ is_watched: false })
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .eq("is_watched", true);

    if (demoteError) {
      console.error("user-media-status watched_items demote:", demoteError);
    }
  }

  // Update count stats after status change
  try {
    await supabase.rpc("recount_user_stats", { p_user_id: userId });
  } catch {
    // Non-critical, stats will be eventually consistent
  }

  return jsonSuccess({ ok: true, status });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  // TMDB numbers films and series separately, so an id alone identifies two
  // possible titles. Without the type this deleted both.
  const itemType = url.searchParams.get("itemType") === "tv" ? "tv" : "movie";
  // The confirm dialog offers "keep my rating, diary & review" vs "delete
  // everything". Both used to do the same thing because this flag was never
  // sent or read — the destructive option destroyed nothing.
  const keepData = url.searchParams.get("keepData") !== "false";

  if (!itemId) return jsonError("itemId is required", 400);

  const { error } = await supabase
    .from("user_media_status")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", itemType);

  if (error) {
    console.error("user-media-status delete:", error);
    return jsonError(error.message, 500);
  }

  if (keepData) {
    // Drop it out of the Films grid and diary listings, but keep the row so
    // the rating, diary entry and public review survive.
    await supabase
      .from("watched_items")
      .update({ is_watched: false })
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", itemType);
  } else {
    await Promise.all([
      supabase.from("watched_items").delete().eq("user_id", userId).eq("item_id", itemId).eq("item_type", itemType),
      supabase.from("user_ratings").delete().eq("user_id", userId).eq("item_id", itemId).eq("item_type", itemType),
      // Episodes only exist for series, so this is a no-op for a film.
      ...(itemType === "tv"
        ? [supabase.from("watched_episodes").delete().eq("user_id", userId).eq("show_id", itemId)]
        : []),
    ]);
  }

  try {
    await supabase.rpc("recount_user_stats", { p_user_id: userId });
  } catch {
    // Non-critical
  }

  return jsonSuccess({ ok: true, removed: true });
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  const itemType = url.searchParams.get("itemType") === "tv" ? "tv" : "movie";

  if (itemId) {
    const { data, error } = await supabase
      .from("user_media_status")
      .select("status, updated_at")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);

    return jsonSuccess({ status: data?.status ?? null });
  }

  // Return all statuses for the current user (used to hydrate client state)
  const { data, error } = await supabase
    .from("user_media_status")
    .select("item_id, item_type, status")
    .eq("user_id", userId);

  if (error) return jsonError(error.message, 500);

  /**
   * Keyed `type:id`, not `id`.
   *
   * TMDB numbers films and series independently, so a bare id is ambiguous —
   * a user holding both movie 550 and tv 550 had one silently overwrite the
   * other in this map, and the client rendered whichever won for both. The
   * client builds the same key via `mediaKey()`.
   */
  const statuses: Record<string, string> = {};
  for (const row of data ?? []) {
    statuses[`${row.item_type}:${row.item_id}`] = row.status;
  }

  return jsonSuccess(statuses);
}
