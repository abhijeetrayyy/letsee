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

export type { Viewing, ViewingPlace, CompanionInput };

export function fetchMyViewings(userId: string, itemId: string, itemType: "movie" | "tv") {
  return fetchViewingsForTitleWith(supabase, userId, itemId, itemType);
}

export function fetchDiary(userId: string, opts?: { from?: string; to?: string; limit?: number }) {
  return fetchDiaryWith(supabase, userId, opts);
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
