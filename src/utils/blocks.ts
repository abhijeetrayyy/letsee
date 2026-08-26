import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Typed against supabase-js itself so the browser can call this too — see the
 * same note in `takes.ts`. This function reads `user_blocks` and nothing else.
 */

/**
 * Every user id the viewer has blocked, or who has blocked the viewer.
 *
 * Blocking is enforced for writes at the RLS layer (migration 042) — this is
 * for read paths, so blocked people don't show up in feeds, comments, search,
 * or discovery. Returns an empty set for anonymous viewers.
 */
export async function getBlockedUserIds(
  supabase: SupabaseClient,
  viewerId: string | null,
): Promise<Set<string>> {
  const blocked = new Set<string>();
  if (!viewerId) return blocked;

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`);

  if (error) {
    console.error("getBlockedUserIds:", error);
    return blocked;
  }

  for (const row of data ?? []) {
    if (row.blocker_id === viewerId) blocked.add(row.blocked_id);
    if (row.blocked_id === viewerId) blocked.add(row.blocker_id);
  }
  return blocked;
}
