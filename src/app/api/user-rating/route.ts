import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

/** GET /api/user-rating?itemId=123&itemType=movie — returns { score: number | null } */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    return jsonError("User isn't logged in", 401);
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const itemType = searchParams.get("itemType");

  if (!itemId || !itemType) {
    return jsonError("Missing itemId or itemType", 400);
  }
  if (itemType !== "movie" && itemType !== "tv") {
    return jsonError("itemType must be movie or tv", 400);
  }

  const { data: row, error } = await supabase
    .from("user_ratings")
    .select("score")
    .eq("user_id", user.user.id)
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .maybeSingle();

  if (error) {
    return jsonError("Failed to fetch rating", 500);
  }
  return jsonSuccess(
    { score: row?.score ?? null },
    { maxAge: 0 }
  );
}

/** POST /api/user-rating — body: { itemId: string, itemType: 'movie'|'tv', score: number } — set/update rating (1-10) */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    return jsonError("User isn't logged in", 401);
  }

  let body: { itemId?: string; itemType?: string; score?: number; itemName?: string; imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { itemId, itemType, score, itemName, imageUrl } = body;
  if (!itemId || !itemType) {
    return jsonError("Missing itemId or itemType", 400);
  }
  if (itemType !== "movie" && itemType !== "tv") {
    return jsonError("itemType must be movie or tv", 400);
  }
  const num = Number(score);
  if (!Number.isInteger(num) || num < 1 || num > 10) {
    return jsonError("score must be an integer from 1 to 10", 400);
  }

  const [
    { data: watchedRow },
    { data: existingRating },
  ] = await Promise.all([
    supabase
      .from("watched_items")
      .select("id, is_watched")
      .eq("user_id", user.user.id)
      .eq("item_id", String(itemId))
      .eq("item_type", itemType)
      .maybeSingle(),
    supabase
      .from("user_ratings")
      .select("id")
      .eq("user_id", user.user.id)
      .eq("item_id", String(itemId))
      .eq("item_type", itemType)
      .maybeSingle(),
  ]);
  const canRate =
    (watchedRow && (watchedRow as { is_watched?: boolean }).is_watched !== false) ||
    !!existingRating;
  if (!canRate) {
    return jsonError("Mark as watched to rate this title", 403);
  }

  const { error: upsertError } = await supabase
    .from("user_ratings")
    .upsert(
      {
        user_id: user.user.id,
        item_id: String(itemId),
        item_type: itemType,
        score: num,
      },
      { onConflict: "user_id,item_id" }
    );

  if (upsertError) {
    return jsonError(upsertError.message || "Failed to save rating", 500);
  }

  return jsonSuccess({ score: num }, { maxAge: 0 });
}

/** DELETE /api/user-rating — body: { itemId: string, itemType: 'movie'|'tv' } — remove rating */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    return jsonError("User isn't logged in", 401);
  }

  let body: { itemId?: string; itemType?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { itemId, itemType } = body;
  if (!itemId || !itemType) {
    return jsonError("Missing itemId or itemType", 400);
  }
  if (itemType !== "movie" && itemType !== "tv") {
    return jsonError("itemType must be movie or tv", 400);
  }

  const { data: watchedRow } = await supabase
    .from("watched_items")
    .select("id")
    .eq("user_id", user.user.id)
    .eq("item_id", String(itemId))
    .eq("item_type", itemType)
    .maybeSingle();
  if (!watchedRow) {
    return jsonError("Mark as watched to rate this title", 403);
  }

  const { error: deleteError } = await supabase
    .from("user_ratings")
    .delete()
    .eq("user_id", user.user.id)
    .eq("item_id", String(itemId))
    .eq("item_type", itemType);

  if (deleteError) {
    return jsonError(deleteError.message || "Failed to remove rating", 500);
  }

  return jsonSuccess({ score: null }, { maxAge: 0 });
}
