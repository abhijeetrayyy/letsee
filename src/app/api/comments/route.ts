import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getBlockedUserIds } from "@/utils/blocks";

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

  const viewerId = await getAuthUserId();

  // Hide comments from people either side has blocked.
  const blockedIds = await getBlockedUserIds(supabase, viewerId);
  const comments = (data ?? []).filter((c) => !blockedIds.has(c.user_id));
  if (comments.length === 0) return jsonSuccess([]);

  const commentIds = comments.map((c) => c.id);

  const { data: reactionRows } = await supabase
    .from("reactions")
    .select("target_id, user_id")
    .eq("target_type", "comment")
    .in("target_id", commentIds);

  const countByComment = new Map<number, number>();
  const likedByViewer = new Set<number>();
  for (const r of reactionRows ?? []) {
    countByComment.set(r.target_id, (countByComment.get(r.target_id) ?? 0) + 1);
    if (viewerId && r.user_id === viewerId) likedByViewer.add(r.target_id);
  }

  const withReactions = comments.map((c) => ({
    ...c,
    reaction_count: countByComment.get(c.id) ?? 0,
    viewer_liked: likedByViewer.has(c.id),
  }));

  return jsonSuccess(withReactions);
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
  if (!["movie","tv","review","episode","club_pick"].includes(itemType)) return jsonError("Invalid itemType", 400);

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
  // Return the deleted rows so a no-op (someone else's comment) is reported as
  // a failure rather than a success — otherwise the client optimistically
  // removes a comment that is still in the database.
  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return jsonError(error.message, 500);
  if (!data?.length) return jsonError("You can only delete your own comments", 403);
  return jsonSuccess({ ok: true });
}
