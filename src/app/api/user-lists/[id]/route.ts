import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/user-lists/[id] — one list (with items count); access by visibility if not owner */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = await createClient();
  const { data: authUser, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser?.user) {
    return jsonError("User isn't logged in", 401);
  }
  const id = (await context.params).id;
  const listId = Number(id);
  if (!Number.isInteger(listId)) {
    return jsonError("Invalid list id", 400);
  }

  const { data: list, error } = await supabase
    .from("user_lists")
    .select("id, user_id, name, description, visibility, created_at, updated_at")
    .eq("id", listId)
    .single();

  if (error || !list) {
    return jsonError("List not found", 404);
  }

  if (list.user_id !== authUser.user.id) {
    if (list.visibility === "private") {
      return jsonError("List is private", 403);
    }
    if (list.visibility === "followers") {
      const { data: follow } = await supabase
        .from("user_connections")
        .select("followed_id")
        .eq("follower_id", authUser.user.id)
        .eq("followed_id", list.user_id)
        .maybeSingle();
      if (!follow?.followed_id) {
        return jsonError("List is only visible to followers", 403);
      }
    }
  }

  const { count } = await supabase
    .from("user_list_items")
    .select("*", { count: "exact", head: true })
    .eq("list_id", listId);

  const isOwner = list.user_id === authUser.user.id;
  return jsonSuccess(
    { list: { ...list, items_count: count ?? 0, is_owner: isOwner } },
    { maxAge: 0 }
  );
}

/** PATCH /api/user-lists/[id] — update list (owner only). Body: { name?, description?, visibility? } */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    return jsonError("User isn't logged in", 401);
  }
  const id = (await context.params).id;
  const listId = Number(id);
  if (!Number.isInteger(listId)) {
    return jsonError("Invalid list id", 400);
  }

  const { data: list } = await supabase
    .from("user_lists")
    .select("user_id")
    .eq("id", listId)
    .single();
  if (!list || list.user_id !== user.user.id) {
    return jsonError("List not found or access denied", 404);
  }

  let body: { name?: string; description?: string; visibility?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const updates: { name?: string; description?: string | null; visibility?: string } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return jsonError("name cannot be empty", 400);
    updates.name = name;
  }
  if (body.description !== undefined) updates.description = String(body.description).trim() || null;
  if (["public", "followers", "private"].includes(body.visibility ?? "")) updates.visibility = body.visibility;

  if (Object.keys(updates).length === 0) {
    const { data: current } = await supabase
      .from("user_lists")
      .select("id, name, description, visibility, created_at, updated_at")
      .eq("id", listId)
      .single();
    const { count } = await supabase
      .from("user_list_items")
      .select("*", { count: "exact", head: true })
      .eq("list_id", listId);
    return jsonSuccess({ list: current ? { ...current, items_count: count ?? 0 } : null }, { maxAge: 0 });
  }

  const { data: updated, error } = await supabase
    .from("user_lists")
    .update(updates)
    .eq("id", listId)
    .eq("user_id", user.user.id)
    .select("id, name, description, visibility, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message || "Failed to update list", 500);
  const { count } = await supabase
    .from("user_list_items")
    .select("*", { count: "exact", head: true })
    .eq("list_id", listId);
  return jsonSuccess({ list: { ...updated, items_count: count ?? 0 } }, { maxAge: 0 });
}

/** DELETE /api/user-lists/[id] — delete list (owner only) */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    return jsonError("User isn't logged in", 401);
  }
  const id = (await context.params).id;
  const listId = Number(id);
  if (!Number.isInteger(listId)) {
    return jsonError("Invalid list id", 400);
  }

  const { error } = await supabase
    .from("user_lists")
    .delete()
    .eq("id", listId)
    .eq("user_id", user.user.id);

  if (error) return jsonError(error.message || "Failed to delete list", 500);
  return jsonSuccess({ deleted: true }, { maxAge: 0 });
}
