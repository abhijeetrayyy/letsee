import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: { profileId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const profileId = body.profileId;
  if (!profileId) return jsonError("profileId is required", 400);
  if (profileId === userId) return jsonError("Cannot block yourself", 400);

  /**
   * One authorised unit, server-side — see migration 081.
   *
   * The three statements this replaces ran on the blocker's own client, and the
   * connection delete could not touch the row that mattered: the only DELETE
   * policy on user_connections is `USING (auth.uid() = follower_id)`, and on the
   * row where the blocked user follows the blocker, follower_id is the *other*
   * person. RLS filtered it out, PostgREST returned 200 having deleted nothing,
   * and this route never checked the count — so blocking reported success and
   * left them following you.
   *
   * It also removes the only place in this codebase where a caller-supplied id
   * was interpolated into a PostgREST filter expression.
   */
  const { error } = await supabase.rpc("block_user", { p_blocked: profileId });

  if (error) return jsonError(error.message, 500);

  return jsonSuccess({ ok: true, blocked: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const url = new URL(req.url);
  const profileId = url.searchParams.get("profileId");

  if (!profileId) return jsonError("profileId is required", 400);

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", profileId);

  if (error) return jsonError(error.message, 500);

  return jsonSuccess({ ok: true, unblocked: true });
}
