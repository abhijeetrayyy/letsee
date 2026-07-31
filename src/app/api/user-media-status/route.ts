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
  const imageUrl = typeof body.imgUrl === "string" ? body.imgUrl : (body.imageUrl as string) || null;
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
      image_url: imageUrl,
      item_adult: adult,
      genres,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id" }
  );

  if (error) {
    console.error("user-media-status upsert:", error);
    return jsonError(error.message, 500);
  }

  // Mirror writes to watched_items for backward compatibility with profile/diary/reviews
  // that still read from watched_items
  if (status === "watched") {
    await supabase.from("watched_items").upsert(
      {
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        item_name: itemName,
        image_url: imageUrl,
        item_adult: adult,
        genres,
        is_watched: true,
        watched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_id" }
    );
  }

  // Update count stats after status change
  try {
    await supabase.rpc("recount_user_stats", { p_user_id: userId });
  } catch {
    // Non-critical, stats will be eventually consistent
  }

  // Fire-and-forget: don't let achievement checks (several COUNT(*) scans) slow this response down
  if (status === "watched") {
    void supabase.rpc("check_achievements", { p_user_id: userId, p_action: "watch" })
      .then(
        ({ data }) => {
          for (const row of data ?? []) {
            void supabase.rpc("award_achievement", { p_user_id: userId, p_achievement_id: row.achievement_id });
          }
        },
        () => {}
      );
  }

  return jsonSuccess({ ok: true, status });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");

  if (!itemId) return jsonError("itemId is required", 400);

  const { error } = await supabase
    .from("user_media_status")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);

  if (error) {
    console.error("user-media-status delete:", error);
    return jsonError(error.message, 500);
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

  if (itemId) {
    const { data, error } = await supabase
      .from("user_media_status")
      .select("status, updated_at")
      .eq("user_id", userId)
      .eq("item_id", itemId)
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

  const statuses: Record<string, string> = {};
  for (const row of data ?? []) {
    statuses[row.item_id] = row.status;
  }

  return jsonSuccess(statuses);
}
