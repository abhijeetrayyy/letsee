import { supabase } from "@/utils/supabase/client";

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
 * Accepts a follow request.
 *
 * This used to insert into `user_connections` from the browser, under the
 * receiver's session — and 042's insert policy is
 * `WITH CHECK (auth.uid() = follower_id)`, where follower_id is the SENDER. The
 * receiver is never the sender, so it failed on every account, every time, and
 * the caller's `if (!error)` hid it. See migration 080.
 *
 * `accept_follow_request` is SECURITY DEFINER: it proves the caller is the
 * recipient of that exact request, re-applies the block check the policy would
 * have made, writes the connection, notifies the sender, and deletes the
 * request row. The row is deleted rather than marked accepted because
 * `sendFollowRequest` below refuses while any row exists — leaving an accepted
 * row behind would permanently block re-following after an unfollow.
 */
export const acceptFollowRequest = async (requestId: number) => {
  const { error } = await supabase.rpc("accept_follow_request", {
    p_request_id: requestId,
  });
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
