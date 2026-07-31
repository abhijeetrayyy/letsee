import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonSuccess } from "@/utils/apiResponse";

type Candidate = {
  id: string;
  username: string;
  about: string | null;
  avatar_url: string | null;
};

/** GET /api/users/search?q=&limit= — find people by username/bio. Works signed-out; blocking and mutual-follow fields only populate when signed in. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 20, 1), 30);

  if (!q) return jsonSuccess({ users: [] });

  const viewerId = await getAuthUserId();
  const pattern = `%${q}%`;

  const queries = [
    supabase
      .from("users")
      .select("id, username, about, avatar_url")
      .eq("visibility", "public")
      .not("username", "is", null)
      .ilike("username", pattern)
      .limit(limit),
  ];

  if (viewerId) {
    const { data: followedRows } = await supabase
      .from("user_connections")
      .select("followed_id")
      .eq("follower_id", viewerId);
    const followedIds = (followedRows ?? []).map((r) => r.followed_id);
    if (followedIds.length > 0) {
      queries.push(
        supabase
          .from("users")
          .select("id, username, about, avatar_url")
          .eq("visibility", "followers")
          .in("id", followedIds)
          .ilike("username", pattern)
          .limit(limit)
      );
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

  // Rank: exact username match, then startsWith, then contains (about matches sort last)
  const qLower = q.toLowerCase();
  const rank = (u: Candidate) => {
    const uname = (u.username ?? "").toLowerCase();
    if (uname === qLower) return 0;
    if (uname.startsWith(qLower)) return 1;
    if (uname.includes(qLower)) return 2;
    return 3;
  };
  candidates.sort((a, b) => rank(a) - rank(b));

  const users = candidates.slice(0, limit).map((c) => ({
    id: c.id,
    username: c.username,
    about: c.about,
    avatar_url: c.avatar_url,
    isFollowing: followingSet.has(c.id),
    followsYou: followsMeSet.has(c.id),
  }));

  return jsonSuccess({ users });
}
