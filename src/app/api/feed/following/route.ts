import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getBlockedUserIds } from "@/utils/blocks";

export const dynamic = "force-dynamic";

const SUPPLEMENT_THRESHOLD = 3;

type ActivityType =
  | "watched"
  | "rated"
  | "reviewed"
  | "list_created"
  | "favored"
  | "started_watching";

type ActivityItem = {
  id: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  activity_type: ActivityType;
  item_id: string | null;
  item_type: string | null;
  item_name: string | null;
  image_url: string | null;
  score: number | null;
  review_text: string | null;
  list_name: string | null;
  created_at: string;
  source_type: "review" | "rating" | "list" | null;
  source_id: number | null;
};

type ActivityRow = {
  id: number;
  user_id: string;
  activity_type: ActivityType;
  item_id: string | null;
  item_type: string | null;
  item_name: string | null;
  image_url: string | null;
  score: number | null;
  review_text: string | null;
  list_name: string | null;
  list_id: number | null;
  created_at: string;
};

/**
 * GET /api/feed/following — activity from people you follow.
 *
 * Reads a single indexed table (user_activity, which has a
 * (user_id, created_at) index) rather than merging four live queries in
 * memory. The previous implementation applied its cursor only to the
 * watched_items query, so page 2+ re-returned the same ratings/lists rows and
 * older ones were unreachable.
 *
 * Works signed-out: an anonymous visitor has no follows, so they fall through
 * to the popular-users supplement and see public community activity.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  const { data: following } = user
    ? await supabase
        .from("user_connections")
        .select("followed_id")
        .eq("follower_id", user.id)
    : { data: null };

  const followedIds = following?.map((f) => f.followed_id) ?? [];

  // Follow almost nobody? Supplement with the most active public users so the
  // feed is never empty — this is the cold-start fallback.
  let targetUserIds = [...followedIds];
  if (targetUserIds.length < SUPPLEMENT_THRESHOLD) {
    const { data: popularUsers } = await supabase
      .from("user_cout_stats")
      .select("user_id")
      .order("watched_count", { ascending: false })
      .limit(20);

    const popularIds = (popularUsers ?? [])
      .map((u) => u.user_id)
      .filter((id) => id !== user?.id && !targetUserIds.includes(id));
    targetUserIds.push(...popularIds.slice(0, 10));
  }

  const blockedIds = await getBlockedUserIds(supabase, user?.id ?? null);
  if (blockedIds.size > 0) {
    targetUserIds = targetUserIds.filter((id) => !blockedIds.has(id));
  }

  const emptyResponse = {
    items: [],
    nextCursor: null,
    hasMore: false,
    followedCount: followedIds.length,
    isSupplemented: followedIds.length < SUPPLEMENT_THRESHOLD,
  };

  if (targetUserIds.length === 0) {
    return NextResponse.json(emptyResponse, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  // Fetch one extra row to determine hasMore without a second count query.
  let query = supabase
    .from("user_activity")
    .select(
      "id, user_id, activity_type, item_id, item_type, item_name, image_url, score, review_text, list_name, list_id, created_at",
    )
    .in("user_id", targetUserIds)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) query = query.lt("created_at", cursor);

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const activityRows = (rows ?? []) as ActivityRow[];
  const hasMore = activityRows.length > limit;
  const page = activityRows.slice(0, limit);

  if (page.length === 0) {
    return NextResponse.json(emptyResponse, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  // Author profiles
  const authorIds = [...new Set(page.map((r) => r.user_id))];
  const { data: authors } = await supabase
    .from("users")
    .select("id, username, avatar_url, about")
    .in("id", authorIds);
  const authorById = new Map((authors ?? []).map((a) => [a.id, a]));

  // Resolve the reaction targets. user_activity stores list_id but not the
  // review/rating row id, so look those up for just this page's items.
  const reviewKeys = page.filter((r) => r.activity_type === "reviewed" && r.item_id);
  const ratingKeys = page.filter((r) => r.activity_type === "rated" && r.item_id);

  const [reviewRows, ratingRows] = await Promise.all([
    reviewKeys.length
      ? supabase
          .from("watched_items")
          .select("id, user_id, item_id")
          .in("user_id", [...new Set(reviewKeys.map((r) => r.user_id))])
          .in("item_id", [...new Set(reviewKeys.map((r) => r.item_id as string))])
      : Promise.resolve({ data: [] as { id: number; user_id: string; item_id: string }[] }),
    ratingKeys.length
      ? supabase
          .from("user_ratings")
          .select("id, user_id, item_id")
          .in("user_id", [...new Set(ratingKeys.map((r) => r.user_id))])
          .in("item_id", [...new Set(ratingKeys.map((r) => r.item_id as string))])
      : Promise.resolve({ data: [] as { id: number; user_id: string; item_id: string }[] }),
  ]);

  const reviewIdByKey = new Map(
    (reviewRows.data ?? []).map((r) => [`${r.user_id}:${r.item_id}`, r.id]),
  );
  const ratingIdByKey = new Map(
    (ratingRows.data ?? []).map((r) => [`${r.user_id}:${r.item_id}`, r.id]),
  );

  const items: ActivityItem[] = page.map((row) => {
    const author = authorById.get(row.user_id);
    const key = `${row.user_id}:${row.item_id}`;

    let source_type: ActivityItem["source_type"] = null;
    let source_id: number | null = null;
    if (row.activity_type === "reviewed") {
      source_type = "review";
      source_id = reviewIdByKey.get(key) ?? null;
    } else if (row.activity_type === "rated") {
      source_type = "rating";
      source_id = ratingIdByKey.get(key) ?? null;
    } else if (row.activity_type === "list_created") {
      source_type = "list";
      source_id = row.list_id;
    }

    return {
      id: row.id,
      user_id: row.user_id,
      username: author?.username ?? "user",
      display_name: author?.about ?? null,
      avatar_url: author?.avatar_url ?? null,
      activity_type: row.activity_type,
      item_id: row.item_id,
      item_type: row.item_type,
      item_name: row.item_name,
      image_url: row.image_url,
      score: row.score,
      review_text: row.review_text,
      list_name: row.list_name,
      created_at: row.created_at,
      source_type: source_id != null ? source_type : null,
      source_id,
    };
  });

  return NextResponse.json(
    {
      items,
      nextCursor: page[page.length - 1]?.created_at ?? null,
      hasMore,
      followedCount: followedIds.length,
      isSupplemented: followedIds.length < SUPPLEMENT_THRESHOLD,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
