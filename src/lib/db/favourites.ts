import { supabase } from "@/utils/supabase/client";
import type { Favourite } from "@/lib/profile/favourites";

/**
 * A profile's favourites — the titles they hearted — read in the browser
 * under the viewer's RLS (`favorite_items_select_profile_visible`), newest
 * first. Five hundred is far past anyone's real list (the most on file is
 * 139); the section shows twenty and opens the rest in place.
 */
export async function fetchFavourites(userId: string, limit = 500): Promise<Favourite[]> {
  const { data, error } = await supabase
    .from("favorite_items")
    .select("item_id, item_type, item_name, image_url, genres")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    itemId: String(r.item_id),
    itemType: r.item_type === "tv" ? "tv" : "movie",
    itemName: (r.item_name as string | null) ?? "",
    imageUrl: (r.image_url as string | null) ?? null,
    genres: (r.genres as string[] | null) ?? [],
  }));
}

/** Just the keys (`type:id`) of your own favourites, to mark the ones you share. */
export async function fetchFavouriteKeys(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("favorite_items").select("item_id, item_type").eq("user_id", userId).limit(2000);
  return new Set((data ?? []).map((r) => `${r.item_type}:${r.item_id}`));
}

/**
 * Four titles that stand for someone — their chosen four, topped up from what
 * they hearted — for places that introduce a person in a glance (an
 * invitation). The four are readable by anyone (`user_favorite_display`);
 * favourites only where their profile is visible, so a private inviter shows
 * just the four they chose to show.
 */
export async function fetchLoves(userId: string, n = 4): Promise<{ key: string; itemName: string; imageUrl: string | null }[]> {
  const [{ data: four }, favourites] = await Promise.all([
    supabase.from("user_favorite_display").select("item_id, item_type, item_name, image_url").eq("user_id", userId).order("position").limit(n),
    fetchFavourites(userId, n * 2).catch(() => [] as Favourite[]),
  ]);
  const out: { key: string; itemName: string; imageUrl: string | null }[] = [];
  const add = (key: string, itemName: string, imageUrl: string | null) => {
    if (out.length < n && imageUrl && !out.some((x) => x.key === key)) out.push({ key, itemName, imageUrl });
  };
  for (const f of four ?? []) add(`${f.item_type}:${f.item_id}`, f.item_name as string, f.image_url as string | null);
  for (const f of favourites) add(`${f.itemType}:${f.itemId}`, f.itemName, f.imageUrl);
  return out;
}
