"use client";

import { usePathname } from "next/navigation";
import ConversationList, { type Conversation } from "./ConversationList";

/**
 * Two panes on a desktop, one at a time on a phone.
 *
 * A phone has no room for both, so the same two routes have to behave like a
 * stack there and like a split view on a wide screen — without becoming two
 * separate implementations. `usePathname` decides which pane is visible below
 * `md`, and both stay mounted, so going back to the list is instant and the
 * list keeps its scroll position instead of rebuilding at the top.
 */
export default function MessagesShell({
  conversations,
  children,
}: {
  conversations: Conversation[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const threadOpen = pathname.startsWith("/app/messages/") && pathname.split("/").length > 3;

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-6xl border-x border-surface-800/60">
      <aside
        className={`w-full shrink-0 border-r border-surface-800 md:block md:w-80 ${
          threadOpen ? "hidden" : "block"
        }`}
      >
        <ConversationList conversations={conversations} />
      </aside>

      <section className={`min-w-0 flex-1 ${threadOpen ? "block" : "hidden md:block"}`}>
        {children}
      </section>
    </div>
  );
}
