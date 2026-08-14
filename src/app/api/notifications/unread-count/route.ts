import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

/**
 * GET /api/notifications/unread-count
 *
 * Combined unread notifications + messages. The mobile header hides the bell
 * and message icons (the burger already links to both), so the burger trigger
 * needs one number to badge itself with.
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const [notifications, messages] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("is_read", false),
  ]);

  const notificationCount = notifications.count ?? 0;
  const messageCount = messages.error ? 0 : messages.count ?? 0;

  return jsonSuccess(
    {
      notifications: notificationCount,
      messages: messageCount,
      total: notificationCount + messageCount,
    },
    { maxAge: 0 },
  );
}
