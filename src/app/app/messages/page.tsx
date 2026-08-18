import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { MessageSquare, Users, Film } from "lucide-react";
import Avatar from "@components/ui/Avatar";
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

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversations = await getConversations(user.id);
  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);

  return (
    <div className="min-h-screen w-full bg-surface-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        <header className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
            <p className="mt-1 text-sm text-surface-500">
              {totalUnread > 0
                ? `${totalUnread} unread`
                : conversations.length > 0
                  ? `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`
                  : "No conversations yet"}
            </p>
          </div>
          <Link
            href="/app/profile"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-800 border border-surface-700 px-3.5 py-2 text-xs font-medium text-surface-300 hover:bg-surface-700 hover:text-white transition-colors"
          >
            <Users className="size-3.5" /> Find people
          </Link>
        </header>

        {conversations.length === 0 ? (
          <div className="rounded-2xl border border-surface-700/60 bg-surface-900/40 p-10 text-center">
            <MessageSquare className="mx-auto mb-4 size-10 text-surface-600" />
            <h2 className="text-base font-semibold text-white">No messages yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-surface-400">
              Find someone who shares your taste and say hello — or send them a
              film. Sharing something you both love is an easier opener than
              &ldquo;hi&rdquo;.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Link
                href="/app/profile"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-surface-950 hover:bg-brand-400 transition-colors"
              >
                <Users className="size-4" /> Discover people
              </Link>
              <Link
                href="/app"
                className="inline-flex items-center gap-1.5 rounded-full border border-surface-700 bg-surface-800 px-4 py-2 text-sm font-medium text-surface-300 hover:bg-surface-700 transition-colors"
              >
                <Film className="size-4" /> Browse films
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-surface-800/70 overflow-hidden rounded-2xl border border-surface-700/60 bg-surface-900/40">
            {conversations.map((c) => (
              <li key={c.userId}>
                <Link
                  href={`/app/messages/${c.userId}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-800/60"
                >
                  <Avatar src={c.avatarUrl} name={c.username} size="lg" className="size-12" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-sm ${c.unread > 0 ? "font-bold text-white" : "font-semibold text-surface-200"}`}
                      >
                        @{c.username}
                      </span>
                      <span className="shrink-0 text-[11px] text-surface-500">
                        {relativeTime(c.lastAt)}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 truncate text-xs ${c.unread > 0 ? "text-surface-200" : "text-surface-500"}`}
                    >
                      {c.fromMe && <span className="text-surface-600">You: </span>}
                      {c.lastMessage}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="ml-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-surface-950">
                      {c.unread > 9 ? "9+" : c.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
