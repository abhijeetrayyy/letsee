import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/profile/reviews-ratings-diary?userId=...
 * Returns watched items that have at least one of: diary (review_text), public review, or rating.
 * Row-friendly: item_id, item_type, item_name, watched_at, score, public_review_text, review_text (owner only).
 * Diary is always hidden from visitors (only owner sees review_text).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

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
    .select("visibility, profile_show_diary, profile_show_ratings, profile_show_public_reviews")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
    });
  }

  const visibility = profile.visibility ?? "public";
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
  const profileShowPublicReviews = profile.profile_show_public_reviews ?? true;

  // Fetch watched items (up to 100, order by watched_at desc)
  const { data: items, error: itemsError } = await supabase
    .from("watched_items")
    .select("item_id, item_type, item_name, watched_at, review_text, public_review_text")
    .eq("user_id", userId)
    .order("watched_at", { ascending: false })
    .limit(100);

  if (itemsError) {
    return new Response(JSON.stringify({ error: itemsError.message }), {
      status: 500,
    });
  }

  // Fetch ratings for this user
  let ratingsMap: Record<string, number> = {};
  if (items?.length) {
    const { data: ratings } = await supabase
      .from("user_ratings")
      .select("item_id, item_type, score")
      .eq("user_id", userId);
    for (const r of (ratings ?? []) as { item_id: string; item_type: string; score: number }[]) {
      ratingsMap[`${r.item_id}:${r.item_type}`] = r.score;
    }
  }

  type Row = {
    item_id: string;
    item_type: string;
    item_name: string;
    watched_at: string;
    review_text?: string | null;
    public_review_text?: string | null;
  };
  const merged = (items ?? []).map((row: Row) => {
    const key = `${row.item_id}:${row.item_type}`;
    const score = ratingsMap[key] ?? null;
    return { ...row, score };
  });

  // Keep only rows that have at least one of: diary, public review, or rating
  const filtered = merged.filter(
    (row: Row & { score: number | null }) =>
      (row.review_text != null && row.review_text.trim() !== "") ||
      (row.public_review_text != null && row.public_review_text.trim() !== "") ||
      row.score != null
  );

  // Apply visibility for visitors: never send diary; null score/public_review if toggles off
  const data = filtered.map((row: Row & { score: number | null }) => {
    const out = { ...row };
    if (!isOwner) {
      (out as Record<string, unknown>).review_text = null; // diary always hidden from public
      if (!profileShowRatings) (out as Record<string, unknown>).score = null;
      if (!profileShowPublicReviews) (out as Record<string, unknown>).public_review_text = null;
    }
    return out;
  });

  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
}
