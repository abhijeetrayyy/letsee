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
    .select("*", { count: "exact" })
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
