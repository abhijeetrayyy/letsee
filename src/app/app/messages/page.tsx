import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { MessageSquare, Users, Film } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import { getBlockedUserIds } from "@/utils/blocks";

export const dynamic = "force-dynamic";

/** How far back to look when deriving conversations. */
const SCAN_LIMIT = 500;

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

  const { data: messages } = await supabase
    .from("messages")
    .select("sender_id, recipient_id, content, message_type, is_read, created_at")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(SCAN_LIMIT);

  if (!messages?.length) return [];

  const blocked = await getBlockedUserIds(supabase, userId);

  // Messages arrive newest-first, so the first time we see a partner is their
  // latest message.
  const byPartner = new Map<string, { last: (typeof messages)[number]; unread: number }>();
  for (const m of messages) {
    const partner = m.sender_id === userId ? m.recipient_id : m.sender_id;
    if (partner === userId || blocked.has(partner)) continue;

    const entry = byPartner.get(partner);
    const isUnread = m.recipient_id === userId && !m.is_read;
    if (!entry) {
      byPartner.set(partner, { last: m, unread: isUnread ? 1 : 0 });
    } else if (isUnread) {
      entry.unread += 1;
    }
  }

  const partnerIds = [...byPartner.keys()];
  if (partnerIds.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .in("id", partnerIds);
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  return partnerIds
    .map((id) => {
      const { last, unread } = byPartner.get(id)!;
      const u = userById.get(id);
      return {
        userId: id,
        username: u?.username ?? "user",
        avatarUrl: u?.avatar_url ?? null,
        lastMessage: preview(last.content, last.message_type === "cardmix"),
        lastAt: last.created_at,
        unread,
        fromMe: last.sender_id === userId,
      };
    })
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
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
