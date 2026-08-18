import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getBlockedUserIds } from "@/utils/blocks";

/**
 * The conversation list, re-readable without a navigation.
 *
 * The layout renders this list server-side, which is right for the first
 * paint and useless afterwards: a message arriving could not reorder the list
 * or bump an unread count until you happened to navigate. This is the same
 * query behind an endpoint the mounted list can call when realtime tells it
 * something changed.
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("conversation_list", { p_user: userId });
  if (error) {
    console.error("conversations:", error.message);
    return jsonError("Couldn't load conversations", 500);
  }

  type Row = {
    partner_id: string;
    last_content: string | null;
    last_message_type: string | null;
    last_at: string;
    last_from_me: boolean;
    unread: number;
  };

  const blocked = await getBlockedUserIds(supabase, userId);
  const visible = ((rows ?? []) as Row[]).filter(
    (r) => r.partner_id !== userId && !blocked.has(r.partner_id),
  );
  if (visible.length === 0) return jsonSuccess({ conversations: [] }, { maxAge: 0 });

  const { data: users } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .in("id", visible.map((r) => r.partner_id));
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  return jsonSuccess(
    {
      conversations: visible.map((r) => {
        const u = byId.get(r.partner_id);
        const isCard = r.last_message_type === "cardmix";
        return {
          userId: r.partner_id,
          username: u?.username ?? "user",
          avatarUrl: u?.avatar_url ?? null,
          // Matches the layout's `preview`: a shared card with no note should
          // read as a thing sent, not as an empty line.
          lastMessage: (r.last_content ?? "").trim() || (isCard ? "Sent a title" : ""),
          lastAt: r.last_at,
          unread: Number(r.unread) || 0,
          fromMe: r.last_from_me,
        };
      }),
    },
    { maxAge: 0 },
  );
}
