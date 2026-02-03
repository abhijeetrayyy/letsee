import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/user-lists/[id]/items — list items (access by list visibility) */
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

  const { data: list } = await supabase
    .from("user_lists")
    .select("user_id, visibility")
    .eq("id", listId)
    .single();
  if (!list) return jsonError("List not found", 404);
  if (list.user_id !== authUser.user.id) {
    if (list.visibility === "private") return jsonError("List is private", 403);
    if (list.visibility === "followers") {
      const { data: follow } = await supabase
        .from("user_connections")
        .select("followed_id")
        .eq("follower_id", authUser.user.id)
        .eq("followed_id", list.user_id)
        .maybeSingle();
      if (!follow?.followed_id) return jsonError("List is only visible to followers", 403);
    }
  }

  const { data: items, error } = await supabase
    .from("user_list_items")
    .select("id, item_id, item_type, item_name, image_url, item_adult, position, created_at")
    .eq("list_id", listId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return jsonError("Failed to fetch items", 500);
  return jsonSuccess({ items: items ?? [] }, { maxAge: 0 });
}

/** POST /api/user-lists/[id]/items — add item (owner only). Body: { itemId, itemType, name, imgUrl?, adult?, genres? } */
export async function POST(
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

  let body: { itemId: string; itemType: string; name: string; imgUrl?: string; adult?: boolean; genres?: string[] };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const { itemId, itemType, name } = body;
  if (!itemId || !itemType || !name) {
    return jsonError("itemId, itemType, and name are required", 400);
  }
  if (itemType !== "movie" && itemType !== "tv") {
    return jsonError("itemType must be movie or tv", 400);
  }

  const { count } = await supabase
    .from("user_list_items")
    .select("*", { count: "exact", head: true })
    .eq("list_id", listId);
  const position = (count ?? 0);

  const { data: item, error } = await supabase
    .from("user_list_items")
    .insert({
      list_id: listId,
      item_id: String(itemId),
      item_type: itemType,
      item_name: String(name),
      image_url: body.imgUrl ?? null,
      item_adult: body.adult ?? false,
      genres: body.genres ?? null,
      position,
    })
    .select("id, item_id, item_type, item_name, image_url, position, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return jsonError("Item already in list", 409);
    return jsonError(error.message || "Failed to add item", 500);
  }
  return jsonSuccess({ item }, { maxAge: 0 });
}

/** DELETE /api/user-lists/[id]/items?itemId=xxx — remove item (owner only) */
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
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) return jsonError("itemId query is required", 400);

  const { data: list } = await supabase
    .from("user_lists")
    .select("user_id")
    .eq("id", listId)
    .single();
  if (!list || list.user_id !== user.user.id) {
    return jsonError("List not found or access denied", 404);
  }

  const { error } = await supabase
    .from("user_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("item_id", itemId);

  if (error) return jsonError(error.message || "Failed to remove item", 500);
  return jsonSuccess({ removed: true }, { maxAge: 0 });
}
