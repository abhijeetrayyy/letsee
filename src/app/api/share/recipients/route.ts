import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

/**
 * The people you would actually send a title to, without being asked to type.
 *
 * The old picker searched and nothing else: with an empty box it showed an
 * empty list, so sharing began by demanding you remember a username. That is
 * backwards — you share with the handful of people you already follow, and a
 * search field is for the rare case where they are not in that handful.
 *
 * Mutuals come first. Someone who follows you back is a conversation; someone
 * you follow one-way may be a stranger you admire, and a share to them reads
 * differently. Ordering by that costs one extra column and makes the default
 * list right for almost everyone.
 */

type Row = { id: string; username: string | null; avatar_url: string | null };

export async function GET(req: NextRequest) {
  const viewerId = await getAuthUserId();
  if (!viewerId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const [outbound, inbound, blocks] = await Promise.all([
    supabase.from("user_connections").select("followed_id").eq("follower_id", viewerId),
    supabase.from("user_connections").select("follower_id").eq("followed_id", viewerId),
    /**
     * Blocking usually severs the follow, but not always — a block placed after
     * a mutual follow can leave the row behind, and offering that person as a
     * send target is the one mistake this list must not make.
     */
    supabase
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
  ]);

  const barred = new Set<string>();
  for (const b of (blocks.data ?? []) as { blocker_id: string; blocked_id: string }[]) {
    barred.add(b.blocker_id === viewerId ? b.blocked_id : b.blocker_id);
  }

  const iFollow = new Set((outbound.data ?? []).map((r) => r.followed_id as string));
  const followsMe = new Set((inbound.data ?? []).map((r) => r.follower_id as string));

  // A one-way follower is still a plausible recipient — they chose to hear from
  // you — so the pool is the union rather than just the people you follow.
  const pool = [...new Set([...iFollow, ...followsMe])].filter((id) => !barred.has(id));

  let people: Row[] = [];
  if (pool.length > 0) {
    let sel = supabase.from("users").select("id, username, avatar_url").in("id", pool);
    if (q) sel = sel.ilike("username", `%${q}%`);
    const { data } = await sel.limit(100);
    people = (data ?? []) as Row[];
  }

  const rank = (id: string) => (iFollow.has(id) && followsMe.has(id) ? 0 : iFollow.has(id) ? 1 : 2);

  const connections = people
    .filter((p) => p.username)
    .map((p) => ({
      id: p.id,
      username: p.username as string,
      avatarUrl: p.avatar_url,
      mutual: iFollow.has(p.id) && followsMe.has(p.id),
      following: iFollow.has(p.id),
    }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.username.localeCompare(b.username));

  /**
   * Searching beyond your connections is a second, explicit result group rather
   * than one merged list. Merging them means a stranger with a closer-matching
   * username outranks the friend you were reaching for.
   */
  let others: { id: string; username: string; avatarUrl: string | null }[] = [];
  if (q.length >= 2) {
    const seen = new Set([...pool, viewerId, ...barred]);
    const { data } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .ilike("username", `%${q}%`)
      .limit(20);
    others = ((data ?? []) as Row[])
      .filter((p) => p.username && !seen.has(p.id))
      .map((p) => ({ id: p.id, username: p.username as string, avatarUrl: p.avatar_url }));
  }

  return jsonSuccess({ connections, others }, { maxAge: 0 });
}
