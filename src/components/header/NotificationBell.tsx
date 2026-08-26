"use client";

import { useCallback } from "react";
import { IoNotificationsOutline } from "react-icons/io5";
import Link from "@components/ui/AppLink";
import toast from "react-hot-toast";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import type { NotificationRow } from "@/lib/db/inbox";

/**
 * The count and its realtime channel moved into `@/lib/db/inbox`, which the
 * message icon and the mobile burger badge share. Three components asking
 * Postgres the same two questions over three separate websocket topics is what
 * this replaces; the burger was additionally polling an API route for it.
 *
 * What stays here is the part that is only true of the bell: an achievement
 * unlocking is worth a toast, and this is the component that is always mounted
 * when one arrives.
 */
export default function NotificationBell({ userId }: { userId: string }) {
  const onNotification = useCallback((row: NotificationRow) => {
    if (row.notification_type !== "achievement_unlocked") return;
    const name = row.metadata?.name ?? "an achievement";
    const icon = row.metadata?.icon ?? "🏆";
    toast.success(`${icon} Unlocked: ${name}!`, { duration: 5000 });
  }, []);

  const { notifications: count } = useUnreadCounts(userId, onNotification);

  return (
    <Link
      href="/app/notification"
      className="nav-icon-btn relative"
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
    >
      <IoNotificationsOutline className="size-4" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
