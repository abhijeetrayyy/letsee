import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * GET /api/reviews?itemId=123&itemType=movie&page=1&limit=10&sort=popular
 *
 * Public reviews for a title. No auth required; diary text is never exposed.
 *
 * **Defaults to popularity.** Ranking by recency puts the newest review above
 * the best one, which guarantees good writing sinks — and a review that sinks
 * is a review nobody had a reason to write. `sort=recent` keeps the old
 * behaviour for anywhere that genuinely wants a timeline.
 *
 * Popularity needs an aggregate over `reactions`, which PostgREST can't order
 * by, so it goes through the reviews_for_title RPC (062).
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
  const sort = searchParams.get("sort") === "recent" ? "recent" : "popular";

  if (sort === "popular") {
    const viewerId = await getAuthUserId();
    const { data, error: rpcError } = await supabase.rpc("reviews_for_title", {
      p_item_id: itemId,
      p_item_type: itemType,
      p_viewer: viewerId,
      p_limit: limit,
      p_offset: from,
    });

    if (!rpcError) {
      const reviews = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        userId: row.user_id,
        username: row.username ?? null,
        avatarUrl: row.avatar_url ?? null,
        reviewText: row.review_text ?? "",
        watchedAt: row.watched_at,
        score: row.score ?? null,
        reactionCount: Number(row.reaction_count ?? 0),
        viewerReacted: row.viewer_reacted === true,
      }));
      return jsonSuccess(
        { reviews, total: reviews.length, page, limit, sort },
        // Private: the response embeds whether *this* viewer reacted.
        { maxAge: 0 },
      );
    }

    // Migration 062 not applied yet, or the RPC failed — fall through to the
    // recency query rather than showing an empty reviews section.
    console.error("reviews_for_title:", rpcError);
  }

  const { data: rows, error, count } = await supabase
    .from("watched_items")
    .select(
      "id, user_id, public_review_text, watched_at, users!user_id(username)",
      { count: "exact" }
    )
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .not("public_review_text", "is", null)
    // A unique tiebreaker makes the sort total. Without it, rows sharing a
    // timestamp can reshuffle between pages — and they do share one: the
    // quick-add bulk endpoint stamps a single `now` across an entire batch, so
    // logging forty titles at once creates forty rows with identical times.
    .order("watched_at", { ascending: false })
    .order("id", { ascending: false })
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
    // Private, for the same reason the RPC path above is. This query reads
    // watched_items under the caller's own RLS, so the row set it returns
    // depends on who is asking — a follower of a followers-only profile sees
    // reviews an anonymous visitor does not. Nothing in the URL says which,
    // so a shared cache would hand the follower's wider answer to everyone.
    // Migration 073 sharpens this: once watched_items_select_public_reviews is
    // gone, `watched_items_select_profile_visible` is the only gate left, and
    // it is viewer-dependent by definition.
    { maxAge: 0 }
  );
}
