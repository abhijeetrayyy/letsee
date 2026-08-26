/**
 * Takes and their thread, read and written from the browser.
 *
 * `/api/takes` and `/api/comments` were two of the three requests every title
 * page made, and both of them were pure PostgREST forwarding: a cookie client,
 * a `select`, a `jsonSuccess`. The movie, series, season and episode pages are
 * the most-visited routes on the site — `/app/person/[id]` alone ran 22K
 * invocations in twelve hours during the August incident — so this is the
 * second-largest per-view cost after the providers.
 *
 * The write half deliberately reuses `@/utils/takes`, which is the same module
 * the routes call. That file holds the rules that are genuinely hard —
 * visibility changes must *move* a take rather than duplicate it, the legacy
 * mirror to `user_ratings` and `watched_items`, the diary note going through
 * `set_my_diary_notes` because 076 revoked SELECT on `review_text`. None of
 * that is re-implemented here; it is called.
 */

import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";
import {
  deleteTake as deleteTakeWith,
  getMyTake,
  saveTake as saveTakeWith,
  type SaveTakeInput,
  type Take,
  type TakeIdentity,
} from "@/utils/takes";

export type { TakeIdentity, Take };

export type OtherTake = {
  username: string;
  avatarUrl: string | null;
  score: number | null;
  body: string;
  updatedAt: string;
};

export type TakesForTitle = {
  mine: Take | null;
  privateNote: Take | null;
  others: OtherTake[];
};

/**
 * The viewer's own take plus everyone else's public ones.
 *
 * The `is_public` filter is explicit rather than left to RLS, for the reason
 * the route documented: 065's read policy admits a whole row once it is public
 * and the author's profile is visible, so a query that does not say
 * `is_public` can return a private note belonging to someone whose profile you
 * can see. The filter is the thing keeping a diary entry private, and it has
 * to be in every query that reads this table on behalf of a stranger.
 */
export async function fetchTakesForTitle(
  id: TakeIdentity,
  viewerId: string | null,
): Promise<TakesForTitle> {
  const [mine, publicRes, blocked] = await Promise.all([
    viewerId
      ? getMyTake(supabase, viewerId, id)
      : Promise.resolve({ take: null, privateNote: null }),
    supabase
      .from("takes")
      .select("user_id, score, body, updated_at, users!inner(username, avatar_url)")
      .eq("item_id", id.itemId)
      .eq("item_type", id.itemType)
      .eq("scope", id.scope)
      .eq("season_number", id.seasonNumber)
      .eq("episode_number", id.episodeNumber)
      .eq("is_public", true)
      .not("body", "is", null)
      .order("updated_at", { ascending: false })
      .limit(20),
    getBlockedUserIds(supabase, viewerId),
  ]);

  const others: OtherTake[] = (publicRes.data ?? [])
    .filter((r) => r.user_id !== viewerId && !blocked.has(r.user_id))
    .map((r) => {
      const author = r.users as unknown as {
        username?: string;
        avatar_url?: string | null;
      };
      return {
        username: author?.username ?? "someone",
        avatarUrl: author?.avatar_url ?? null,
        score: r.score ?? null,
        body: r.body as string,
        updatedAt: r.updated_at as string,
      };
    });

  return { mine: mine.take, privateNote: mine.privateNote, others };
}

/** Save the viewer's take. Returns an error message, or null on success. */
export function saveMyTake(
  userId: string,
  id: TakeIdentity,
  input: SaveTakeInput,
): Promise<string | null> {
  return saveTakeWith(supabase, userId, id, input);
}

/** Remove the viewer's take at one visibility. */
export function deleteMyTake(
  userId: string,
  id: TakeIdentity,
  isPublic: boolean,
): Promise<string | null> {
  return deleteTakeWith(supabase, userId, id, isPublic);
}
