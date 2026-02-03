import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/profile/reviews-ratings-diary?userId=...
 * Returns watched items with score, public_review_text, and (for owner) review_text.
 * Same visibility rules as profile; respects profile_show_diary, profile_show_ratings, profile_show_public_reviews.
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
    .select(
      "visibility, profile_show_diary, profile_show_ratings, profile_show_public_reviews",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
    });
  }

  const visibility = String(profile.visibility ?? "public")
    .toLowerCase()
    .trim();
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
  const profileShowDiary = profile.profile_show_diary ?? true;
  const profileShowRatings = profile.profile_show_ratings ?? true;
  const profileShowPublicReviews = profile.profile_show_public_reviews ?? true;

  const { data: watchedRows, error: watchedError } = await supabase
    .from("watched_items")
    .select(
      "item_id, item_type, item_name, watched_at, review_text, public_review_text",
    )
    .eq("user_id", userId)
    .eq("is_watched", true)
    .order("watched_at", { ascending: false });

  if (watchedError) {
    return new Response(JSON.stringify({ error: watchedError.message }), {
      status: 500,
    });
  }

  const items = watchedRows ?? [];
  if (items.length === 0) {
    return new Response(JSON.stringify({ data: [] }));
  }

  const { data: ratings } = await supabase
    .from("user_ratings")
    .select("item_id, item_type, score")
    .eq("user_id", userId);

  const ratingsMap: Record<string, number> = {};
  for (const r of (ratings ?? []) as {
    item_id: string;
    item_type: string;
    score: number;
  }[]) {
    ratingsMap[`${r.item_id}:${r.item_type}`] = r.score;
  }

  const data = items
    .map(
      (row: {
        item_id: string;
        item_type: string;
        item_name: string;
        watched_at: string;
        review_text: string | null;
        public_review_text: string | null;
      }) => {
        const key = `${row.item_id}:${row.item_type}`;
        let score: number | null = ratingsMap[key] ?? null;
        let public_review_text: string | null = row.public_review_text;
        let review_text: string | null = row.review_text;

        if (!isOwner) {
          if (!profileShowRatings) score = null;
          if (!profileShowPublicReviews) public_review_text = null;
          review_text = null; // diary is never shown to visitors
        } else {
          if (!profileShowDiary) review_text = null;
        }

        return {
          item_id: row.item_id,
          item_type: row.item_type,
          item_name: row.item_name,
          watched_at: row.watched_at,
          score,
          public_review_text,
          review_text,
        };
      },
    )
    .filter(
      (item: {
        score: number | null;
        public_review_text: string | null;
        review_text: string | null;
      }) => {
        // Only show if there is at least one piece of content visible
        return (
          item.score !== null ||
          item.public_review_text !== null ||
          item.review_text !== null
        );
      },
    );

  return new Response(JSON.stringify({ data }));
}
