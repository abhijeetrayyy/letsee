/**
 * "People who love this also love…": the other favourites of the people on
 * letsee who favourited a title. Nothing from TMDB and no server — two reads
 * in the browser under RLS (favourites are visible as their owner's profile
 * is), and the counting here.
 *
 * Ranked by how many of those people share it, then by name; each comes with
 * the faces of the people who love both. You're left out of your own count.
 */
import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";
import { getPosterUrl } from "@/utils/imageUrl";

export type FanPick = {
  itemId: string;
  itemType: "movie" | "tv";
  name: string;
  imageUrl: string | null;
  fans: { username: string; avatarUrl: string | null }[];
};

export async function fansAlsoLove(itemId: string, itemType: "movie" | "tv", me: string | null): Promise<{ fans: number; picks: FanPick[] }> {
  const { data: lovers } = await supabase.from("favorite_items").select("user_id").eq("item_id", itemId).eq("item_type", itemType).limit(80);
  const blocked = await getBlockedUserIds(supabase, me);
  const ids = [...new Set((lovers ?? []).map((r) => r.user_id as string))].filter((id) => id !== me && !blocked.has(id));
  if (!ids.length) return { fans: 0, picks: [] };

  const [{ data: theirs }, { data: users }] = await Promise.all([
    supabase.from("favorite_items").select("user_id, item_id, item_type, item_name, image_url").in("user_id", ids).limit(1500),
    supabase.from("users").select("id, username, avatar_url").in("id", ids).is("deleted_at", null),
  ]);
  const who = new Map((users ?? []).filter((u) => u.username).map((u) => [u.id as string, { username: u.username as string, avatarUrl: (u.avatar_url as string | null) ?? null }]));

  const byTitle = new Map<string, FanPick & { by: Set<string> }>();
  for (const r of theirs ?? []) {
    const type = r.item_type === "tv" ? "tv" : "movie";
    if (String(r.item_id) === itemId && type === itemType) continue;
    const person = who.get(r.user_id as string);
    if (!person) continue;
    const key = `${type}:${r.item_id}`;
    const cur = byTitle.get(key) ?? { itemId: String(r.item_id), itemType: type, name: (r.item_name as string) ?? "", imageUrl: r.image_url ? getPosterUrl(r.image_url as string, "w342") : null, fans: [], by: new Set<string>() };
    if (!cur.by.has(r.user_id as string)) {
      cur.by.add(r.user_id as string);
      cur.fans.push(person);
    }
    byTitle.set(key, cur);
  }
  const picks = [...byTitle.values()]
    .sort((a, b) => b.by.size - a.by.size || a.name.localeCompare(b.name))
    .slice(0, 16)
    .map(({ by: _by, ...pick }) => pick);
  return { fans: who.size, picks };
}
