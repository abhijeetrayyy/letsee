/**
 * Everything happening on letsee, as one feed (People → Activity).
 *
 * Four small reads in the browser under RLS, each newest-first and cut off at
 * the same moment, merged here:
 *
 * - `user_activity` — watched, started watching, rated, reviewed (written by
 *   triggers as people mark and log; one row per title for "watched").
 * - `favorite_items` — loved.
 * - `user_lists` — a new public list.
 * - `users` — someone new arrived (only in "Everyone").
 *
 * RLS already hides private profiles from those who may not see them and
 * deleted accounts from everyone; blocked people are dropped here. "People you
 * follow" narrows every read to them. Paging is by time: the next page asks
 * for everything before the oldest thing shown, so nothing repeats.
 */
import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";
import { getPosterUrl } from "@/utils/imageUrl";

export type ActivityKind = "watched" | "watching" | "rated" | "reviewed" | "loved" | "list" | "joined";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  at: string;
  person: { id: string; username: string; avatarUrl: string | null };
  title?: { itemId: string; itemType: "movie" | "tv"; name: string; imageUrl: string | null };
  /** 1–10. */
  score?: number | null;
  words?: string | null;
  list?: { id: number; name: string };
};

export type ActivityScope = "everyone" | "people";

const PAGE = 40;

export async function fetchActivity({ me, scope, before }: { me: string | null; scope: ActivityScope; before?: string | null }): Promise<{ events: ActivityEvent[]; next: string | null }> {
  let only: string[] | null = null;
  if (scope === "people") {
    if (!me) return { events: [], next: null };
    const { data } = await supabase.from("user_connections").select("followed_id").eq("follower_id", me);
    only = (data ?? []).map((r) => r.followed_id as string);
    if (!only.length) return { events: [], next: null };
  }
  const scoped = <Q extends { in: (c: string, v: string[]) => Q; lt: (c: string, v: string) => Q }>(q: Q, col = "user_id") => {
    let out = q;
    if (only) out = out.in(col, only);
    if (before) out = out.lt("created_at", before);
    return out;
  };

  const [acts, loves, lists, joined, blocked] = await Promise.all([
    scoped(
      supabase
        .from("user_activity")
        .select("id, user_id, activity_type, item_id, item_type, item_name, image_url, score, review_text, created_at")
        .order("created_at", { ascending: false })
        .limit(PAGE),
    ),
    scoped(supabase.from("favorite_items").select("id, user_id, item_id, item_type, item_name, image_url, created_at").order("created_at", { ascending: false }).limit(PAGE)),
    scoped(supabase.from("user_lists").select("id, user_id, name, created_at").eq("visibility", "public").order("created_at", { ascending: false }).limit(12)),
    scope === "everyone"
      ? scoped(
          supabase.from("users").select("id, username, avatar_url, created_at").not("username", "is", null).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
          "id",
        )
      : Promise.resolve({ data: [] as { id: string; username: string; avatar_url: string | null; created_at: string }[] }),
    getBlockedUserIds(supabase, me),
  ]);

  const ids = new Set<string>();
  for (const r of [...(acts.data ?? []), ...(loves.data ?? []), ...(lists.data ?? [])]) ids.add(r.user_id as string);
  const { data: people } = ids.size
    ? await supabase.from("users").select("id, username, avatar_url").in("id", [...ids]).is("deleted_at", null)
    : { data: [] as { id: string; username: string | null; avatar_url: string | null }[] };
  const who = new Map<string, ActivityEvent["person"]>();
  for (const u of people ?? []) if (u.username && !blocked.has(u.id)) who.set(u.id, { id: u.id, username: u.username, avatarUrl: u.avatar_url ?? null });
  for (const u of joined.data ?? []) if (u.username && !blocked.has(u.id)) who.set(u.id, { id: u.id, username: u.username, avatarUrl: u.avatar_url ?? null });

  const title = (r: { item_id: unknown; item_type: unknown; item_name: unknown; image_url: unknown }) => ({
    itemId: String(r.item_id),
    itemType: (r.item_type === "tv" ? "tv" : "movie") as "movie" | "tv",
    name: String(r.item_name ?? ""),
    imageUrl: r.image_url ? getPosterUrl(String(r.image_url), "w185") : null,
  });

  const events: ActivityEvent[] = [];
  for (const r of acts.data ?? []) {
    const person = who.get(r.user_id as string);
    if (!person) continue;
    const kind: ActivityKind | null =
      r.activity_type === "watched" ? "watched" : r.activity_type === "started_watching" ? "watching" : r.activity_type === "rated" ? "rated" : r.activity_type === "reviewed" ? "reviewed" : null;
    if (!kind) continue;
    events.push({ id: `a${r.id}`, kind, at: r.created_at as string, person, title: title(r), score: (r.score as number | null) ?? null, words: (r.review_text as string | null) ?? null });
  }
  for (const r of loves.data ?? []) {
    const person = who.get(r.user_id as string);
    if (person) events.push({ id: `f${r.id}`, kind: "loved", at: r.created_at as string, person, title: title(r) });
  }
  for (const r of lists.data ?? []) {
    const person = who.get(r.user_id as string);
    if (person) events.push({ id: `l${r.id}`, kind: "list", at: r.created_at as string, person, list: { id: Number(r.id), name: String(r.name ?? "A list") } });
  }
  for (const u of joined.data ?? []) {
    const person = who.get(u.id);
    if (person && u.id !== me) events.push({ id: `j${u.id}`, kind: "joined", at: u.created_at as string, person });
  }

  events.sort((a, b) => b.at.localeCompare(a.at));
  // The page ends where the thinnest full source ended, so the next page
  // starts there and nothing between is skipped.
  const fullEnds = [acts.data, loves.data].filter((d) => (d?.length ?? 0) >= PAGE).map((d) => d![d!.length - 1].created_at as string);
  const cut = fullEnds.length ? fullEnds.sort().at(-1)! : null;
  const page = cut ? events.filter((e) => e.at >= cut) : events;
  return { events: page, next: cut };
}

/** Runs of the same thing by the same person within a few hours, so fifty marks read as one line. */
export type ActivityRun = { key: string; person: ActivityEvent["person"]; kind: ActivityKind; at: string; events: ActivityEvent[] };

export function intoRuns(events: ActivityEvent[], windowMs = 6 * 3600_000): ActivityRun[] {
  const runs: ActivityRun[] = [];
  for (const e of events) {
    const last = runs.at(-1);
    const groupable = e.kind === "watched" || e.kind === "loved" || e.kind === "watching";
    if (last && groupable && last.kind === e.kind && last.person.id === e.person.id && Date.parse(last.events.at(-1)!.at) - Date.parse(e.at) <= windowMs) {
      last.events.push(e);
      continue;
    }
    runs.push({ key: e.id, person: e.person, kind: e.kind, at: e.at, events: [e] });
  }
  return runs;
}
