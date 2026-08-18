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

  // The count is the point: the caller uses it to decide whether the badge
  // needs re-reading, and a zero tells it nothing changed rather than leaving
  // it to guess.
  return jsonSuccess({ marked: (data ?? []).length }, { maxAge: 0 });
}
