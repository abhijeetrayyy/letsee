import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

/** GET /api/watched-review?itemId=123&itemType=movie — returns { diaryText, publicReviewText, watchedAt } or 404 if not watched */
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
    .from("watched_items")
    .select("review_text, public_review_text, watched_at")
    .eq("user_id", user.user.id)
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .maybeSingle();

  if (error) return jsonError("Failed to fetch", 500);
  if (!row) return jsonError("Not in your watched list", 404);

  return jsonSuccess(
    {
      diaryText: row.review_text ?? null,
      publicReviewText: row.public_review_text ?? null,
      watchedAt: row.watched_at,
    },
    { maxAge: 0 }
  );
}

/** PATCH /api/watched-review — body: { itemId, itemType, diaryText?, publicReviewText? } — set diary (private) and/or public review (must have watched) */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    return jsonError("User isn't logged in", 401);
  }

  let body: { itemId?: string; itemType?: string; diaryText?: string; publicReviewText?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const { itemId, itemType, diaryText, publicReviewText } = body;
  if (!itemId || !itemType) {
    return jsonError("Missing itemId or itemType", 400);
  }
  if (itemType !== "movie" && itemType !== "tv") {
    return jsonError("itemType must be movie or tv", 400);
  }

  const { data: existing } = await supabase
    .from("watched_items")
    .select("id")
    .eq("user_id", user.user.id)
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .maybeSingle();

  if (!existing) {
    return jsonError("Mark as watched first", 404);
  }

  const updates: { review_text?: string | null; public_review_text?: string | null } = {};
  if (diaryText !== undefined) {
    updates.review_text = typeof diaryText === "string" ? diaryText.trim() || null : null;
  }
  if (publicReviewText !== undefined) {
    updates.public_review_text = typeof publicReviewText === "string" ? publicReviewText.trim() || null : null;
  }
  if (Object.keys(updates).length === 0) {
    return jsonError("Provide diaryText and/or publicReviewText", 400);
  }

  const { error: updateError } = await supabase
    .from("watched_items")
    .update(updates)
    .eq("user_id", user.user.id)
    .eq("item_id", itemId)
    .eq("item_type", itemType);

  if (updateError) return jsonError(updateError.message || "Failed to save", 500);
  return jsonSuccess(
    {
      diaryText: updates.review_text !== undefined ? updates.review_text : undefined,
      publicReviewText: updates.public_review_text !== undefined ? updates.public_review_text : undefined,
    },
    { maxAge: 0 }
  );
}
