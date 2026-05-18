import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/profile/film-diary?userId=...&page=1&limit=30&year=2024&month=3
 * Returns watched items with poster images, ratings, and dates for film diary grid.
 * Respects profile visibility settings.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30));
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!userId) {
    return new Response(JSON.stringify({ error: "userId is required" }), {
      status: 400,
    });
  }

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const viewerId = viewer?.id ?? null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("visibility, profile_show_ratings")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
    });
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
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    });
  }

  const isOwner = viewerId === userId;
  const profileShowRatings = profile.profile_show_ratings ?? true;

  // Build date filter
  let dateFilter = supabase
    .from("watched_items")
    .select("id, item_id, item_type, item_name, image_url, watched_at, score, review_text", { count: "exact" })
    .eq("user_id", userId)
    .eq("is_watched", true);

  if (year) {
    const yearStart = new Date(Number(year), 0, 1).toISOString();
    const yearEnd = new Date(Number(year), 11, 31, 23, 59, 59).toISOString();
    dateFilter = dateFilter.gte("watched_at", yearStart).lte("watched_at", yearEnd);
  }

  if (year && month) {
    const monthStart = new Date(Number(year), Number(month) - 1, 1).toISOString();
    const monthEnd = new Date(Number(year), Number(month), 0, 23, 59, 59).toISOString();
    dateFilter = dateFilter.gte("watched_at", monthStart).lte("watched_at", monthEnd);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: items, error, count } = await dateFilter
    .order("watched_at", { ascending: false })
    .range(from, to);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / limit);

  // If not owner and ratings are hidden, remove scores
  const sanitizedItems = items?.map((item) => ({
    ...item,
    score: !isOwner && !profileShowRatings ? null : item.score,
  })) ?? [];

  return new Response(
    JSON.stringify({
      data: sanitizedItems,
      totalItems,
      totalPages,
      page,
    })
  );
}
