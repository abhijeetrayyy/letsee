/**
 * The reads behind Search (docs/design/PAGES.md §4) that go to Postgres
 * rather than TMDB: people on letsee, lists, and which of your people have
 * seen a title. All in the browser under the viewer's own RLS.
 *
 * Nothing here sorts by volume. People are matched by name and introduced by
 * what you share; lists by name and recency.
 */
import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";
import { titleMetaFor } from "@/utils/viewings";
import type { RoomPerson } from "@/lib/db/rooms";

/** `ilike` treats `%`, `_` and `\` as pattern characters; a query is not a pattern. */
function literal(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type FoundPerson = RoomPerson & { showsRatings: boolean };

export async function searchUsers(query: string, me: string | null): Promise<FoundPerson[]> {
  const q = query.trim().replace(/^@/, "");
  if (q.length < 2) return [];
  let req = supabase
    .from("users")
    .select("id, username, avatar_url, profile_show_ratings")
    .ilike("username", `%${literal(q)}%`)
    .is("deleted_at", null)
    .order("username")
    .limit(20);
  if (me) req = req.neq("id", me);
  const [{ data }, blocked] = await Promise.all([req, getBlockedUserIds(supabase, me)]);
  // Names that start with what you typed come first; then the rest, alphabetically.
  const lower = q.toLowerCase();
  return (data ?? [])
    .filter((u) => u.username && !blocked.has(u.id))
    .map((u) => ({ id: u.id, username: u.username as string, avatarUrl: u.avatar_url, showsRatings: u.profile_show_ratings !== false }))
    .sort((a, b) => Number(!a.username.toLowerCase().startsWith(lower)) - Number(!b.username.toLowerCase().startsWith(lower)))
    .slice(0, 12);
}

/**
 * "You both loved Aftersun": one film each person loved that you loved too.
 * Two queries for the whole result list, not one per person: your ★4½-and-up
 * titles, then theirs among those. Their ratings arrive only where their
 * profile is visible to you, and a person who hides their numbers gets no line.
 */
export async function sharedLoves(me: string, people: FoundPerson[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = people.filter((p) => p.showsRatings).map((p) => p.id);
  if (!ids.length) return out;
  const { data: mine } = await supabase
    .from("user_ratings")
    .select("item_id, item_type")
    .eq("user_id", me)
    .gte("score", 9)
    .order("updated_at", { ascending: false })
    .limit(400);
  const loved = new Set((mine ?? []).map((r) => `${r.item_type}:${r.item_id}`));
  if (!loved.size) return out;
  const { data: theirs } = await supabase
    .from("user_ratings")
    .select("user_id, item_id, item_type")
    .in("user_id", ids)
    .in("item_id", [...new Set((mine ?? []).map((r) => r.item_id))])
    .gte("score", 9)
    .limit(1000);
  const firstKey = new Map<string, string>();
  for (const r of theirs ?? []) {
    const k = `${r.item_type}:${r.item_id}`;
    if (loved.has(k) && !firstKey.has(r.user_id)) firstKey.set(r.user_id, k);
  }
  if (!firstKey.size) return out;
  const names = await titleMetaFor(supabase, me, [...new Set([...firstKey.values()].map((k) => k.split(":")[1]))]);
  for (const [userId, k] of firstKey) {
    const name = names.get(k)?.name;
    if (name) out.set(userId, name);
  }
  return out;
}

export type FoundList = { id: number; name: string; description: string | null; owner: string | null; updatedAt: string };

/** Lists by name: public ones, plus your own and those you edit (050's policy decides). */
export async function searchLists(query: string): Promise<FoundList[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data } = await supabase
    .from("user_lists")
    .select("id, name, description, updated_at, user_id")
    .ilike("name", `%${literal(q)}%`)
    .order("updated_at", { ascending: false })
    .limit(20);
  const rows = data ?? [];
  const ownerIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: owners } = ownerIds.length ? await supabase.from("users").select("id, username").in("id", ownerIds) : { data: [] };
  const byId = new Map((owners ?? []).map((u) => [u.id, u.username as string | null]));
  return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, owner: byId.get(r.user_id) ?? null, updatedAt: r.updated_at }));
}

/** Which of your people have watched or are watching each title, keyed `type:id`. */
export async function peopleOnTitles(people: RoomPerson[], keys: string[]): Promise<Map<string, RoomPerson[]>> {
  const out = new Map<string, RoomPerson[]>();
  if (!people.length || !keys.length) return out;
  const byId = new Map(people.map((p) => [p.id, p]));
  const { data } = await supabase
    .from("user_media_status")
    .select("user_id, item_id, item_type")
    .in("user_id", [...byId.keys()])
    .in("item_id", [...new Set(keys.map((k) => k.split(":")[1]))])
    .in("status", ["watched", "watching"])
    .limit(1000);
  for (const r of data ?? []) {
    const k = `${r.item_type}:${r.item_id}`;
    if (!keys.includes(k)) continue;
    const p = byId.get(r.user_id);
    if (!p) continue;
    const list = out.get(k) ?? [];
    if (!list.some((x) => x.id === p.id)) list.push(p);
    out.set(k, list);
  }
  return out;
}

export type ActivePerson = RoomPerson & { lastTitle: string | null; lastAt: string };

/**
 * People who logged something lately, each with what it was — "Watched Past
 * Lives · 2d" says more about whether you'd get along than a name does. The
 * title comes from their own library row for it, under the same visibility
 * rules as their profile; when that isn't readable, the line is just the time.
 */
export async function recentlyActive(me: string | null, exclude: Set<string>, limit = 8): Promise<ActivePerson[]> {
  const { data } = await supabase.from("viewings").select("user_id, item_id, item_type, created_at").order("created_at", { ascending: false }).limit(200);
  const latest = new Map<string, { itemId: string; itemType: string; at: string }>();
  for (const r of data ?? []) {
    if (r.user_id === me || exclude.has(r.user_id) || latest.has(r.user_id)) continue;
    latest.set(r.user_id, { itemId: String(r.item_id), itemType: String(r.item_type), at: String(r.created_at) });
    if (latest.size >= limit) break;
  }
  const ids = [...latest.keys()];
  if (!ids.length) return [];
  const [{ data: users }, blocked, { data: names }] = await Promise.all([
    supabase.from("users").select("id, username, avatar_url").in("id", ids).is("deleted_at", null),
    getBlockedUserIds(supabase, me),
    supabase
      .from("user_media_status")
      .select("user_id, item_id, item_type, item_name")
      .in("user_id", ids)
      .in("item_id", [...new Set([...latest.values()].map((v) => v.itemId))]),
  ]);
  const titleOf = new Map((names ?? []).map((n) => [`${n.user_id}:${n.item_type}:${n.item_id}`, n.item_name as string | null]));
  const byId = new Map((users ?? []).filter((u) => u.username && !blocked.has(u.id)).map((u) => [u.id, { id: u.id, username: u.username as string, avatarUrl: u.avatar_url }]));
  return ids.flatMap((id) => {
    const person = byId.get(id);
    const last = latest.get(id)!;
    return person ? [{ ...person, lastAt: last.at, lastTitle: titleOf.get(`${id}:${last.itemType}:${last.itemId}`) ?? null }] : [];
  });
}

/** Each person's profile visibility, so Follow can send a request to a private one. */
export async function visibilityOf(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from("users").select("id, visibility").in("id", ids);
  return new Map((data ?? []).map((u) => [u.id, String(u.visibility ?? "public").toLowerCase()]));
}
