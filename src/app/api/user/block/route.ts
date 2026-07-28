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

  // Remove any existing follow relationship
  await supabase
    .from("user_connections")
    .delete()
    .or(`follower_id.eq.${userId},followed_id.eq.${userId}`)
    .or(`follower_id.eq.${profileId},followed_id.eq.${profileId}`);

  // Remove follow requests
  await supabase
    .from("user_follow_requests")
    .delete()
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`);

  const { error } = await supabase.from("user_blocks").upsert(
    { blocker_id: userId, blocked_id: profileId },
    { onConflict: "blocker_id,blocked_id" }
  );

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
