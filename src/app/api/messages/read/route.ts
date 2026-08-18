import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

/**
 * Mark a conversation read, on the server, and say how many it changed.
 *
 * This was a fire-and-forget client update — `void supabase.from("messages")
 * .update({ is_read: true }).in("id", ids)` — with no error check and no
 * confirmation. A failure was indistinguishable from success, and the count it
 * changed was never known, so the unread badge had nothing to reconcile
 * against and kept showing a message the reader had already opened.
 *
 * Scoped by sender rather than by a list of ids the client happened to have
 * loaded: opening a conversation means you have seen it, including anything
 * that arrived while it was open or that paging never fetched.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  let body: { withUserId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const withUserId = typeof body.withUserId === "string" ? body.withUserId.trim() : "";
  if (!withUserId) return jsonError("withUserId is required", 400);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("recipient_id", userId)
    .eq("sender_id", withUserId)
    .eq("is_read", false)
    .select("id");

  if (error) {
    console.error("messages read:", error);
    return jsonError("Couldn't mark those read", 500);
  }

  /**
   * Reading the conversation clears its notifications too.
   *
   * A DM raises a `dm_received` notification through a trigger, and nothing
   * ever cleared it — so the bell kept announcing a message you had opened,
   * read and replied to. Two counters for one fact, and only one of them was
   * ever decremented.
   *
   * Scoped to this sender so opening one conversation does not silently clear
   * the bell for every other person who wrote to you.
   */
  const { error: notifError } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("actor_id", withUserId)
    .eq("notification_type", "dm_received")
    .eq("is_read", false);

  if (notifError) console.error("messages read (notifications):", notifError);

  // The count is the point: the caller uses it to decide whether the badge
  // needs re-reading, and a zero tells it nothing changed rather than leaving
  // it to guess.
  return jsonSuccess({ marked: (data ?? []).length }, { maxAge: 0 });
}
