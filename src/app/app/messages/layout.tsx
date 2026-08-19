import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getBlockedUserIds } from "@/utils/blocks";

export const dynamic = "force-dynamic";


type Conversation = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
  fromMe: boolean;
};

function preview(content: string | null, isCard: boolean): string {
  const text = (content ?? "").trim();
  if (isCard) return text || "Shared a film";
  return text || "…";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

import MessagesShell from "@components/messages/MessagesShell";

/**
 * Covers /app/messages and /app/messages/[id]. Both are private; robots.txt
 * disallows them and this answers anything that arrives regardless.
 */
export const metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};


async function getConversations(userId: string): Promise<Conversation[]> {
  const supabase = await createClient();

  /**
   * One row per conversation, from the database.
   *
   * This used to scan the newest 500 messages and fold them in application
   * code, which means a conversation vanishes from the inbox entirely once 500
   * newer ones exist — not slow, gone. `conversation_list` does it with one
   * DISTINCT ON and is correct at any volume. It runs on invoker rights, so
   * `messages_select_participants` still decides which rows exist at all.
   */
  const { data: rows, error } = await supabase.rpc("conversation_list", { p_user: userId });

  if (error || !rows) {
    // The function is deployed in migration 070; if an environment has not run
    // it yet, an empty inbox is a better failure than a crash.
    if (error) console.error("conversation_list:", error.message);
    return [];
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
  const visible = (rows as Row[]).filter((r) => r.partner_id !== userId && !blocked.has(r.partner_id));
  if (visible.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .in("id", visible.map((r) => r.partner_id));
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  return visible.map((r) => {
    const u = userById.get(r.partner_id);
    return {
      userId: r.partner_id,
      username: u?.username ?? "user",
      avatarUrl: u?.avatar_url ?? null,
      lastMessage: preview(r.last_content ?? "", r.last_message_type === "cardmix"),
      lastAt: r.last_at,
      unread: Number(r.unread) || 0,
      fromMe: r.last_from_me,
    };
  });
}

/**
 * The conversations are fetched HERE, in the layout, on purpose.
 *
 * A layout is not re-rendered when you navigate between the routes nested
 * inside it, so the list is fetched once for the whole session in this section
 * rather than once per conversation opened. That is what turns opening a
 * thread from a page rebuild into a highlight moving.
 */
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/messages");

  const conversations = await getConversations(user.id);

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <MessagesShell conversations={conversations}>{children}</MessagesShell>
    </div>
  );
}
