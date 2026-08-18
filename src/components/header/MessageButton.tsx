// components/MessageButton.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { LuSend } from "react-icons/lu";

interface MessageButtonProps {
  userId: string;
  className?: string;
}

const MessageButton: React.FC<MessageButtonProps> = ({ userId, className }) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("is_read", false);

      if (error) {
        console.error("Error fetching unread messages count:", error.message);
      } else {
        setUnreadCount(count || 0);
      }
    };

    fetchUnreadCount();

    /**
     * Re-read when a thread reports it marked something.
     *
     * The badge relied entirely on a realtime UPDATE event, which has to be
     * enabled on the table and actually delivered before it helps. When it did
     * not arrive the count stayed stale until a full reload — which is the
     * "I read it and it still says one pending" report. The thread now
     * announces what it did, and this listens.
     */
    const onRead = () => void fetchUnreadCount();
    window.addEventListener("letsee:messages-read", onRead);

    const channel = supabase
      .channel(`realtime-unread-count-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("letsee:messages-read", onRead);
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

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
