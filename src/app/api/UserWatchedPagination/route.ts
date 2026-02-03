import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { userID, page, genre } = await request.json();

  if (!userID) {
    return new Response(JSON.stringify({ error: "User ID is required" }), {
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
    .eq("id", userID)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
    });
  }

  const visibility = String(profile.visibility ?? "public").toLowerCase().trim();
  let canView = visibility === "public" || (viewerId && viewerId === userID);

  if (!canView && viewerId && visibility === "followers") {
    const { data: connection } = await supabase
      .from("user_connections")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", userID)
      .maybeSingle();
    if (connection) {
      canView = true;
    }
  }

  if (!canView) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    });
  }

  const safePage = Number(page) || 1;
  const isOwner = viewerId === userID;
  const profileShowDiary = profile.profile_show_diary ?? true;
  const profileShowRatings = profile.profile_show_ratings ?? true;
  const profileShowPublicReviews = profile.profile_show_public_reviews ?? true;

  // Initialize the query — only items currently in Watched list (is_watched = true)
  let query = supabase
    .from("watched_items")
    .select("*", { count: "exact" })
    .eq("user_id", userID)
    .eq("is_watched", true)
    .order("watched_at", { ascending: false });

  if (genre && typeof genre === "string") {
    query = query.overlaps("genres", [genre.trim()]);
  }

  const itemsPerPage = 50;
  query = query.range(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage - 1
  );

  const { data: items, error, count } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Fetch ratings for this user; then keep only those for items on this page
  let ratingsMap: Record<string, number> = {};
  if (items?.length) {
    const { data: ratings } = await supabase
      .from("user_ratings")
      .select("item_id, item_type, score")
      .eq("user_id", userID);
    const itemSet = new Set((items as { item_id: string; item_type: string }[]).map((i) => `${i.item_id}:${i.item_type}`));
    for (const r of (ratings ?? []) as { item_id: string; item_type: string; score: number }[]) {
      if (itemSet.has(`${r.item_id}:${r.item_type}`)) {
        ratingsMap[`${r.item_id}:${r.item_type}`] = r.score;
      }
    }
  }

  // Merge score into each item and apply visibility for visitors
  type Row = { item_id: string; item_type: string; review_text?: string | null; public_review_text?: string | null; [k: string]: unknown };
  const data = (items ?? []).map((row: Row) => {
    const key = `${row.item_id}:${row.item_type}`;
    const score = ratingsMap[key] ?? null;
    let out: Row & { score: number | null } = { ...row, score };
    if (!isOwner) {
      if (!profileShowDiary) out.review_text = null;
      if (!profileShowPublicReviews) out.public_review_text = null;
      if (!profileShowRatings) out.score = null;
    }
    return out;
  });

  return new Response(
    JSON.stringify({
      data,
      totalItems,
      totalPages,
    })
  );
}
