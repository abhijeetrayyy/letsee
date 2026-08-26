/**
 * The signed-in viewer's own media state, read straight from Postgres.
 *
 * ── Why this is not an API route ──────────────────────────────────────────
 * `MediaInteractionProvider` hydrates on every app page load. It used to do
 * that with three `fetch`es to `/api/user-media-status`, `/api/userPrefrence`
 * and `/api/user-rating` — three Vercel function invocations per page view per
 * signed-in person, each of which did nothing but forward a query the browser
 * is perfectly able to make itself. The August 23 pause was 1.05M invocations
 * against a 1M limit; this path was a standing three-per-view contribution to
 * that number.
 *
 * Every one of these tables carries a `*_self` policy — `auth.uid() = user_id`
 * for ALL commands — so the browser's anon key plus the viewer's JWT reaches
 * exactly the same rows the route's cookie client did, and *only* those rows.
 * The route was never a security boundary; it was a paid-for proxy in front of
 * one the database already enforces.
 *
 * The three queries still run in parallel, so this is one round trip's worth of
 * wall time to Supabase instead of one to Vercel plus one from Vercel.
 */

import { supabase } from "@/utils/supabase/client";

export type MediaStatus =
  | "watchlist"
  | "watching"
  | "watched"
  | "on_hold"
  | "dropped";

export type MediaStateSnapshot = {
  /** `type:id` → status. */
  statuses: Record<string, MediaStatus>;
  /** `type:id` for every favourite. */
  favorites: Set<string>;
  /** `type:id` → score, 1-10. */
  ratings: Record<string, number>;
};

export const emptyMediaState: MediaStateSnapshot = {
  statuses: {},
  favorites: new Set(),
  ratings: {},
};

/**
 * The key every client-side media map is built on.
 *
 * TMDB numbers films and series independently, so `550` is Fight Club *and* an
 * unrelated series. Keying on the bare id lets one silently shadow the other.
 * Lives here rather than in the provider so the query layer and the consumers
 * cannot drift apart on it.
 */
export function mediaKey(itemId: string | number, itemType: string): string {
  return `${itemType === "tv" ? "tv" : "movie"}:${itemId}`;
}

export async function fetchMediaState(userId: string): Promise<MediaStateSnapshot> {
  const [statusRes, favoriteRes, ratingRes] = await Promise.all([
    supabase
      .from("user_media_status")
      .select("item_id, item_type, status")
      .eq("user_id", userId),
    supabase
      .from("favorite_items")
      .select("item_id, item_type")
      .eq("user_id", userId),
    /**
     * Ratings were not being hydrated at all before this.
     *
     * The provider called `/api/user-rating` with no query string, and that
     * handler answers 400 unless `itemId` and `itemType` are both present —
     * there has never been a "give me all of them" form of it. So `ratingRes.ok`
     * was false on every load, the map stayed empty, and every star on every
     * card rendered blank until the viewer rated something in that same
     * session. Reading the table directly is what makes the number on a card
     * match the number in the database.
     */
    supabase
      .from("user_ratings")
      .select("item_id, item_type, score")
      .eq("user_id", userId),
  ]);

  if (statusRes.error) throw statusRes.error;

  const statuses: Record<string, MediaStatus> = {};
  for (const row of statusRes.data ?? []) {
    statuses[mediaKey(row.item_id, row.item_type)] = row.status as MediaStatus;
  }

  const favorites = new Set<string>();
  for (const row of favoriteRes.data ?? []) {
    if (row.item_id) favorites.add(mediaKey(row.item_id, row.item_type));
  }

  const ratings: Record<string, number> = {};
  for (const row of ratingRes.data ?? []) {
    if (row.item_id && row.score) {
      ratings[mediaKey(row.item_id, row.item_type)] = Number(row.score);
    }
  }

  return { statuses, favorites, ratings };
}

/**
 * The same rows again, in the shape the older `UserPrefrenceProvider` speaks.
 *
 * Two providers hydrate on every app page load — `MediaInteractionProvider`
 * and the `UserPrefrenceProvider` nested inside it — and they describe the same
 * three tables in two different shapes: composite-keyed maps here, bare-id
 * bucket lists there. Merging them is a real refactor across thirteen consumer
 * components; making them read the same rows through one function is not, and
 * it removes the second page-load `fetch` immediately.
 *
 * The buckets are derived from `status`, which is one column with five values.
 * `on_hold` and `dropped` deliberately belong to no legacy bucket — the older
 * shape predates them and its consumers ask "is this in watching?", not "what
 * is its status?".
 */
export type LegacyPreferenceState = {
  watched: { item_id: string }[];
  favorite: { item_id: string }[];
  watchlater: { item_id: string }[];
  watching: { item_id: string }[];
  statuses: Record<string, MediaStatus>;
};

export function toLegacyPreferences(snapshot: MediaStateSnapshot): LegacyPreferenceState {
  const bucket = (wanted: MediaStatus) =>
    Object.entries(snapshot.statuses)
      .filter(([, status]) => status === wanted)
      .map(([key]) => ({ item_id: key.slice(key.indexOf(":") + 1) }));

  return {
    watched: bucket("watched"),
    favorite: [...snapshot.favorites].map((key) => ({
      item_id: key.slice(key.indexOf(":") + 1),
    })),
    watchlater: bucket("watchlist"),
    watching: bucket("watching"),
    statuses: snapshot.statuses,
  };
}
