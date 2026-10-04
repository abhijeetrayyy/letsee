/**
 * Up next: your queue (docs/design/PAGES.md §3, RETHINK.md §6).
 *
 * Saves come from your own `user_media_status` rows and the passes from
 * `title_recommendations`, both read in the browser under your own RLS — the
 * page itself is static. The thank-you is an ordinary message in the room,
 * and "Not for me" uses the pass's existing `dismissed_at`, so the queue
 * needed no new storage (migration 106 was planned for this and dropped).
 */
import { supabase } from "@/utils/supabase/client";
import type { Save, SaveFor } from "@/lib/people/lanes";

export type { Save, SaveFor, Lane } from "@/lib/people/lanes";

export async function fetchSaves(me: string, region: string): Promise<Save[]> {
  const { data, error } = await supabase
    .from("user_media_status")
    .select("item_id, item_name, item_type, image_url, genres, updated_at, saved_at, save_note, save_for, save_for_date, save_with_user_id, save_with_name")
    .eq("user_id", me)
    .eq("status", "watchlist")
    .order("saved_at", { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) throw error;
  const rows = data ?? [];

  const withIds = [...new Set(rows.map((r) => r.save_with_user_id).filter((x): x is string => !!x))];
  const itemIds = rows.map((r) => r.item_id);
  const [people, leavingRows] = await Promise.all([
    withIds.length
      ? supabase.from("users").select("id, username, avatar_url").in("id", withIds).then(({ data: u }) => u ?? [])
      : Promise.resolve([]),
    // "Leaves Netflix on the 30th", where the daily job has learned a date.
    itemIds.length
      ? supabase
          .from("title_availability")
          .select("item_id, item_type, provider_name, expires_on")
          .eq("region", region)
          .in("item_id", itemIds)
          .not("expires_on", "is", null)
          .gte("expires_on", new Date().toISOString().slice(0, 10))
          .order("expires_on")
          .then(({ data: a }) => a ?? [])
      : Promise.resolve([]),
  ]);
  const byId = new Map(people.filter((u) => u.username).map((u) => [u.id, { id: u.id, username: u.username as string, avatarUrl: u.avatar_url }]));
  const leaving = new Map<string, { provider: string; on: string }>();
  for (const e of leavingRows) {
    const k = `${e.item_type}:${e.item_id}`;
    if (!leaving.has(k)) leaving.set(k, { provider: e.provider_name as string, on: e.expires_on as string });
  }

  return rows.map((r) => {
    const type: "movie" | "tv" = r.item_type === "tv" ? "tv" : "movie";
    return {
      itemId: r.item_id,
      itemType: type,
      itemName: r.item_name,
      imageUrl: r.image_url,
      genres: (r.genres as string[] | null) ?? [],
      savedAt: (r.saved_at as string | null) ?? (r.updated_at as string | null),
      note: (r.save_note as string | null) ?? null,
      saveFor: (r.save_for as SaveFor) ?? null,
      saveForDate: (r.save_for_date as string | null) ?? null,
      withPerson: r.save_with_user_id ? byId.get(r.save_with_user_id) ?? null : null,
      withName: (r.save_with_name as string | null) ?? null,
      leaving: leaving.get(`${type}:${r.item_id}`) ?? null,
    };
  });
}

/** "Not for me": quietly set aside. The giver is never told (RETHINK.md §6). */
export async function setPassAside(me: string, passId: number): Promise<string | null> {
  const { error } = await supabase
    .from("title_recommendations")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", passId)
    .eq("to_user_id", me);
  return error ? "Couldn't set that aside." : null;
}

/** Undo for "Not for me". */
export async function restorePass(me: string, passId: number): Promise<string | null> {
  const { error } = await supabase.from("title_recommendations").update({ dismissed_at: null }).eq("id", passId).eq("to_user_id", me);
  return error ? "Couldn't bring that back." : null;
}

/** Save a pass to your list, still from the person who passed it (097's "who"). */
export async function savePass(pass: {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  note: string | null;
  fromUserId: string;
}): Promise<string | null> {
  const res = await fetch("/api/user-media-status", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      itemId: pass.itemId,
      itemType: pass.itemType,
      status: "watchlist",
      name: pass.itemName,
      imgUrl: pass.imageUrl ?? "",
      saveWithUserId: pass.fromUserId,
      ...(pass.note ? { saveNote: pass.note } : {}),
    }),
  }).catch(() => null);
  return res?.ok ? null : "Couldn't save that.";
}

/** Your own rating of a title, for the thank-you's first line. */
export async function myScore(me: string, itemId: string, itemType: "movie" | "tv"): Promise<number | null> {
  const { data } = await supabase.from("user_ratings").select("score").eq("user_id", me).eq("item_id", itemId).eq("item_type", itemType).maybeSingle();
  return data?.score != null ? Number(data.score) : null;
}

/** The thank-you: a message in their room, in your words. */
export async function sendThanks(me: string, to: string, text: string): Promise<string | null> {
  const content = text.trim().slice(0, 2000);
  if (!content) return "Say something first.";
  const { error } = await supabase.from("messages").insert({ sender_id: me, recipient_id: to, content, message_type: "text" });
  return error ? "Couldn't send that. Try again." : null;
}

/**
 * Set when a save is for — today's date for "Tonight", which (unlike the
 * undated "tonight") drops back to Someday tomorrow if it isn't watched; or
 * whatever it was before, for Undo. Only the plan columns are written, on a
 * row that is still a save: going through /api/user-media-status would also
 * re-assert the status, which clears favourites as a side effect.
 */
export async function setPlan(
  me: string,
  item: { itemId: string; itemType: "movie" | "tv" },
  plan: { saveFor: SaveFor; saveForDate: string | null },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_media_status")
    .update({ save_for: plan.saveFor, save_for_date: plan.saveFor === "date" ? plan.saveForDate : null })
    .eq("user_id", me)
    .eq("item_id", item.itemId)
    .eq("item_type", item.itemType)
    .eq("status", "watchlist")
    .select("item_id");
  if (error) return "Couldn't line that up. Try again.";
  // Nothing matched: it was logged or removed somewhere else meanwhile.
  return data?.length ? null : "That's no longer saved. Refresh to see your list.";
}
