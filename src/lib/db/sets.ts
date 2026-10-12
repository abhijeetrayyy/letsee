/**
 * Sets, read and kept in the browser under RLS (migration 125; the rules are
 * lib/people/sets). A set row is a reference; its titles are read when shown
 * — a list's items, or a person's work through `/api/person-work` (cached at
 * the edge for a day, shared with every title page) — and progress is one
 * read of someone's own marks for those titles.
 */
import { supabase } from "@/utils/supabase/client";
import { personSetItems, type SetItem, type SetRef, type SetRole, type SetRow } from "@/lib/people/sets";
import type { PersonWorkResponse } from "@/app/api/person-work/route";
import type { RoomPerson } from "@/lib/db/rooms";

const COLUMNS = "id, user_id, kind, ref_id, role, name, image_url, created_at";

type Row = { id: number; user_id: string; kind: string; ref_id: string; role: string | null; name: string; image_url: string | null; created_at: string };

function toSet(r: Row): SetRow {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind === "person" ? "person" : "list",
    refId: r.ref_id,
    role: (r.role as SetRole | null) ?? null,
    name: r.name,
    imageUrl: r.image_url,
    createdAt: r.created_at,
  };
}

/** Someone's sets, newest first. Theirs read under their profile's visibility. */
export async function fetchSets(userId: string): Promise<SetRow[]> {
  const { data, error } = await supabase.from("user_sets").select(COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) {
    console.error("fetchSets:", error);
    return [];
  }
  return ((data ?? []) as Row[]).map(toSet);
}

export async function keepSet(me: string, ref: SetRef, name: string, imageUrl: string | null): Promise<boolean> {
  const { error } = await supabase.from("user_sets").insert({ user_id: me, kind: ref.kind, ref_id: ref.refId, role: ref.role, name: name.slice(0, 200), image_url: imageUrl });
  // Already kept (another tab) is kept.
  if (error && error.code !== "23505") {
    console.error("keepSet:", error);
    return false;
  }
  return true;
}

export async function dropSet(me: string, ref: SetRef): Promise<boolean> {
  let q = supabase.from("user_sets").delete().eq("user_id", me).eq("kind", ref.kind).eq("ref_id", ref.refId);
  q = ref.role ? q.eq("role", ref.role) : q.is("role", null);
  const { error } = await q;
  if (error) console.error("dropSet:", error);
  return !error;
}

/** A set's titles: the list's items, or the person's work in that role (out already). */
export async function fetchSetItems(ref: SetRef): Promise<SetItem[]> {
  if (ref.kind === "list") {
    const { data } = await supabase.from("user_list_items").select("item_id, item_type").eq("list_id", Number(ref.refId)).limit(1000);
    return (data ?? []).map((r) => ({ id: String(r.item_id), type: r.item_type === "tv" ? "tv" : "movie" }));
  }
  const res = await fetch(`/api/person-work?id=${encodeURIComponent(ref.refId)}`).catch(() => null);
  if (!res?.ok) return [];
  const work = (await res.json()) as PersonWorkResponse;
  return personSetItems(ref.role ?? "actor", work);
}

/** How far someone is: finished titles of the set, and how many of those this year. */
export async function fetchSetProgress(userId: string, items: SetItem[]): Promise<{ done: number; thisYear: number }> {
  if (!items.length) return { done: 0, thisYear: 0 };
  const ids = [...new Set(items.map((i) => i.id))];
  const { data } = await supabase.from("user_media_status").select("item_id, item_type, updated_at").eq("user_id", userId).eq("status", "watched").in("item_id", ids.slice(0, 500));
  const want = new Set(items.map((i) => `${i.type}:${i.id}`));
  const year = String(new Date().getFullYear());
  let done = 0;
  let thisYear = 0;
  for (const r of data ?? []) {
    if (!want.has(`${r.item_type}:${r.item_id}`)) continue;
    done += 1;
    if (String(r.updated_at).slice(0, 4) === year) thisYear += 1;
  }
  return { done, thisYear };
}

/**
 * Your people on the same set, with how far each is — company, not a
 * ranking. People you follow only; at most five, in no order of score.
 */
export async function fetchSetCompany(me: string, ref: SetRef, items: SetItem[]): Promise<{ person: RoomPerson; done: number }[]> {
  let q = supabase.from("user_sets").select("user_id").eq("kind", ref.kind).eq("ref_id", ref.refId).neq("user_id", me).limit(200);
  q = ref.role ? q.eq("role", ref.role) : q.is("role", null);
  const [{ data: keepers }, { data: follows }] = await Promise.all([q, supabase.from("user_connections").select("followed_id").eq("follower_id", me)]);
  const mine = new Set((follows ?? []).map((f) => f.followed_id as string));
  const ids = [...new Set((keepers ?? []).map((k) => k.user_id as string))].filter((id) => mine.has(id)).slice(0, 5);
  if (!ids.length) return [];
  const { data: people } = await supabase.from("users").select("id, username, avatar_url").in("id", ids).is("deleted_at", null);
  const found = (people ?? []).filter((p) => p.username);
  const progress = await Promise.all(found.map((p) => fetchSetProgress(p.id as string, items)));
  return found.map((p, i) => ({ person: { id: p.id as string, username: p.username as string, avatarUrl: (p.avatar_url as string | null) ?? null }, done: progress[i].done }));
}
