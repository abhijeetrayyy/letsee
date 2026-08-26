/**
 * The two paginated grids on a profile — Films/Series, and Favourites.
 *
 * Both were POST routes, which is worth noting on its own: a POST is
 * uncacheable by definition, so even the public half of a public profile paid
 * a full function invocation for every page of scroll. They read nothing but
 * `watched_items`, `favorite_items`, `user_ratings` and `user_media_status`,
 * all four of which carry a `*_select_profile_visible` policy — the row filter
 * this code was duplicating in TypeScript.
 *
 * ── Why the visibility check is still here ─────────────────────────────────
 * RLS returns *no rows* for a profile the viewer may not see, which is correct
 * and unhelpful: an empty grid and a forbidden grid look identical, and the
 * profile page needs to say which one it is. So the check is re-read here to
 * produce a message, not to enforce anything. The enforcement is the policy,
 * and it does not care what this function concluded.
 */

import { supabase } from "@/utils/supabase/client";

export type Visibility = "public" | "followers" | "private";

/** Can `viewerId` see `ownerId`'s lists? Mirrors `profile_visible_to_viewer`. */
export async function canViewProfile(
  ownerId: string,
  viewerId: string | null,
): Promise<{ allowed: boolean; found: boolean }> {
  const { data, error } = await supabase
    .from("users")
    .select("visibility")
    .eq("id", ownerId)
    .maybeSingle();

  if (error || !data) return { allowed: false, found: false };

  const visibility = String(data.visibility ?? "public").toLowerCase().trim();
  if (visibility === "public" || (viewerId && viewerId === ownerId)) {
    return { allowed: true, found: true };
  }

  if (viewerId && visibility === "followers") {
    const { data: connection } = await supabase
      .from("user_connections")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", ownerId)
      .maybeSingle();
    return { allowed: !!connection, found: true };
  }

  return { allowed: false, found: true };
}

export type FavoritePage = {
  data: Record<string, unknown>[];
  page: number;
  totalPages: number;
  totalItems: number;
  perloadLength: number;
};

export async function fetchFavoritesPage(
  ownerId: string,
  viewerId: string | null,
  page = 1,
  limit = 12,
): Promise<FavoritePage> {
  const { allowed, found } = await canViewProfile(ownerId, viewerId);
  if (!found) throw new Error("User not found");
  if (!allowed) throw new Error("Forbidden");

  const offset = (page - 1) * limit;

  const [{ count }, { data, error }] = await Promise.all([
    supabase
      .from("favorite_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ownerId),
    /**
     * ORDER BY is not optional here. LIMIT/OFFSET over an unordered query
     * returns rows in whatever order the plan happens to produce, and each page
     * is a separate query — so pages overlap. `id` breaks ties so the sort is
     * total.
     */
    supabase
      .from("favorite_items")
      .select("*")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1),
  ]);

  if (error) throw error;

  const rows = data ?? [];
  return {
    data: rows,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
    totalItems: count ?? 0,
    perloadLength: rows.length,
  };
}

const WATCHED_PER_PAGE = 50;

export type WatchedRow = Record<string, unknown> & {
  item_id: string;
  item_type: string;
  score: number | null;
  tv_status?: string | null;
  review_text: string | null;
  public_review_text?: string | null;
};

export type WatchedPage = {
  data: WatchedRow[];
  totalItems: number;
  totalPages: number;
};

export async function fetchWatchedPage(
  ownerId: string,
  viewerId: string | null,
  page = 1,
  genre?: string | null,
  itemType?: string | null,
): Promise<WatchedPage> {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("visibility, profile_show_ratings, profile_show_public_reviews")
    .eq("id", ownerId)
    .maybeSingle();

  if (profileError || !profile) throw new Error("User not found");

  const { allowed } = await canViewProfile(ownerId, viewerId);
  if (!allowed) throw new Error("Forbidden");

  const isOwner = viewerId === ownerId;
  const profileShowRatings = profile.profile_show_ratings ?? true;
  const profileShowPublicReviews = profile.profile_show_public_reviews ?? true;

  let query = supabase
    .from("watched_items")
    .select(
      // No `review_text`: 076 revoked SELECT on the private diary column. The
      // owner's copy is merged back in below, from a SECURITY DEFINER accessor
      // scoped to auth.uid() — which is exactly as scoped in a browser as it
      // was on a function, because it reads the JWT rather than an argument.
      "item_id, item_type, item_name, image_url, item_adult, genres, watched_at, public_review_text",
      { count: "exact" },
    )
    .eq("user_id", ownerId)
    .eq("is_watched", true)
    // Same reasoning as the favourites page: `watched_at` alone is not a total
    // order, so add a unique tiebreaker before paging over it.
    .order("watched_at", { ascending: false })
    .order("id", { ascending: false });

  if (genre && typeof genre === "string") query = query.overlaps("genres", [genre.trim()]);
  if (itemType === "tv" || itemType === "movie") query = query.eq("item_type", itemType);

  const { data: items, error, count } = await query.range(
    (page - 1) * WATCHED_PER_PAGE,
    page * WATCHED_PER_PAGE - 1,
  );

  if (error) throw error;

  const rows = (items ?? []) as unknown as WatchedRow[];
  const totalItems = count ?? 0;

  const pageItemIds = Array.from(new Set(rows.map((i) => i.item_id)));
  const tvItemIds = rows.filter((i) => i.item_type === "tv").map((i) => i.item_id);

  const [ratings, tvRows, notes] = await Promise.all([
    // Scoped to the ids on this page rather than the owner's whole history.
    pageItemIds.length
      ? supabase
          .from("user_ratings")
          .select("item_id, item_type, score")
          .eq("user_id", ownerId)
          .in("item_id", pageItemIds)
      : Promise.resolve({ data: [] as { item_id: string; item_type: string; score: number }[] }),
    tvItemIds.length
      ? supabase
          .from("user_media_status")
          .select("item_id, status")
          .eq("user_id", ownerId)
          .eq("item_type", "tv")
          .in("item_id", tvItemIds)
      : Promise.resolve({ data: [] as { item_id: string; status: string }[] }),
    // A visitor never asks for these — `my_diary_notes()` is scoped to
    // auth.uid() and takes no user parameter, so there is nothing to ask with.
    isOwner && pageItemIds.length
      ? supabase.rpc("my_diary_notes", { p_item_ids: pageItemIds, p_limit: null })
      : Promise.resolve({ data: [] as { item_id: string; item_type: string; review_text: string | null }[] }),
  ]);

  const itemSet = new Set(rows.map((i) => `${i.item_id}:${i.item_type}`));
  const ratingsMap: Record<string, number> = {};
  for (const r of (ratings.data ?? []) as { item_id: string; item_type: string; score: number }[]) {
    if (itemSet.has(`${r.item_id}:${r.item_type}`)) {
      ratingsMap[`${r.item_id}:${r.item_type}`] = r.score;
    }
  }

  const tvStatusMap: Record<string, string> = {};
  for (const r of (tvRows.data ?? []) as { item_id: string; status: string }[]) {
    tvStatusMap[r.item_id] = r.status;
  }

  const diaryMap: Record<string, string | null> = {};
  for (const n of (notes.data ?? []) as {
    item_id: string;
    item_type: string;
    review_text: string | null;
  }[]) {
    diaryMap[`${n.item_id}:${n.item_type}`] = n.review_text;
  }

  const data = rows.map((row) => {
    const key = `${row.item_id}:${row.item_type}`;
    const out: WatchedRow = {
      ...row,
      score: ratingsMap[key] ?? null,
      tv_status: row.item_type === "tv" ? (tvStatusMap[row.item_id] ?? null) : null,
      // `review_text` is the private diary note; `public_review_text` is the
      // one meant for sharing. The diary is absent from the row entirely rather
      // than fetched and blanked — see the select above and migration 076.
      review_text: isOwner ? (diaryMap[key] ?? null) : null,
    };
    if (!isOwner) {
      if (!profileShowPublicReviews) out.public_review_text = null;
      if (!profileShowRatings) out.score = null;
    }
    return out;
  });

  return { data, totalItems, totalPages: Math.ceil(totalItems / WATCHED_PER_PAGE) };
}
