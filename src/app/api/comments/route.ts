import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  const itemType = url.searchParams.get("itemType");
  if (!itemId || !itemType) return jsonError("itemId and itemType required", 400);

  const { data, error } = await supabase
    .from("comments")
    .select("id, user_id, body, created_at, parent_id, users!comments_user_id_fkey(username, avatar_url)")
    .eq("item_id", itemId).eq("item_type", itemType).order("created_at", { ascending: true });
  if (error) return jsonError(error.message, 500);
  return jsonSuccess(data ?? []);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);
  const supabase = await createClient();
  let body: any;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const { itemId, itemType, body: commentBody, parentId } = body;
  if (!itemId || !itemType || !commentBody?.trim()) return jsonError("itemId, itemType, and body required", 400);
  if (commentBody.length > 2000) return jsonError("Comment too long (max 2000 chars)", 400);
  if (!["movie","tv","review"].includes(itemType)) return jsonError("Invalid itemType", 400);

  const { data, error } = await supabase.from("comments").insert({
    user_id: userId, item_id: itemId, item_type: itemType, body: commentBody.trim(), parent_id: parentId || null,
  }).select("id, user_id, body, created_at, parent_id, users!comments_user_id_fkey(username, avatar_url)").single();
  if (error) return jsonError(error.message, 500);
  return jsonSuccess(data);
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);
  const supabase = await createClient();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("Comment id required", 400);
  const { error } = await supabase.from("comments").delete().eq("id", id).eq("user_id", userId);
  if (error) return jsonError(error.message, 500);
  return jsonSuccess({ ok: true });
}
