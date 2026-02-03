import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

/** GET /api/user-lists — current user's lists. GET /api/user-lists?userId=xxx — lists for profile (respects visibility) */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: authUser, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser?.user) {
    return jsonError("User isn't logged in", 401);
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");

  if (!targetUserId) {
    // My lists only
    const { data: lists, error } = await supabase
      .from("user_lists")
      .select("id, name, description, visibility, created_at, updated_at")
      .eq("user_id", authUser.user.id)
      .order("updated_at", { ascending: false });

    if (error) return jsonError("Failed to fetch lists", 500);

    const withCounts = await Promise.all(
      (lists ?? []).map(async (list) => {
        const { count } = await supabase
          .from("user_list_items")
          .select("*", { count: "exact", head: true })
          .eq("list_id", list.id);
        return { ...list, items_count: count ?? 0 };
      })
    );
    return jsonSuccess({ lists: withCounts }, { maxAge: 0 });
  }

  // Another user's profile: only lists we're allowed to see (public, or followers if we follow)
  if (targetUserId === authUser.user.id) {
    const { data: lists, error } = await supabase
      .from("user_lists")
      .select("id, name, description, visibility, created_at, updated_at")
      .eq("user_id", targetUserId)
      .order("updated_at", { ascending: false });
    if (error) return jsonError("Failed to fetch lists", 500);
    const withCounts = await Promise.all(
      (lists ?? []).map(async (list) => {
        const { count } = await supabase
          .from("user_list_items")
          .select("*", { count: "exact", head: true })
          .eq("list_id", list.id);
        return { ...list, items_count: count ?? 0 };
      })
    );
    return jsonSuccess({ lists: withCounts }, { maxAge: 0 });
  }

  const { data: lists, error } = await supabase
    .from("user_lists")
    .select("id, name, description, visibility, created_at, updated_at")
    .eq("user_id", targetUserId)
    .in("visibility", ["public", "followers"])
    .order("updated_at", { ascending: false });

  if (error) return jsonError("Failed to fetch lists", 500);

  const { data: follows } = await supabase
    .from("user_connections")
    .select("followed_id")
    .eq("follower_id", authUser.user.id)
    .eq("followed_id", targetUserId)
    .maybeSingle();

  const canSeeFollowers = !!follows?.followed_id;
  const filtered =
    canSeeFollowers
      ? lists ?? []
      : (lists ?? []).filter((l) => l.visibility === "public");

  const withCounts = await Promise.all(
    filtered.map(async (list) => {
      const { count } = await supabase
        .from("user_list_items")
        .select("*", { count: "exact", head: true })
        .eq("list_id", list.id);
      return { ...list, items_count: count ?? 0 };
    })
  );
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
