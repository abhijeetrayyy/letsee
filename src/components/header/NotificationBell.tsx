"use client";

import { IoNotificationsOutline } from "react-icons/io5";
import Link from "@components/ui/AppLink";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

/**
 * The count and its realtime channel moved into `@/lib/db/inbox`, which the
 * message icon and the mobile burger badge share. Three components asking
 * Postgres the same two questions over three separate websocket topics is what
 * this replaces; the burger was additionally polling an API route for it.
 *
 * It used to keep one local behaviour — a toast when an achievement unlocked,
 * because this is the component always mounted when one arrives. 092 removed
 * `achievement_unlocked` from the type constraint along with the other eight
 * ambient kinds, so nothing can write that row and the callback could never
 * fire. The bell is now a count and a link, which is all a bell needs to be
 * when every notification behind it is a person waiting on an answer.
 */
export default function NotificationBell({ userId }: { userId: string }) {
  const { notifications: count } = useUnreadCounts(userId);

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
