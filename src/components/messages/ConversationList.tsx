"use client";

import { useEffect } from "react";
import Link from "@components/ui/AppLink";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { supabase } from "@/utils/supabase/client";
import { fetchConversations } from "@/lib/db/social";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { MessageSquare } from "lucide-react";
import Avatar from "@components/ui/Avatar";

/**
 * The conversation list, living in the layout so it never unmounts.
 *
 * The inbox and the thread used to be two sibling routes, so moving between
 * them was a full navigation: the list was torn down and refetched every time
 * you opened a conversation, and the screen blanked in between. That is the
 * "choppy, feels like a reload" of it — not slow rendering, a genuine remount.
 *
 * Held in a layout both routes share, the list stays mounted and only the
 * thread beside it re-renders. Opening a conversation becomes a highlight
 * moving rather than a page rebuilding.
 */

export type Conversation = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
  fromMe: boolean;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  // Formatted from the parts rather than toLocaleDateString, whose runtime
  // default differs between server and browser and has cost this repo a
  // hydration failure before.
  const [, mo, day] = iso.slice(0, 10).split("-");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${MONTHS[Number(mo) - 1]}`;
}

export default function ConversationList({ conversations }: { conversations: Conversation[] }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  /**
   * The server render is the first paint; realtime keeps it true after that.
   *
   * Rendered only on the server, this list was correct exactly once — a
   * message arriving could not reorder it or bump an unread count until you
   * happened to navigate, which on a page whose whole job is showing what is
   * new is the wrong kind of stale.
   *
   * `fallbackData` means the server rows are what paints; SWR only replaces
   * them once something says they changed, so this adds no request to the
   * first load.
   */
  const { data, mutate } = useSWR(
    viewerId ? ["conversations", viewerId] : null,
    () => fetchConversations(viewerId!),
    { fallbackData: conversations, revalidateOnFocus: true },
  );
  const list = data ?? conversations;

  useEffect(() => {
    /**
     * Both events matter and for different reasons: INSERT is a new message
     * arriving, UPDATE is one being read — which changes an unread count
     * without changing the ordering. RLS already limits these rows to
     * conversations this viewer is part of, so there is nothing to filter.
     */
    const ch = supabase
      .channel("conversation-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void mutate())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => void mutate())
      .subscribe();

    // Reading a thread clears its rows through the API, not through this
    // client, so the same event the badges listen for refreshes the list too.
    const onRead = () => void mutate();
    window.addEventListener("letsee:messages-read", onRead);

    return () => {
      window.removeEventListener("letsee:messages-read", onRead);
      void supabase.removeChannel(ch);
    };
  }, [mutate]);

  const activeId = pathname.startsWith("/app/messages/") ? pathname.split("/")[3] : null;


  return (
    <nav aria-label="Conversations" className="flex h-full flex-col">
      <div className="shrink-0 border-b border-surface-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-white">Messages</h1>
        <p className="mt-0.5 text-[11px] text-surface-500">
          {list.length === 0
            ? "No conversations yet"
            : `${list.length} conversation${list.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <MessageSquare className="mb-3 size-7 text-surface-700" aria-hidden />
          <p className="text-sm text-surface-500">Send someone a film and it starts here.</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {list.map((c) => {
            const active = c.userId === activeId;
            return (
              <li key={c.userId}>
                <Link
                  href={`/app/messages/${c.userId}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 border-l-2 px-4 py-3 transition-colors ${
                    active
                      ? "border-brand-500 bg-surface-800/70"
                      : "border-transparent hover:bg-surface-800/40"
                  }`}
                >
                  <Avatar src={c.avatarUrl} name={c.username} size="md" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-sm ${c.unread > 0 ? "font-bold text-white" : "font-medium text-surface-200"}`}
                      >
                        @{c.username}
                      </span>
                      <span className="shrink-0 text-[10px] text-surface-500">{relativeTime(c.lastAt)}</span>
                    </div>
                    <p
                      className={`mt-0.5 truncate text-xs ${c.unread > 0 ? "text-surface-200" : "text-surface-500"}`}
                    >
                      {c.fromMe && <span className="text-surface-600">You: </span>}
                      {c.lastMessage}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-surface-950">
                      {c.unread > 9 ? "9+" : c.unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
