/**
 * Viewings, read from the browser under the viewer's own RLS.
 *
 * Reads and deletes go straight to Postgres, in the pattern `takes.ts` set:
 * the `viewings_self` policy already scopes them, and a route in front would
 * only forward the query. Logging goes through `/api/viewings`, because a log
 * also has to settle the title's status and the legacy mirror, and that is
 * one transaction's worth of ordering the route owns.
 */

import { supabase } from "@/utils/supabase/client";
import {
  acceptCoLog as acceptCoLogWith,
  deleteViewing as deleteViewingWith,
  fetchDiary as fetchDiaryWith,
  fetchViewingsForTitle as fetchViewingsForTitleWith,
  fetchWatchCompanions as fetchWatchCompanionsWith,
  roomCompanions as roomCompanionsWith,
  type CompanionInput,
  type Viewing,
  type ViewingPlace,
} from "@/utils/viewings";

import { mergeLately, type LatelyEntry, type LatelyLog } from "@/lib/people/lately";

export type { Viewing, ViewingPlace, CompanionInput };

export function fetchMyViewings(userId: string, itemId: string, itemType: "movie" | "tv") {
  return fetchViewingsForTitleWith(supabase, userId, itemId, itemType);
}

export function fetchDiary(userId: string, opts?: { from?: string; to?: string; limit?: number; before?: { day: string; id: number } }) {
  return fetchDiaryWith(supabase, userId, opts);
}

/**
 * A profile's *Lately*: the diary's latest logs and the titles most recently
 * marked watched from a poster (which make no diary entry), merged
 * (lib/people/lately). Two reads in parallel, under the profile's RLS.
 */
export async function fetchLately(userId: string, limit = 6): Promise<LatelyEntry[]> {
  const [diary, { data: marks }] = await Promise.all([
    fetchDiaryWith(supabase, userId, { limit: 12 }),
    supabase
      .from("user_media_status")
      .select("item_id, item_type, item_name, image_url, updated_at")
      .eq("user_id", userId)
      .eq("status", "watched")
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);
  const logs: LatelyLog[] = diary.map((v) => ({
    kind: "log",
    id: v.id,
    itemId: v.itemId,
    itemType: v.itemType,
    itemName: v.itemName,
    imageUrl: v.imageUrl,
    day: v.watchedOn,
    at: v.createdAt,
    rewatch: v.rewatch,
    who: v.companions.map((c) => c.username ?? c.name).filter((x): x is string => !!x),
  }));
  return mergeLately(
    logs,
    (marks ?? []).map((m) => ({
      itemId: String(m.item_id),
      itemType: m.item_type === "tv" ? "tv" : "movie",
      itemName: m.item_name ?? "",
      imageUrl: m.image_url ?? null,
      at: m.updated_at as string,
    })),
    limit,
  );
}

export function fetchWatchCompanions(userId: string, limit?: number) {
  return fetchWatchCompanionsWith(supabase, userId, limit);
}

export function fetchRoomCompanions(itemId: string, itemType: "movie" | "tv") {
  return roomCompanionsWith(supabase, itemId, itemType);
}

export function deleteMyViewing(userId: string, viewingId: number) {
  return deleteViewingWith(supabase, userId, viewingId);
}

export function acceptCoLog(viewingId: number) {
  return acceptCoLogWith(supabase, viewingId);
}

export type LogViewingInput = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl?: string | null;
  genres?: string[];
  adult?: boolean;
  watchedOn?: string;
  place?: ViewingPlace;
  providerId?: number | null;
  companions?: CompanionInput[];
};

/** Log a viewing. Marks the title watched if it was not already. */
export async function logViewing(input: LogViewingInput): Promise<{ viewing: Viewing | null; error: string | null }> {
  const res = await fetch("/api/viewings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => null)) as
    | { viewing?: Viewing; error?: string }
    | null;
  if (!res.ok) return { viewing: null, error: body?.error ?? "Couldn't log that." };
  return { viewing: body?.viewing ?? null, error: null };
}

/**
 * Change when or where a viewing happened. The log sheet saves each field as
 * it changes, so this is called once per edit; `viewings_self` scopes it to
 * the owner.
 */
export async function updateMyViewing(
  userId: string,
  viewingId: number,
  patch: { watchedOn?: string; place?: ViewingPlace },
): Promise<string | null> {
  const row: Record<string, string> = {};
  if (patch.watchedOn) row.watched_on = patch.watchedOn;
  if (patch.place) row.place = patch.place;
  if (!Object.keys(row).length) return null;
  const { error } = await supabase.from("viewings").update(row).eq("id", viewingId).eq("user_id", userId);
  if (error) {
    console.error("updateMyViewing:", error);
    return "Couldn't save that.";
  }
  return null;
}

/**
 * Make a viewing's companions exactly `next`. Adds the new ones and removes
 * the dropped ones, so a person already named is not invited twice: the
 * co-log invite (migration 096) fires on insert only.
 */
export async function setViewingCompanions(
  viewingId: number,
  next: CompanionInput[],
): Promise<string | null> {
  const { data: current, error: readError } = await supabase
    .from("viewing_companions")
    .select("id, companion_user_id, name")
    .eq("viewing_id", viewingId);
  if (readError) {
    console.error("setViewingCompanions read:", readError);
    return "Couldn't save who was there.";
  }
  const keyOf = (c: { userId?: string | null; name?: string | null }) =>
    c.userId ? `u:${c.userId}` : `n:${(c.name ?? "").trim().toLowerCase()}`;
  const have = new Map((current ?? []).map((r) => [keyOf({ userId: r.companion_user_id, name: r.name }), r.id as number]));
  const want = new Map(next.map((c) => [keyOf(c), c]));

  const remove = [...have.entries()].filter(([k]) => !want.has(k)).map(([, id]) => id);
  const add = [...want.entries()]
    .filter(([k]) => !have.has(k))
    .map(([, c]) => (c.userId ? { viewing_id: viewingId, companion_user_id: c.userId } : { viewing_id: viewingId, name: c.name }));

  if (remove.length) {
    const { error } = await supabase.from("viewing_companions").delete().in("id", remove);
    if (error) {
      console.error("setViewingCompanions delete:", error);
      return "Couldn't save who was there.";
    }
  }
  if (add.length) {
    const { error } = await supabase.from("viewing_companions").insert(add);
    if (error) {
      console.error("setViewingCompanions insert:", error);
      return "Couldn't save who was there.";
    }
  }
  return null;
}

