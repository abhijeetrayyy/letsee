/**
 * The reply thread under a title, read and written from the browser.
 *
 * `comments` has `comments_select_public` (USING true) and a `_self` policy for
 * every write, so the route's cookie client was buying nothing the anon key
 * plus a JWT does not already have. What the route *did* add — blocked users
 * filtered out, and reaction counts folded in — is kept, because both are
 * product behaviour rather than plumbing.
 */

import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";

export const MAX_COMMENT_LENGTH = 2000;

export const COMMENTABLE_TYPES = [
  "movie",
  "tv",
  "review",
  "episode",
  "season",
  "club",
  "club_pick",
] as const;

export type CommentRow = {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
  parent_id: number | null;
  users: { username: string | null; avatar_url: string | null } | null;
  reaction_count: number;
  viewer_liked: boolean;
};

export async function fetchComments(
  itemId: string,
  itemType: string,
  viewerId: string | null,
): Promise<CommentRow[]> {
  const [{ data, error }, blocked] = await Promise.all([
    supabase
      .from("comments")
      .select(
        "id, user_id, body, created_at, parent_id, users!comments_user_id_fkey(username, avatar_url)",
      )
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .order("created_at", { ascending: true }),
    getBlockedUserIds(supabase, viewerId),
  ]);

  if (error) throw error;

  // Blocking is enforced for writes by RLS (042); a read path has to do it
  // itself or a blocked account keeps talking in your thread.
  const comments = (data ?? []).filter((c) => !blocked.has(c.user_id));
  if (comments.length === 0) return [];

  const { data: reactionRows } = await supabase
    .from("reactions")
    .select("target_id, user_id")
    .eq("target_type", "comment")
    .in(
      "target_id",
      comments.map((c) => c.id),
    );

  const countByComment = new Map<number, number>();
  const likedByViewer = new Set<number>();
  for (const r of reactionRows ?? []) {
    countByComment.set(r.target_id, (countByComment.get(r.target_id) ?? 0) + 1);
    if (viewerId && r.user_id === viewerId) likedByViewer.add(r.target_id);
  }

  return comments.map((c) => ({
    ...(c as unknown as Omit<CommentRow, "reaction_count" | "viewer_liked">),
    reaction_count: countByComment.get(c.id) ?? 0,
    viewer_liked: likedByViewer.has(c.id),
  }));
}

/**
 * Post a reply. Returns an error message, or null.
 *
 * The length and item-type checks are the route's, kept because a message a
 * person can read beats a constraint violation — `trg_limit_comment_rate` and
 * the RLS policies remain the enforcement, and they run in Postgres where a
 * client cannot skip them.
 */
export async function postComment(
  userId: string,
  itemId: string,
  itemType: string,
  body: string,
  parentId?: number | null,
): Promise<string | null> {
  const text = body.trim();
  if (!text) return "Write something first.";
  if (text.length > MAX_COMMENT_LENGTH) {
    return `That is longer than ${MAX_COMMENT_LENGTH} characters.`;
  }
  if (!(COMMENTABLE_TYPES as readonly string[]).includes(itemType)) {
    return "That cannot be commented on.";
  }

  const { error } = await supabase.from("comments").insert({
    user_id: userId,
    item_id: itemId,
    item_type: itemType,
    body: text,
    parent_id: parentId ?? null,
  });

  if (error) {
    // The rate-limit trigger raises a message written for a person to read.
    return error.message || "Couldn't post that.";
  }
  return null;
}

/**
 * Delete one of the viewer's own comments.
 *
 * `.select("id")` after the delete is what tells a no-op from a success:
 * without it, deleting somebody else's comment returns no error, the client
 * removes it optimistically, and it is still in the database on reload.
 */
export async function deleteComment(userId: string, id: number): Promise<string | null> {
  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return error.message;
  if (!data?.length) return "You can only delete your own comments.";
  return null;
}
