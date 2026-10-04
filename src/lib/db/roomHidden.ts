/**
 * What you have hidden in your rooms (migration 104), read and written in the
 * browser under your own RLS — the table is readable and writable by its
 * owner only, so nobody learns what you hid.
 */
import { supabase } from "@/utils/supabase/client";
import { hiddenKey, type HiddenKind } from "@/lib/rooms/hidden";

export async function fetchHidden(me: string): Promise<Set<string>> {
  const { data } = await supabase.from("room_hidden_events").select("event_kind, event_id").eq("user_id", me).limit(2000);
  return new Set((data ?? []).map((r) => hiddenKey(r.event_kind as HiddenKind, r.event_id)));
}

export async function hideEvent(me: string, kind: HiddenKind, id: string): Promise<boolean> {
  const { error } = await supabase.from("room_hidden_events").upsert({ user_id: me, event_kind: kind, event_id: id }, { onConflict: "user_id,event_kind,event_id", ignoreDuplicates: true });
  return !error;
}

export async function unhideEvent(me: string, kind: HiddenKind, id: string): Promise<boolean> {
  const { error } = await supabase.from("room_hidden_events").delete().eq("user_id", me).eq("event_kind", kind).eq("event_id", id);
  return !error;
}

export async function unhideAll(me: string, keys: { kind: HiddenKind; id: string }[]): Promise<boolean> {
  for (const k of keys) if (!(await unhideEvent(me, k.kind, k.id))) return false;
  return true;
}
