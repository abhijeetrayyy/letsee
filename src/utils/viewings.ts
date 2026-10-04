/**
 * A viewing: one time somebody watched something, dated, with who was there.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * Until 095 the diary was a set. `watched_items` holds one row per title and
 * `watch_count` was a column nothing wrote. A rewatch — the most common
 * emotional act in the whole product, comfort viewing — was an integer that
 * never moved. Every feature that makes a record worth keeping (on this day, a
 * calendar, a year that leads with people) needs the viewing to be a row.
 *
 * ── Who writes ────────────────────────────────────────────────────────────
 * Typed against supabase-js, like `takes.ts`, so the browser can read and
 * delete under its own RLS and the routes can write with the cookie client.
 * A viewing is never written on somebody else's behalf: the companion who was
 * named gets an invitation (a `co_log_invite`), and their own row exists only
 * once they accept it (`accept_co_log`, migration 096).
 *
 * ── Status is not decided here ────────────────────────────────────────────
 * Marking a title watched and logging a viewing of it are two facts with two
 * writers. `/api/user-media-status` owns the status and the legacy mirror;
 * `/api/viewings` calls both in order. Nothing in this file touches
 * `user_media_status`, so nothing here can leave the two disagreeing about
 * which of them is the source of truth.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ViewingPlace = "home" | "cinema" | "other";

export type CompanionInput =
  | { userId: string; name?: never }
  | { name: string; userId?: never };

export type Companion = {
  id: number;
  userId: string | null;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  /** Set once the named person has logged their own viewing of it too. */
  linkedViewingId: number | null;
};

export type Viewing = {
  id: number;
  watchedOn: string; // yyyy-mm-dd
  rewatch: boolean;
  place: ViewingPlace;
  providerId: number | null;
  createdAt: string;
  companions: Companion[];
};

export type ViewingInput = {
  itemId: string;
  itemType: "movie" | "tv";
  /** yyyy-mm-dd; defaults to today in the caller's clock. */
  watchedOn?: string | null;
  place?: ViewingPlace | null;
  providerId?: number | null;
  companions?: CompanionInput[];
};

const PLACES: ViewingPlace[] = ["home", "cinema", "other"];

export function isPlace(value: unknown): value is ViewingPlace {
  return typeof value === "string" && (PLACES as string[]).includes(value);
}

/** yyyy-mm-dd, or null. Refuses anything that does not round-trip. */
export function normaliseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) {
    return null;
  }
  // A viewing cannot be in the future. Tomorrow-in-UTC is still today somewhere.
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (date.getTime() > tomorrow.getTime()) return null;
  return `${y}-${mo}-${d}`;
}

/** Today, yyyy-mm-dd, in the caller's local clock. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Coerce a posted companion list into something the table accepts. */
export function parseCompanions(raw: unknown): CompanionInput[] {
  if (!Array.isArray(raw)) return [];
  const out: CompanionInput[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const userId = typeof (c as { userId?: unknown }).userId === "string" ? (c as { userId: string }).userId : null;
    const name = typeof (c as { name?: unknown }).name === "string" ? (c as { name: string }).name.trim() : "";
    if (userId) {
      if (seen.has(`u:${userId}`)) continue;
      seen.add(`u:${userId}`);
      out.push({ userId });
    } else if (name) {
      const key = `n:${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: name.slice(0, 60) });
    }
    if (out.length >= 12) break;
  }
  return out;
}

type CompanionRow = {
  id: number;
  companion_user_id: string | null;
  name: string | null;
  linked_viewing_id: number | null;
  users: { username: string | null; avatar_url: string | null } | { username: string | null; avatar_url: string | null }[] | null;
};

type ViewingRow = {
  id: number;
  watched_on: string;
  rewatch: boolean;
  place: string;
  provider_id: number | null;
  created_at: string;
  viewing_companions: CompanionRow[] | null;
};

function toViewing(r: ViewingRow): Viewing {
  return {
    id: r.id,
    watchedOn: r.watched_on,
    rewatch: r.rewatch,
    place: isPlace(r.place) ? r.place : "home",
    providerId: r.provider_id ?? null,
    createdAt: r.created_at,
    companions: (r.viewing_companions ?? []).map((c) => {
      // PostgREST hands back an object or a one-element array for a to-one
      // embed depending on how it inferred the relationship; take either.
      const u = Array.isArray(c.users) ? c.users[0] : c.users;
      return {
        id: c.id,
        userId: c.companion_user_id,
        name: c.name,
        username: u?.username ?? null,
        avatarUrl: u?.avatar_url ?? null,
        linkedViewingId: c.linked_viewing_id,
      };
    }),
  };
}

/**
 * The embed is disambiguated on purpose: `viewing_companions` points at
 * `viewings` twice (`viewing_id` and `linked_viewing_id`), and PostgREST
 * refuses to guess which edge to walk.
 */
const VIEWING_SELECT =
  "id, watched_on, rewatch, place, provider_id, created_at, viewing_companions!viewing_id(id, companion_user_id, name, linked_viewing_id, users(username, avatar_url))";

/** One person's viewings of one title, newest first. */
export async function fetchViewingsForTitle(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  itemType: "movie" | "tv",
): Promise<Viewing[]> {
  const { data, error } = await supabase
    .from("viewings")
    .select(VIEWING_SELECT)
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .order("watched_on", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    console.error("fetchViewingsForTitle:", error);
    return [];
  }
  return ((data ?? []) as unknown as ViewingRow[]).map(toViewing);
}

/**
 * Insert a viewing and its companions. Returns the row, or an error string.
 *
 * `rewatch` is decided here, once, from whether a viewing already exists —
 * not sent by the caller, so a client cannot mark a first watch as a rewatch
 * or the reverse by accident.
 */
export async function recordViewing(
  supabase: SupabaseClient,
  userId: string,
  input: ViewingInput,
): Promise<{ viewing: Viewing | null; error: string | null }> {
  const watchedOn = normaliseDate(input.watchedOn) ?? todayIso();
  const place: ViewingPlace = isPlace(input.place) ? input.place : "home";

  const { count, error: countError } = await supabase
    .from("viewings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("item_id", input.itemId)
    .eq("item_type", input.itemType);
  if (countError) {
    console.error("recordViewing count:", countError);
    return { viewing: null, error: "Couldn't log that." };
  }

  const { data: inserted, error } = await supabase
    .from("viewings")
    .insert({
      user_id: userId,
      item_id: input.itemId,
      item_type: input.itemType,
      watched_on: watchedOn,
      rewatch: (count ?? 0) > 0,
      place,
      provider_id: Number.isInteger(input.providerId) ? input.providerId : null,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("recordViewing insert:", error);
    return { viewing: null, error: "Couldn't log that." };
  }

  const companions = (input.companions ?? []).filter(
    (c) => !("userId" in c && c.userId === userId),
  );
  if (companions.length) {
    const rows = companions.map((c) =>
      "userId" in c && c.userId
        ? { viewing_id: inserted.id, companion_user_id: c.userId, name: null }
        : { viewing_id: inserted.id, companion_user_id: null, name: (c as { name: string }).name },
    );
    const { error: cError } = await supabase.from("viewing_companions").insert(rows);
    // The viewing stands even if a companion row is refused (a blocked user,
    // a duplicate name); it is reported, not fatal.
    if (cError) console.error("recordViewing companions:", cError);
  }

  const { data: row } = await supabase
    .from("viewings")
    .select(VIEWING_SELECT)
    .eq("id", inserted.id)
    .maybeSingle();

  return { viewing: row ? toViewing(row as unknown as ViewingRow) : null, error: null };
}

/**
 * Name and poster for a set of one person's titles.
 *
 * `user_media_status` first; `watched_items` for anything it does not have.
 * A status row can be removed with "keep my data" (the DELETE branch of the
 * status route), and the viewings then outlive it — a diary entry with no
 * name is a hole in the calendar, so the mirror table fills it.
 */
export async function titleMetaFor(
  supabase: SupabaseClient,
  userId: string,
  itemIds: string[],
): Promise<Map<string, { name: string; image: string | null }>> {
  const names = new Map<string, { name: string; image: string | null }>();
  if (!itemIds.length) return names;
  type MetaRow = { item_id: string; item_type: string; item_name: string | null; image_url: string | null };
  const { data: meta } = await supabase
    .from("user_media_status")
    .select("item_id, item_type, item_name, image_url")
    .eq("user_id", userId)
    .in("item_id", itemIds);
  for (const m of (meta ?? []) as MetaRow[]) {
    if (m.item_name) names.set(`${m.item_type}:${m.item_id}`, { name: m.item_name, image: m.image_url });
  }
  const missing = itemIds.filter((id) => !names.has(`movie:${id}`) && !names.has(`tv:${id}`));
  if (missing.length) {
    const { data: mirror } = await supabase
      .from("watched_items")
      .select("item_id, item_type, item_name, image_url")
      .eq("user_id", userId)
      .in("item_id", missing);
    for (const m of (mirror ?? []) as MetaRow[]) {
      const k = `${m.item_type}:${m.item_id}`;
      if (m.item_name && !names.has(k)) names.set(k, { name: m.item_name, image: m.image_url });
    }
  }
  return names;
}

/** Everyone from a Tonight room that decided on this title recently. */
export async function roomCompanions(
  supabase: SupabaseClient,
  itemId: string,
  itemType: "movie" | "tv",
): Promise<{ userId: string; username: string | null; avatarUrl: string | null }[]> {
  const { data, error } = await supabase.rpc("room_companions", {
    p_item_id: itemId,
    p_item_type: itemType,
  });
  if (error) return [];
  type Row = { user_id: string; username: string | null; avatar_url: string | null };
  return ((data ?? []) as Row[]).map((r) => ({
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url,
  }));
}

/** Remove one of the caller's own viewings. RLS refuses anyone else's. */
export async function deleteViewing(
  supabase: SupabaseClient,
  userId: string,
  viewingId: number,
): Promise<string | null> {
  const { error } = await supabase
    .from("viewings")
    .delete()
    .eq("id", viewingId)
    .eq("user_id", userId);
  if (error) {
    console.error("deleteViewing:", error);
    return "Couldn't remove that.";
  }
  return null;
}


export type WatchCompanion = {
  userId: string | null;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  viewings: number;
  lastWatchedOn: string | null;
};

/** The people somebody watches with most, from `watch_companions` (096). */
export async function fetchWatchCompanions(
  supabase: SupabaseClient,
  userId: string,
  limit = 6,
): Promise<WatchCompanion[]> {
  const { data, error } = await supabase.rpc("watch_companions", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) {
    console.error("watch_companions:", error);
    return [];
  }
  type Row = {
    companion_user_id: string | null;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    viewings: number;
    last_watched_on: string | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    userId: r.companion_user_id,
    name: r.name,
    username: r.username,
    avatarUrl: r.avatar_url,
    viewings: r.viewings,
    lastWatchedOn: r.last_watched_on,
  }));
}

/** Accept "I was there too". Returns the caller's own viewing id. */
export async function acceptCoLog(
  supabase: SupabaseClient,
  viewingId: number,
): Promise<{ viewingId: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc("accept_co_log", { p_viewing_id: viewingId });
  if (error) {
    console.error("accept_co_log:", error);
    return { viewingId: null, error: error.message || "Couldn't add that." };
  }
  return { viewingId: typeof data === "number" ? data : Number(data), error: null };
}

export type DiaryEntry = {
  id: number;
  itemId: string;
  itemType: "movie" | "tv";
  watchedOn: string;
  rewatch: boolean;
  place: ViewingPlace;
  /** When it was logged, as opposed to the day it was watched. */
  createdAt: string;
  companions: Companion[];
};

/**
 * A stretch of somebody's diary, newest first. Names and posters are joined
 * from `user_media_status` in a second query because the two tables share a
 * composite key and no foreign key, which PostgREST cannot embed across.
 */
export async function fetchDiary(
  supabase: SupabaseClient,
  userId: string,
  opts: { from?: string; to?: string; limit?: number; before?: { day: string; id: number } } = {},
): Promise<(DiaryEntry & { itemName: string; imageUrl: string | null })[]> {
  let q = supabase
    .from("viewings")
    .select(
      "id, item_id, item_type, watched_on, rewatch, place, provider_id, created_at, viewing_companions!viewing_id(id, companion_user_id, name, linked_viewing_id, users(username, avatar_url))",
    )
    .eq("user_id", userId)
    .order("watched_on", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts.limit ?? 400);
  if (opts.from) q = q.gte("watched_on", opts.from);
  if (opts.to) q = q.lte("watched_on", opts.to);
  // Keyset paging in the same order as the sort: never skips a viewing on a
  // day that straddles two pages, and never repeats one.
  if (opts.before) {
    q = q.or(`watched_on.lt.${opts.before.day},and(watched_on.eq.${opts.before.day},id.lt.${opts.before.id})`);
  }
  const { data, error } = await q;
  if (error) {
    console.error("fetchDiary:", error);
    return [];
  }
  type Row = ViewingRow & { item_id: string; item_type: "movie" | "tv" };
  const rows = (data ?? []) as unknown as Row[];
  if (!rows.length) return [];

  const names = await titleMetaFor(supabase, userId, [...new Set(rows.map((r) => r.item_id))]);

  return rows.map((r) => {
    const v = toViewing(r);
    const m = names.get(`${r.item_type}:${r.item_id}`);
    return {
      ...v,
      itemId: r.item_id,
      itemType: r.item_type,
      itemName: m?.name ?? "",
      imageUrl: m?.image ?? null,
    };
  });
}
