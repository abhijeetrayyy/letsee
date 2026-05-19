import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/friends-watched?itemId=123&itemType=movie
// Returns avatars of followed users who watched/rated/reviewed this item
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ friends: [] });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const itemType = searchParams.get("itemType");

  if (!itemId || !itemType) {
    return NextResponse.json({ error: "itemId and itemType required" }, { status: 400 });
  }

  // Get users the current user follows
  const { data: following } = await supabase
    .from("user_connections")
    .select("followed_id")
    .eq("follower_id", user.id);

  const followedIds = following?.map((f) => f.followed_id) ?? [];
  if (followedIds.length === 0) {
    return NextResponse.json({ friends: [] });
  }

  // Find which of those users watched/rated/reviewed this item
  const [watchedResult, ratedResult] = await Promise.all([
    supabase
      .from("watched_items")
      .select("user_id, watched_at, public_review_text, item_name")
      .in("user_id", followedIds)
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .limit(20),
    supabase
      .from("user_ratings")
      .select("user_id, score, created_at")
      .in("user_id", followedIds)
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .limit(20),
  ]);

  // Collect unique user IDs who engaged
  const engagementMap = new Map<string, { action: string; date: string; review?: string }>();

  for (const w of watchedResult.data ?? []) {
    const existing = engagementMap.get(w.user_id);
    const action = w.public_review_text ? "reviewed" : "watched";
    if (!existing || existing.action === "watched") {
      engagementMap.set(w.user_id, { action, date: w.watched_at, review: w.public_review_text ?? undefined });
    }
  }

  for (const r of ratedResult.data ?? []) {
    if (!engagementMap.has(r.user_id)) {
      engagementMap.set(r.user_id, { action: "rated", date: r.created_at });
    }
  }

  if (engagementMap.size === 0) {
    return NextResponse.json({ friends: [] });
  }

  // Fetch user profiles
  const engagedIds = [...engagementMap.keys()];
  const { data: profiles } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .in("id", engagedIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const friends = engagedIds.map((uid) => {
    const p = profileMap.get(uid);
    const e = engagementMap.get(uid)!;
    return {
      userId: uid,
      username: p?.username ?? "unknown",
      avatarUrl: p?.avatar_url ?? null,
      action: e.action as "watched" | "rated" | "reviewed",
      date: e.date,
      review: e.review ?? null,
    };
  });

  return NextResponse.json({ friends });
}
