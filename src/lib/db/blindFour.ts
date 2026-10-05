/**
 * The deck for Blind four (People → Find people → Blind four): strangers'
 * four favourite films, without their names, until you choose to see who.
 *
 * Each card is a public profile's four (`user_favorite_display`), or — for
 * someone who never picked a four — their four most recent favourites. Never
 * you, never someone you already follow, never anyone blocked either way, and
 * never a private profile (their four stay behind their own rules). Two reads
 * for the films, one for the people, all in the browser under RLS; shuffled
 * here so every deal is different.
 */
import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";
import { getPosterUrl } from "@/utils/imageUrl";

export type BlindFilm = { itemId: string; itemType: "movie" | "tv"; name: string; imageUrl: string | null };
export type BlindCard = {
  person: { id: string; username: string; avatarUrl: string | null; tagline: string | null };
  four: BlindFilm[];
};

type Row = { user_id: string; item_id: string | number; item_type: string; item_name: string | null; image_url: string | null };

function film(r: Row): BlindFilm {
  return {
    itemId: String(r.item_id),
    itemType: r.item_type === "tv" ? "tv" : "movie",
    name: r.item_name ?? "",
    imageUrl: r.image_url ? getPosterUrl(r.image_url, "w342") : null,
  };
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function dealBlindFour(me: string): Promise<BlindCard[]> {
  const [{ data: fours }, { data: loved }, { data: mine }, blocked] = await Promise.all([
    supabase.from("user_favorite_display").select("user_id, position, item_id, item_type, item_name, image_url").order("position", { ascending: true }).limit(800),
    supabase.from("favorite_items").select("user_id, item_id, item_type, item_name, image_url, created_at").order("created_at", { ascending: false }).limit(1500),
    supabase.from("user_connections").select("followed_id").eq("follower_id", me),
    getBlockedUserIds(supabase, me),
  ]);
  const skip = new Set<string>([me, ...((mine ?? []).map((r) => r.followed_id as string)), ...blocked]);

  const byPerson = new Map<string, BlindFilm[]>();
  for (const r of (fours ?? []) as Row[]) {
    if (skip.has(r.user_id)) continue;
    const list = byPerson.get(r.user_id) ?? [];
    if (list.length < 4) list.push(film(r));
    byPerson.set(r.user_id, list);
  }
  // No four chosen: their latest four favourites stand in.
  for (const r of (loved ?? []) as Row[]) {
    if (skip.has(r.user_id)) continue;
    const list = byPerson.get(r.user_id) ?? [];
    if (list.length >= 4 || list.some((f) => f.itemId === String(r.item_id) && f.itemType === (r.item_type === "tv" ? "tv" : "movie"))) continue;
    list.push(film(r));
    byPerson.set(r.user_id, list);
  }

  const ids = [...byPerson.entries()].filter(([, list]) => list.length >= 3).map(([id]) => id);
  if (!ids.length) return [];
  const { data: people } = await supabase.from("users").select("id, username, avatar_url, tagline, visibility").in("id", ids).is("deleted_at", null);
  const cards: BlindCard[] = [];
  for (const u of people ?? []) {
    if (!u.username || String(u.visibility ?? "public").toLowerCase() !== "public") continue;
    cards.push({
      person: { id: u.id, username: u.username, avatarUrl: u.avatar_url ?? null, tagline: (u.tagline as string | null)?.trim() || null },
      four: byPerson.get(u.id)!.slice(0, 4),
    });
  }
  return shuffle(cards).slice(0, 12);
}
