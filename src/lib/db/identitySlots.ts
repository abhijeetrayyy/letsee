/**
 * The identity slots beside Taste in Four (100): four people, a comfort
 * watch, a hill to die on. Read and written from the browser under RLS —
 * `user_identity_slots_self` for the owner, the profile-visibility predicate
 * for everyone else.
 */

import { supabase } from "@/utils/supabase/client";

export type SlotKind = "person" | "comfort" | "hill";

export type IdentitySlot = {
  slot: SlotKind;
  position: number;
  itemId: string;
  itemType: "movie" | "tv" | "person";
  itemName: string;
  imageUrl: string | null;
  line: string | null;
};

export type IdentitySlots = {
  people: IdentitySlot[];
  comfort: IdentitySlot | null;
  hill: IdentitySlot | null;
};

type Row = {
  slot: string;
  position: number;
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  line: string | null;
};

export async function fetchIdentitySlots(userId: string): Promise<IdentitySlots> {
  const { data, error } = await supabase
    .from("user_identity_slots")
    .select("slot, position, item_id, item_type, item_name, image_url, line")
    .eq("user_id", userId)
    .order("position");
  if (error) {
    console.error("fetchIdentitySlots:", error);
    return { people: [], comfort: null, hill: null };
  }
  const rows = ((data ?? []) as Row[]).map<IdentitySlot>((r) => ({
    slot: r.slot as SlotKind,
    position: r.position,
    itemId: r.item_id,
    itemType: r.item_type as IdentitySlot["itemType"],
    itemName: r.item_name,
    imageUrl: r.image_url,
    line: r.line,
  }));
  return {
    people: rows.filter((r) => r.slot === "person"),
    comfort: rows.find((r) => r.slot === "comfort") ?? null,
    hill: rows.find((r) => r.slot === "hill") ?? null,
  };
}

/** Replace one kind of slot wholesale. Delete-then-insert keeps positions 1..n. */
export async function saveIdentitySlots(
  userId: string,
  slot: SlotKind,
  items: { itemId: string; itemType: IdentitySlot["itemType"]; itemName: string; imageUrl: string | null; line?: string | null }[],
): Promise<string | null> {
  const { error: delError } = await supabase.from("user_identity_slots").delete().eq("user_id", userId).eq("slot", slot);
  if (delError) return delError.message;
  if (!items.length) return null;
  const rows = items.slice(0, slot === "person" ? 4 : 1).map((it, i) => ({
    user_id: userId,
    slot,
    position: i + 1,
    item_id: it.itemId,
    item_type: it.itemType,
    item_name: it.itemName,
    image_url: it.imageUrl,
    line: it.line?.trim().slice(0, 140) || null,
  }));
  const { error } = await supabase.from("user_identity_slots").insert(rows);
  return error ? error.message : null;
}
