import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";

type ListRow = { id: number; [k: string]: unknown };

/**
 * Attach item counts and like state to a set of lists in two queries rather
 * than one count query per list (and one LikeButton fetch per rendered card).
 */
async function enrichLists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lists: ListRow[],
  viewerId: string | null,
) {
  if (lists.length === 0) return [];
  const ids = lists.map((l) => l.id);

  const [{ data: itemRows }, { data: reactionRows }] = await Promise.all([
    supabase.from("user_list_items").select("list_id").in("list_id", ids),
    supabase
      .from("reactions")
      .select("target_id, user_id")
      .eq("target_type", "list")
      .in("target_id", ids),
  ]);

  const itemCount = new Map<number, number>();
  for (const r of itemRows ?? []) {
    itemCount.set(r.list_id, (itemCount.get(r.list_id) ?? 0) + 1);
  }

  const likeCount = new Map<number, number>();
  const likedByViewer = new Set<number>();
  for (const r of reactionRows ?? []) {
    likeCount.set(r.target_id, (likeCount.get(r.target_id) ?? 0) + 1);
    if (viewerId && r.user_id === viewerId) likedByViewer.add(r.target_id);
  }

  return lists.map((list) => ({
    ...list,
    items_count: itemCount.get(list.id) ?? 0,
    reaction_count: likeCount.get(list.id) ?? 0,
    viewer_liked: likedByViewer.has(list.id),
  }));
}

/** GET /api/user-lists — current user's lists. GET /api/user-lists?userId=xxx — lists for profile (respects visibility). Anon can view public lists only. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: authUser, error: authError } = await supabase.auth.getUser();
  const viewerId = authError || !authUser?.user ? null : authUser.user.id;

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  const scope = searchParams.get("scope");

  // Browse everyone's public lists. RLS on user_lists already restricts SELECT
  // to visibility='public' for anyone who isn't the owner, a follower or a
  // collaborator, so this needs no auth and cannot leak a private list.
  if (scope === "public") {
    const limit = Math.min(60, Math.max(1, Number(searchParams.get("limit")) || 30));
    const { data: lists, error } = await supabase
      .from("user_lists")
      .select("id, name, description, visibility, created_at, updated_at, user_id, users:user_id(username, avatar_url)")
      .eq("visibility", "public")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("user-lists public browse:", error);
      return jsonError("Failed to fetch lists", 500);
    }

    const withCounts = await enrichLists(supabase, lists ?? [], viewerId);
    return jsonSuccess({ lists: withCounts }, { maxAge: 0 });
  }

  if (!targetUserId) {
    // My lists only — require login
    if (!viewerId) {
      return jsonError("User isn't logged in", 401);
    }
    const { data: lists, error } = await supabase
      .from("user_lists")
      .select("id, name, description, visibility, created_at, updated_at")
      .eq("user_id", viewerId)
      .order("updated_at", { ascending: false });

    if (error) return jsonError("Failed to fetch lists", 500);

    const withCounts = await enrichLists(supabase, lists ?? [], viewerId);
    return jsonSuccess({ lists: withCounts }, { maxAge: 0 });
  }

  // Another user's profile: only lists we're allowed to see (public, or followers if we follow). Anon sees public only.
  if (viewerId && targetUserId === viewerId) {
    const { data: lists, error } = await supabase
      .from("user_lists")
      .select("id, name, description, visibility, created_at, updated_at")
      .eq("user_id", targetUserId)
      .order("updated_at", { ascending: false });
    if (error) return jsonError("Failed to fetch lists", 500);
    const withCounts = await enrichLists(supabase, lists ?? [], viewerId);
    return jsonSuccess({ lists: withCounts }, { maxAge: 0 });
  }

  // Check profile visibility: don't expose lists if profile is private (unless owner or allowed follower)
  const { data: profileRow } = await supabase
    .from("users")
    .select("visibility")
    .eq("id", targetUserId)
    .maybeSingle();
  const profileVisibility = profileRow?.visibility ?? "public";
  let canViewProfile = profileVisibility === "public" || viewerId === targetUserId;
  if (!canViewProfile && viewerId && profileVisibility === "followers") {
    const { data: conn } = await supabase
      .from("user_connections")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", targetUserId)
      .maybeSingle();
    canViewProfile = !!conn?.id;
  }
  if (!canViewProfile) {
    return jsonSuccess({ lists: [] }, { maxAge: 0 });
  }

  const { data: lists, error } = await supabase
    .from("user_lists")
    .select("id, name, description, visibility, created_at, updated_at")
    .eq("user_id", targetUserId)
    .in("visibility", ["public", "followers"])
    .order("updated_at", { ascending: false });

  if (error) return jsonError("Failed to fetch lists", 500);

  let canSeeFollowers = false;
  if (viewerId) {
    const { data: follows } = await supabase
      .from("user_connections")
      .select("followed_id")
      .eq("follower_id", viewerId)
      .eq("followed_id", targetUserId)
      .maybeSingle();
    canSeeFollowers = !!follows?.followed_id;
  }
  const filtered =
    canSeeFollowers
      ? lists ?? []
      : (lists ?? []).filter((l) => l.visibility === "public");

  const withCounts = await enrichLists(supabase, filtered, viewerId);
  return jsonSuccess({ lists: withCounts }, { maxAge: 0 });
}

/** POST /api/user-lists — create list. Body: { name: string, description?: string, visibility?: 'public'|'followers'|'private' } */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    return jsonError("User isn't logged in", 401);
  }

  let body: { name?: string; description?: string; visibility?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const name = (body.name ?? "").trim();
  if (!name) return jsonError("name is required", 400);
  const visibility = ["public", "followers", "private"].includes(body.visibility ?? "")
    ? body.visibility
    : "public";

  const { data: list, error } = await supabase
    .from("user_lists")
    .insert({
      user_id: user.user.id,
      name,
      description: (body.description ?? "").trim() || null,
      visibility,
    })
    .select("id, name, description, visibility, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message || "Failed to create list", 500);

  return jsonSuccess({ list: { ...list, items_count: 0 } }, { maxAge: 0 });
}
