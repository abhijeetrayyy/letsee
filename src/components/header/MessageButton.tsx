"use client";

import Link from "@components/ui/AppLink";
import { LuSend } from "react-icons/lu";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

interface MessageButtonProps {
  userId: string;
  className?: string;
}

/**
 * Reads its number from the header's one shared subscription — see
 * `@/lib/db/inbox`. It previously kept its own channel and its own
 * `select count(*)`, alongside the bell's, alongside the burger's poll.
 *
 * The `letsee:messages-read` window event is still honoured, in the store: a
 * thread announces what it marked, because relying on the realtime UPDATE
 * alone is what left this badge reading "1 pending" after the message had been
 * read.
 */
const MessageButton: React.FC<MessageButtonProps> = ({ userId, className }) => {
  const { messages: unreadCount } = useUnreadCounts(userId);

  return (
    <Link
      href="/app/messages"
      className={`nav-icon-btn relative ${className ?? ""}`}
      aria-label={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <LuSend className="size-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
};

export default MessageButton;
