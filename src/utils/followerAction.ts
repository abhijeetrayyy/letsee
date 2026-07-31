import { supabase } from "@/utils/supabase/client";

/** Fire-and-forget: check/award follower-count achievements (e.g. social-butterfly) for the user who just gained a follower. */
function checkFollowAchievements(userId: string) {
  supabase
    .rpc("check_achievements", { p_user_id: userId, p_action: "follow" })
    .then(({ data }) => {
      for (const row of data ?? []) {
        void supabase.rpc("award_achievement", { p_user_id: userId, p_achievement_id: row.achievement_id });
      }
    })
    .then(undefined, () => {});
}

/**
 * Follows `receiverId`. Public profiles connect instantly (straight into
 * user_connections); private profiles still go through the pending-request
 * queue via sendFollowRequest.
 */
export const followUser = async (
  senderId: string,
  receiverId: string,
  receiverVisibility: string
) => {
  if (receiverVisibility?.toLowerCase() === "public") {
    const { data, error } = await supabase
      .from("user_connections")
      .insert({ follower_id: senderId, followed_id: receiverId })
      .select()
      .single();
    if (!error) checkFollowAchievements(receiverId);
    return { data, error, instant: true as const };
  }
  const result = await sendFollowRequest(senderId, receiverId);
  return { ...result, instant: false as const };
};

/**
 * Sends a follow request from `senderId` to `receiverId`.
 * Ensures duplicate requests aren't inserted.
 */
export const sendFollowRequest = async (
  senderId: string,
  receiverId: string
) => {
  // Check if a request already exists
  const { data: existingRequest, error: checkError } = await supabase
    .from("user_follow_requests")
    .select("id, status")
    .eq("sender_id", senderId)
    .eq("receiver_id", receiverId)
    .maybeSingle();

  if (checkError) return { error: checkError };

  if (existingRequest) {
    return { error: "Follow request already exists." };
  }

  // Insert new follow request
  const { data, error } = await supabase
    .from("user_follow_requests")
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      status: "pending",
    })
    .select()
    .single();

  return { data, error };
};

/**
 * Accepts a follow request:
 * - Inserts the sender into `user_connections`
 * - Deletes the request from `user_follow_requests`
 */
export const acceptFollowRequest = async (
  requestId: number,
  senderId: string,
  receiverId: string
) => {
  // Add to user_connections
  const { error: connError } = await supabase.from("user_connections").insert({
    follower_id: senderId,
    followed_id: receiverId,
  });

  if (connError) return { error: connError };

  // Update request status to "accepted"
  const { error } = await supabase
    .from("user_follow_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);

  if (!error) checkFollowAchievements(receiverId);

  return { error };
};

/**
 * Rejects a follow request by deleting it from `user_follow_requests`.
 */
export const rejectFollowRequest = async (requestId: number) => {
  const { error } = await supabase
    .from("user_follow_requests")
    .delete()
    .eq("id", requestId);

  return { error };
};
