import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

/**
 * GET /api/tonight/people — who the caller can put in a room.
 *
 * Same rule POST /api/tonight enforces: a connection in either direction.
 * Keeping the list and the check in agreement matters, because the reason
 * strings name people ("Priya has this on their watchlist"), which makes an
 * unchecked room a way to read a stranger's watchlist.
 *
 * Mutuals sort first — the people you actually watch with.
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const { data: connections, error } = await supabase
    .from("user_connections")
    .select("follower_id, followed_id")
    .or(`follower_id.eq.${userId},followed_id.eq.${userId}`);

  if (error) {
    console.error("tonight people:", error);
    return jsonError("Failed to load your people", 500);
  }

  const following = new Set<string>();
  const followers = new Set<string>();
  for (const c of connections ?? []) {
    if (c.follower_id === userId) following.add(c.followed_id as string);
    else followers.add(c.follower_id as string);
  }

  const ids = [...new Set([...following, ...followers])];
  if (ids.length === 0) return jsonSuccess({ people: [] });

  const { data: users } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .in("id", ids);

  const people = (users ?? [])
    .map((u) => ({
      userId: u.id as string,
      username: (u.username as string) ?? "user",
      avatarUrl: (u.avatar_url as string) ?? null,
      mutual: following.has(u.id as string) && followers.has(u.id as string),
    }))
    .sort((a, b) => {
      if (a.mutual !== b.mutual) return a.mutual ? -1 : 1;
      return a.username.localeCompare(b.username);
    });

  return jsonSuccess({ people });
}
