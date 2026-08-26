/**
 * Likes, toggled from the browser.
 *
 * `LikeButton` renders beside every comment, every review row and every feed
 * item, and each tap was a function invocation for a delete-or-insert plus a
 * count. `reactions` has `reactions_select_all` (USING true) and
 * `_self` policies for insert and delete, so all three statements are things
 * the viewer's own token is allowed to run.
 *
 * `notify_reaction_trigger` fires on the insert either way — the notification a
 * like produces is the database's job and always was.
 */

import { supabase } from "@/utils/supabase/client";

export const REACTABLE_TYPES = [
  "review",
  "watched",
  "rating",
  "list",
  "comment",
  "activity",
] as const;

export type ReactionTarget = (typeof REACTABLE_TYPES)[number];

export type ToggleResult = { liked: boolean; count: number };

async function countFor(targetType: string, targetId: number): Promise<number> {
  const { count } = await supabase
    .from("reactions")
    .select("id", { count: "exact", head: true })
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  return count ?? 0;
}

export async function toggleReaction(
  userId: string,
  targetType: string,
  rawTargetId: number | string,
): Promise<ToggleResult> {
  if (!(REACTABLE_TYPES as readonly string[]).includes(targetType)) {
    throw new Error("Invalid target");
  }
  const targetId = Number(rawTargetId);
  if (!Number.isFinite(targetId)) throw new Error("Invalid target");

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
    if (error) throw error;
    return { liked: false, count: await countFor(targetType, targetId) };
  }

  const { error } = await supabase
    .from("reactions")
    .insert({ user_id: userId, target_type: targetType, target_id: targetId });
  if (error) throw error;
  return { liked: true, count: await countFor(targetType, targetId) };
}

/** Whether the viewer has liked a target, and how many people have. */
export async function fetchReactionState(
  userId: string | null,
  targetType: string,
  rawTargetId: number | string,
): Promise<ToggleResult> {
  const targetId = Number(rawTargetId);
  if (!Number.isFinite(targetId)) return { liked: false, count: 0 };

  const [count, mine] = await Promise.all([
    countFor(targetType, targetId),
    userId
      ? supabase
          .from("reactions")
          .select("id")
          .eq("user_id", userId)
          .eq("target_type", targetType)
          .eq("target_id", targetId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return { liked: !!mine.data, count };
}
