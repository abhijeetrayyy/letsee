/**
 * SWR keys, in one place.
 *
 * These used to be template literals written out at each call site — a URL in
 * `TitleTalk`, the same URL rebuilt by hand in `TheRoom`, and a third copy
 * inside `TitleTalk`'s `refreshRoom` whose only job was to match the second
 * one. That last one is the tell: a component reconstructing another
 * component's key by hand is a cache invalidation that breaks silently the day
 * either string changes, and the symptom is a stale average sitting eight
 * hundred pixels below the rating that was supposed to update it.
 *
 * Array keys rather than URLs, because these no longer address an HTTP route —
 * they address a query. SWR compares them structurally.
 */

export type Scope = "title" | "season" | "episode";

export const takesKey = (
  itemId: string,
  itemType: string,
  scope: Scope,
  seasonNumber: number,
  episodeNumber: number,
  viewerId: string | null,
) => ["takes", itemId, itemType, scope, seasonNumber, episodeNumber, viewerId] as const;

export const commentsKey = (
  itemId: string,
  itemType: string,
  viewerId: string | null,
) => ["comments", itemId, itemType, viewerId] as const;

/**
 * The room on one title. `TheRoom` reads it; `TitleTalk` invalidates it after a
 * rating, because the two render on the same page eight hundred pixels apart
 * and used to disagree about the average until a reload.
 */
export const roomKey = (itemId: string | number, itemType: string) =>
  ["title-room", String(itemId), itemType === "tv" ? "tv" : "movie"] as const;
