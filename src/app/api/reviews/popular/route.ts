import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

/**
 * GET /api/reviews/popular?days=7&limit=6 — the week's most-liked reviews.
 *
 * The only surface where a review can be found by someone who wasn't already
 * on the title page it belongs to. Without it, writing well here has no
 * distribution at all, which is the whole reason nobody bothers.
 *
 * Public profiles only — see the note on popular_reviews in 062. That makes
 * the response identical for every viewer, so unlike /api/reviews it can
 * genuinely be shared-cached.
 */
export async function GET(req: NextRequest) {
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 7, 1), 90);
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 6, 1), 20);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("popular_reviews", {
    p_days: days,
    p_limit: limit,
  });

  if (error) {
    // Almost certainly migration 062 not yet applied. An empty row is a
    // quieter failure than a broken home page.
    console.error("popular_reviews:", error);
    return jsonSuccess({ reviews: [] }, { maxAge: 0 });
  }

  const reviews = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    username: row.username ?? "someone",
    avatarUrl: row.avatar_url ?? null,
    reviewText: row.review_text ?? "",
    itemId: row.item_id ?? null,
    itemType: row.item_type === "tv" ? "tv" : "movie",
    itemName: row.item_name ?? "",
    imageUrl: row.image_url ?? null,
    reactionCount: Number(row.reaction_count ?? 0),
  }));

  if (reviews.length === 0) return jsonSuccess({ reviews: [] }, { maxAge: 0 });

  return jsonSuccess({ reviews }, { maxAge: 900 });
}
