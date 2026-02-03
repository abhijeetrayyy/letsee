import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * GET /api/reviews?itemId=123&itemType=movie&page=1&limit=10
 * Public: returns paginated public reviews for a title (no auth required).
 * Only rows with public_review_text set are visible (RLS). Diary (review_text) is never exposed here.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const itemType = searchParams.get("itemType");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  if (!itemId || !itemType) {
    return jsonError("Missing itemId or itemType", 400);
  }
  if (itemType !== "movie" && itemType !== "tv") {
    return jsonError("itemType must be movie or tv", 400);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: rows, error, count } = await supabase
    .from("watched_items")
    .select(
      "id, user_id, public_review_text, watched_at, users!user_id(username)",
      { count: "exact" }
    )
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .not("public_review_text", "is", null)
    .order("watched_at", { ascending: false })
    .range(from, to);

  if (error) {
    return jsonError(error.message || "Failed to fetch reviews", 500);
  }

  const total = count ?? (rows?.length ?? 0);
  const reviews = (rows ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    username: row.users?.username ?? null,
    reviewText: row.public_review_text ?? "",
    watchedAt: row.watched_at,
  }));

  return jsonSuccess(
    {
      reviews,
      total: typeof total === "number" ? total : reviews.length,
      page,
      limit,
    },
    { maxAge: 60 }
  );
}
