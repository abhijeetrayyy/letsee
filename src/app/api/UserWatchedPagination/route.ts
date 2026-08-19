import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { userID, page, genre, itemType } = await request.json();

  if (!userID) {
    return jsonError("User ID is required", 400);
  }

  const viewerId = await getAuthUserId();

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("visibility, profile_show_ratings, profile_show_public_reviews")
    .eq("id", userID)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonError("User not found", 404);
  }

  const visibility = String(profile.visibility ?? "public").toLowerCase().trim();
  let canView = visibility === "public" || (viewerId && viewerId === userID);

  if (!canView && viewerId && visibility === "followers") {
    const { data: connection } = await supabase
      .from("user_connections")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", userID)
      .maybeSingle();
    if (connection) {
      canView = true;
    }
  }

  if (!canView) {
    return jsonError("Forbidden", 403);
  }

  const safePage = Number(page) || 1;
  const isOwner = viewerId === userID;
  const profileShowRatings = profile.profile_show_ratings ?? true;
  const profileShowPublicReviews = profile.profile_show_public_reviews ?? true;

  // Initialize the query — only items currently in Watched list (is_watched = true)
  let query = supabase
    .from("watched_items")
    .select(
      // No `review_text`: 076 revoked SELECT on the private diary column,
      // because nulling it here only ever protected callers of this route —
      // 019's row policy let a visitor read it straight off PostgREST. The
      // owner's copy is merged back in below, from a SECURITY DEFINER accessor
      // scoped to auth.uid().
      "item_id, item_type, item_name, image_url, item_adult, genres, watched_at, public_review_text",
      { count: "exact" },
    )
    .eq("user_id", userID)
    .eq("is_watched", true)
    // Same reasoning: watched_at alone is not a total order, so add a unique
    // tiebreaker before paging over it.
    .order("watched_at", { ascending: false })
    .order("id", { ascending: false });

  if (genre && typeof genre === "string") {
    query = query.overlaps("genres", [genre.trim()]);
  }
  if (itemType === "tv" || itemType === "movie") {
    query = query.eq("item_type", itemType);
  }

  const itemsPerPage = 50;
  query = query.range(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage - 1
  );

  const { data: items, error, count } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Fetch ratings for this user, scoped to just the item_ids on this page
  // (not the user's entire ratings history) — then keep only exact item_id+item_type matches.
  let ratingsMap: Record<string, number> = {};
  if (items?.length) {
    const pageItemIds = Array.from(new Set((items as { item_id: string }[]).map((i) => i.item_id)));
    const { data: ratings } = await supabase
      .from("user_ratings")
      .select("item_id, item_type, score")
      .eq("user_id", userID)
      .in("item_id", pageItemIds);
    const itemSet = new Set((items as { item_id: string; item_type: string }[]).map((i) => `${i.item_id}:${i.item_type}`));
    for (const r of (ratings ?? []) as { item_id: string; item_type: string; score: number }[]) {
      if (itemSet.has(`${r.item_id}:${r.item_type}`)) {
        ratingsMap[`${r.item_id}:${r.item_type}`] = r.score;
      }
    }
  }

  // TV list status for TV items (profile owner or visible)
  let tvStatusMap: Record<string, string> = {};
  const tvItemIds = (items ?? []).filter((i: { item_type: string }) => i.item_type === "tv").map((i: { item_id: string }) => i.item_id);
  if (tvItemIds.length > 0) {
    const { data: tvRows } = await supabase
      .from("user_media_status")
      .select("item_id, status")
      .eq("user_id", userID)
      .eq("item_type", "tv")
      .in("item_id", tvItemIds);
    for (const r of (tvRows ?? []) as { item_id: string; status: string }[]) {
      tvStatusMap[r.item_id] = r.status;
    }
  }

  // The owner's own diary notes for the titles on this page. A visitor never
  // asks for these — my_diary_notes() is scoped to auth.uid() and takes no user
  // parameter, so there is nothing to ask with.
  let diaryMap: Record<string, string | null> = {};
  if (isOwner && items?.length) {
    const pageItemIds = Array.from(new Set((items as { item_id: string }[]).map((i) => i.item_id)));
    const { data: notes } = await supabase.rpc("my_diary_notes", {
      p_item_ids: pageItemIds,
      p_limit: null,
    });
    for (const n of (notes ?? []) as { item_id: string; item_type: string; review_text: string | null }[]) {
      diaryMap[`${n.item_id}:${n.item_type}`] = n.review_text;
    }
  }

  // Merge score and tv_status into each item and apply visibility for visitors
  type Row = { item_id: string; item_type: string; review_text?: string | null; public_review_text?: string | null; [k: string]: unknown };
  const data = (items ?? []).map((row: Row) => {
    const key = `${row.item_id}:${row.item_type}`;
    const score = ratingsMap[key] ?? null;
    const tv_status = row.item_type === "tv" ? (tvStatusMap[row.item_id] ?? null) : null;
    // review_text is the private diary note; public_review_text is the one
    // meant for sharing. The diary is now absent from the row entirely rather
    // than fetched and blanked, so a visitor gets null because there was never
    // anything to null — see the select above and migration 076.
    let out: Row & { score: number | null; tv_status?: string | null } = {
      ...row,
      score,
      tv_status,
      review_text: isOwner ? (diaryMap[key] ?? null) : null,
    };
    if (!isOwner) {
      if (!profileShowPublicReviews) out.public_review_text = null;
      if (!profileShowRatings) out.score = null;
    }
    return out;
  });

  return new Response(
    JSON.stringify({
      data,
      totalItems,
      totalPages,
    })
  );
}
