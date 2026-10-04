import { supabase } from "@/utils/supabase/client";

/**
 * The people you'd name or send something to, read in the browser.
 *
 * This was `/api/share/recipients`: a function invocation on every pause in
 * typing, which read nothing a browser can't — follows are public
 * (`user_connections_select_public`), your own blocks are yours
 * (`user_blocks_self`), and usernames are public — through a client holding
 * the same session. Same answer, same order, no function:
 *
 *   connections — people you follow or who follow you (mutuals first, then
 *                 people you follow, then followers), minus anyone you've
 *                 blocked; filtered by the search when there is one;
 *   others      — with two or more characters typed, anyone else whose
 *                 username contains them, as a separate group, so a stranger
 *                 with a closer-matching name never outranks a friend.
 *
 * Also leaves out closed accounts, and treats `%` and `_` in the search as
 * letters rather than wildcards — the route did neither.
 */
export type Recipient = { id: string; username: string; avatarUrl: string | null; mutual: boolean; following: boolean };
export type Recipients = { connections: Recipient[]; others: Omit<Recipient, "mutual" | "following">[] };

const literal = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function fetchRecipients(me: string, query = ""): Promise<Recipients> {
  const q = query.trim();
  const [outbound, inbound, blocks] = await Promise.all([
    supabase.from("user_connections").select("followed_id").eq("follower_id", me),
    supabase.from("user_connections").select("follower_id").eq("followed_id", me),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", me),
  ]);
  const barred = new Set((blocks.data ?? []).map((b) => b.blocked_id as string));
  const iFollow = new Set((outbound.data ?? []).map((r) => r.followed_id as string));
  const followsMe = new Set((inbound.data ?? []).map((r) => r.follower_id as string));
  const pool = [...new Set([...iFollow, ...followsMe])].filter((id) => !barred.has(id));

  let connections: Recipient[] = [];
  if (pool.length) {
    let sel = supabase.from("users").select("id, username, avatar_url").in("id", pool).is("deleted_at", null);
    if (q) sel = sel.ilike("username", `%${literal(q)}%`);
    const { data } = await sel.limit(100);
    const rank = (id: string) => (iFollow.has(id) && followsMe.has(id) ? 0 : iFollow.has(id) ? 1 : 2);
    connections = (data ?? [])
      .filter((p) => p.username)
      .map((p) => ({
        id: p.id as string,
        username: p.username as string,
        avatarUrl: (p.avatar_url as string | null) ?? null,
        mutual: iFollow.has(p.id) && followsMe.has(p.id),
        following: iFollow.has(p.id),
      }))
      .sort((a, b) => rank(a.id) - rank(b.id) || a.username.localeCompare(b.username));
  }

  let others: Recipients["others"] = [];
  if (q.length >= 2) {
    const seen = new Set([...pool, me, ...barred]);
    const { data } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .ilike("username", `%${literal(q)}%`)
      .is("deleted_at", null)
      .limit(20);
    others = (data ?? [])
      .filter((p) => p.username && !seen.has(p.id))
      .map((p) => ({ id: p.id as string, username: p.username as string, avatarUrl: (p.avatar_url as string | null) ?? null }));
  }

  return { connections, others };
}
