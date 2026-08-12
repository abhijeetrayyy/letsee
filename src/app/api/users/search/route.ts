import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonSuccess } from "@/utils/apiResponse";

type CountStats = {
  watched_count?: number;
  favorites_count?: number;
  watchlist_count?: number;
};

type Candidate = {
  id: string;
  username: string;
  about: string | null;
  avatar_url: string | null;
  user_cout_stats?: CountStats | CountStats[] | null;
};

const SELECT_FIELDS =
  "id, username, about, avatar_url, user_cout_stats (watched_count, favorites_count, watchlist_count)";

type SortKey = "recent" | "watched" | "favorites" | "watchlist";

function statOf(c: Candidate, key: keyof CountStats): number {
  const raw = Array.isArray(c.user_cout_stats) ? c.user_cout_stats[0] : c.user_cout_stats;
  return Number(raw?.[key] ?? 0);
}

/**
 * GET /api/users/search?q=&limit=&sort= — find people by username.
 * With no `q` this is the browse directory (recently-active public profiles),
 * which is what /app/profile renders. Works signed-out; blocking and
 * mutual-follow fields only populate when signed in.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 24, 1), 60);
  const sort = (req.nextUrl.searchParams.get("sort") ?? "recent") as SortKey;

  const viewerId = await getAuthUserId();
  const pattern = `%${q}%`;

  const base = () =>
    supabase.from("users").select(SELECT_FIELDS).not("username", "is", null).neq("username", "");

  // Browse mode: no query — most recently active public profiles.
  const queries = q
    ? [base().eq("visibility", "public").ilike("username", pattern).limit(limit)]
    : [
        base()
          .eq("visibility", "public")
          .order("updated_at", { ascending: false })
          .limit(limit),
      ];

  if (viewerId) {
    const { data: followedRows } = await supabase
      .from("user_connections")
      .select("followed_id")
      .eq("follower_id", viewerId);
    const followedIds = (followedRows ?? []).map((r) => r.followed_id);
    if (followedIds.length > 0) {
      // followers-only profiles are visible to people who already follow them
      const followersQuery = base().eq("visibility", "followers").in("id", followedIds).limit(limit);
      queries.push(q ? followersQuery.ilike("username", pattern) : followersQuery);
    }
  }

  const results = await Promise.all(queries);
  const merged = new Map<string, Candidate>();
  for (const r of results) {
    for (const row of (r.data ?? []) as Candidate[]) {
      merged.set(row.id, row);
    }
  }

  let candidates = [...merged.values()].filter((c) => c.id !== viewerId);

  let followingSet = new Set<string>();
  let followsMeSet = new Set<string>();

  if (viewerId && candidates.length > 0) {
    const ids = candidates.map((c) => c.id);
    const [{ data: blockedRows }, { data: followingRows }, { data: followsMeRows }] = await Promise.all([
      supabase
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
      supabase.from("user_connections").select("followed_id").eq("follower_id", viewerId).in("followed_id", ids),
      supabase.from("user_connections").select("follower_id").eq("followed_id", viewerId).in("follower_id", ids),
    ]);

    const blockedIds = new Set<string>();
    for (const b of blockedRows ?? []) {
      if (b.blocker_id === viewerId) blockedIds.add(b.blocked_id);
      if (b.blocked_id === viewerId) blockedIds.add(b.blocker_id);
    }
    candidates = candidates.filter((c) => !blockedIds.has(c.id));

    followingSet = new Set((followingRows ?? []).map((r) => r.followed_id));
    followsMeSet = new Set((followsMeRows ?? []).map((r) => r.follower_id));
  }

  if (q) {
    // Rank: exact username match, then startsWith, then contains
    const qLower = q.toLowerCase();
    const rank = (u: Candidate) => {
      const uname = (u.username ?? "").toLowerCase();
      if (uname === qLower) return 0;
      if (uname.startsWith(qLower)) return 1;
      if (uname.includes(qLower)) return 2;
      return 3;
    };
    candidates.sort((a, b) => rank(a) - rank(b));
  } else if (sort !== "recent") {
    // Browse mode sorts by an aggregate; the DB already returned them in
    // recency order, so only the stat sorts need re-ordering here.
    const key: keyof CountStats =
      sort === "watched"
        ? "watched_count"
        : sort === "favorites"
          ? "favorites_count"
          : "watchlist_count";
    candidates.sort((a, b) => statOf(b, key) - statOf(a, key));
  }

  const users = candidates.slice(0, limit).map((c) => ({
    id: c.id,
    username: c.username,
    about: c.about,
    avatar_url: c.avatar_url,
    isFollowing: followingSet.has(c.id),
    followsYou: followsMeSet.has(c.id),
    user_cout_stats: {
      watched_count: statOf(c, "watched_count"),
      favorites_count: statOf(c, "favorites_count"),
      watchlist_count: statOf(c, "watchlist_count"),
    },
  }));

  return jsonSuccess({ users });
}
