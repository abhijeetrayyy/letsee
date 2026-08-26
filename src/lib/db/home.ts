/**
 * The signed-in home page, read from the browser.
 *
 * `/app` is where every signed-in visit lands, and it was assembling itself out
 * of four Vercel functions — the currently-watching strip, the club pick, the
 * sidebar's counters and its settings row — none of which did anything but
 * forward a query. Three of the four are one `select` each.
 */

import { supabase } from "@/utils/supabase/client";
import { getUserStats, type UserStats } from "@/utils/userStats";

export type { UserStats };

export type WatchingItem = {
  item_id: string;
  item_name: string;
  item_type: string;
  image_url: string | null;
  started_at: string;
  item_adult: boolean;
  genres: string[];
};

/**
 * What the viewer (or a visible profile) is part-way through.
 *
 * `user_media_status_select_profile_visible` means a `userId` other than the
 * viewer's own returns rows only when that profile is visible to them, so the
 * public form of this needs no extra check here — the policy is the check.
 */
export async function fetchCurrentlyWatching(
  userId: string,
  animeOnly = false,
): Promise<WatchingItem[]> {
  const { data, error } = await supabase
    .from("user_media_status")
    .select("item_id, item_type, item_name, image_url, item_adult, genres, status, updated_at")
    .eq("user_id", userId)
    .eq("status", "watching")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((item) =>
      animeOnly
        ? (item.genres as string[] | null)?.some((g) => g.toLowerCase() === "animation")
        : true,
    )
    .map((r) => ({
      item_id: r.item_id,
      item_name: r.item_name,
      item_type: r.item_type,
      image_url: r.image_url,
      started_at: r.updated_at,
      item_adult: r.item_adult ?? false,
      genres: (r.genres as string[] | null) ?? [],
    }));
}

export type ClubPick = {
  id: string;
  item_id: string;
  item_type: string;
  title: string;
  image_url: string | null;
  note: string | null;
  starts_at: string;
  ends_at: string;
};

/**
 * The club pick that is running right now, or null.
 *
 * The window is closed in JS rather than in the query for the reason the route
 * had it that way: `ends_at` in the future is checked against the *reader's*
 * clock, so a pick that expired a minute ago disappears without waiting for a
 * cache to turn over.
 */
export async function fetchCurrentClubPick(): Promise<ClubPick | null> {
  const { data, error } = await supabase
    .from("club_picks")
    .select("id, item_id, item_type, title, image_url, note, starts_at, ends_at")
    .lte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return new Date(data.ends_at).getTime() > Date.now() ? (data as ClubPick) : null;
}

/** The same counters the profile header renders. One RPC — see `userStats.ts`. */
export function fetchUserStats(userId: string): Promise<UserStats> {
  return getUserStats(supabase, userId);
}
