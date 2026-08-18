"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const activeId = pathname.startsWith("/app/messages/") ? pathname.split("/")[3] : null;

  return (
    <nav aria-label="Conversations" className="flex h-full flex-col">
      <div className="shrink-0 border-b border-surface-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-white">Messages</h1>
        <p className="mt-0.5 text-[11px] text-surface-500">
          {conversations.length === 0
            ? "No conversations yet"
            : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <MessageSquare className="mb-3 size-7 text-surface-700" aria-hidden />
          <p className="text-sm text-surface-500">Send someone a film and it starts here.</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {conversations.map((c) => {
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
