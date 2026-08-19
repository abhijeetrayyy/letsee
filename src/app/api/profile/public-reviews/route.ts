import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

/**
 * GET /api/profile/public-reviews?userId=...&page=1&limit=20
 * Returns all watched items for this user that have a public review (public_review_text IS NOT NULL).
 * Same visibility rules as profile: can view profile + profile_show_public_reviews for visitors.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  if (!userId) {
    return jsonError("userId is required", 400);
  }

  const viewerId = await getAuthUserId();

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("visibility, profile_show_public_reviews")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonError("User not found", 404);
  }

  const visibility = String(profile.visibility ?? "public").toLowerCase().trim();
  let canView = visibility === "public" || (viewerId && viewerId === userId);

  if (!canView && viewerId && visibility === "followers") {
    const { data: connection } = await supabase
      .from("user_connections")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", userId)
      .maybeSingle();
    if (connection) canView = true;
  }

  if (!canView) {
    return jsonError("Forbidden", 403);
  }

  const isOwner = viewerId === userId;
  const profileShowPublicReviews = profile.profile_show_public_reviews ?? true;
  if (!isOwner && !profileShowPublicReviews) {
    return new Response(
      JSON.stringify({ data: [], totalItems: 0, totalPages: 0 })
    );
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: items, error, count } = await supabase
    .from("watched_items")
    /**
     * Named columns, and `review_text` is deliberately not among them.
     *
     * This was `select("*")`, on an endpoint whose entire job is *public*
     * reviews — so every response shipped the private diary to the browser
     * alongside them, for any profile the viewer was allowed to see. The UI
     * never wanted it: ReviewsSection reads exactly the eight fields below.
     *
     * Migration 076 revoked SELECT on that column, which turns the old star
     * select into a 42501 and takes the whole section down with it. Naming the
     * columns fixes both the outage and the leak that preceded it.
     *
     * No `score` either, and not by omission: `watched_items` has no such
     * column. ReviewsSection's row type declares one and reads `item.score`,
     * so that field has been `undefined` on every review ever rendered —
     * `select("*")` never returned it either. Naming the columns is what made
     * that visible. Left alone here; wiring a real rating in means joining
     * user_ratings, which changes what this endpoint means.
     */
    .select(
      "id, item_id, item_type, item_name, image_url, watched_at, public_review_text",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .not("public_review_text", "is", null)
    // A unique tiebreaker makes the sort total. Without it, rows sharing a
    // timestamp can reshuffle between pages — and they do share one: the
    // quick-add bulk endpoint stamps a single `now` across an entire batch, so
    // logging forty titles at once creates forty rows with identical times.
    .order("watched_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / limit);

  return new Response(
    JSON.stringify({
      data: items ?? [],
      totalItems,
      totalPages,
    })
  );
}
