import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ActivityItem = {
  id: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  activity_type: "watched" | "rated" | "reviewed" | "list_created" | "favored";
  item_id: string | null;
  item_type: string | null;
  item_name: string | null;
  image_url: string | null;
  score: number | null;
  review_text: string | null;
  list_name: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  // Get users the current user follows
  const { data: following } = await supabase
    .from("user_connections")
    .select("followed_id")
    .eq("follower_id", user.id);

  const followedIds = following?.map((f) => f.followed_id) ?? [];

  // If user follows fewer than 3 people, supplement with popular public users
  let targetUserIds = [...followedIds];
  if (targetUserIds.length < 3) {
    const { data: popularUsers } = await supabase
      .from("user_cout_stats")
      .select("user_id")
      .order("watched_count", { ascending: false })
      .limit(20);

    if (popularUsers) {
      const popularIds = popularUsers
        .map((u) => u.user_id)
        .filter((id) => id !== user.id && !targetUserIds.includes(id));
      targetUserIds.push(...popularIds.slice(0, 10));
    }
  }

  if (targetUserIds.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null, hasMore: false });
  }

  // Build query for activity from watched_items
  let query = supabase
    .from("watched_items")
    .select(`
      id,
      user_id,
      item_id,
      item_type,
      item_name,
      image_url,
      review_text,
      public_review_text,
      watched_at,
      users!inner (
        username,
        avatar_url,
        about
      )
    `)
    .in("user_id", targetUserIds)
    .order("watched_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("watched_at", cursor);
  }

  const { data: watchedItems, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch ratings for same users to get "rated" activity
  const { data: ratings } = await supabase
    .from("user_ratings")
    .select(`
      id,
      user_id,
      item_id,
      item_type,
      score,
      created_at,
      updated_at
    `)
    .in("user_id", targetUserIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Also fetch recently created lists
  const { data: lists } = await supabase
    .from("user_lists")
    .select(`
      id,
      user_id,
      name,
      created_at
    `)
    .in("user_id", targetUserIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Fetch usernames for rating/list entries (we already have them for watched items)
  const allUserIds = [...new Set([
    ...(ratings?.map((r) => r.user_id) ?? []),
    ...(lists?.map((l) => l.user_id) ?? []),
  ])];

  const { data: users } = await supabase
    .from("users")
    .select("id, username, avatar_url, about")
    .in("id", allUserIds);

  const userMap = new Map(
    (users ?? []).map((u) => [u.id, { username: u.username, avatar_url: u.avatar_url, about: u.about }])
  );

  // Merge all activity into a single sorted list
  const activity: ActivityItem[] = [];

  for (const w of watchedItems ?? []) {
    const u = w.users as unknown as { username: string; avatar_url: string | null; about?: string } | null;
    activity.push({
      id: -(w.id),
      user_id: w.user_id,
      username: u?.username ?? "unknown",
      display_name: u?.about ?? null,
      avatar_url: u?.avatar_url ?? null,
      activity_type: w.public_review_text ? "reviewed" : "watched",
      item_id: w.item_id,
      item_type: w.item_type,
      item_name: w.item_name,
      image_url: w.image_url,
      score: null,
      review_text: w.public_review_text,
      list_name: null,
      created_at: w.watched_at,
    });
  }

  for (const r of ratings ?? []) {
    const u = userMap.get(r.user_id);
    if (!u) continue;

    // Check if this rating is already represented as a watched item
    const exists = activity.some(
      (a) => a.user_id === r.user_id && a.item_id === r.item_id && a.activity_type !== "rated"
    );
    if (exists) continue;

    activity.push({
      id: r.id,
      user_id: r.user_id,
      username: u.username ?? "unknown",
      display_name: u.about ?? null,
      avatar_url: u.avatar_url ?? null,
      activity_type: "rated",
      item_id: r.item_id,
      item_type: r.item_type,
      item_name: null,
      image_url: null,
      score: r.score,
      review_text: null,
      list_name: null,
      created_at: r.created_at,
    });
  }

  for (const l of lists ?? []) {
    const u = userMap.get(l.user_id);
    if (!u) continue;

    activity.push({
      id: l.id,
      user_id: l.user_id,
      username: u.username ?? "unknown",
      display_name: u.about ?? null,
      avatar_url: u.avatar_url ?? null,
      activity_type: "list_created",
      item_id: null,
      item_type: null,
      item_name: null,
      image_url: null,
      score: null,
      review_text: null,
      list_name: l.name,
      created_at: l.created_at,
    });
  }

  // Sort by created_at descending
  activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Paginate: take limit items
  const hasMore = activity.length > limit;
  const items = activity.slice(0, limit);
  const nextCursor = items.length > 0 ? items[items.length - 1].created_at : null;

  return NextResponse.json({
    items,
    nextCursor,
    hasMore,
    followedCount: followedIds.length,
    isSupplemented: followedIds.length < 3,
  });
}
