"use client";

import { useEffect, useState } from "react";
import {
  currentUnreadCounts,
  noUnread,
  subscribeUnreadCounts,
  type NotificationRow,
  type UnreadCounts,
} from "@/lib/db/inbox";

/**
 * The header's unread numbers, live, from one shared subscription.
 *
 * Replaces three separate implementations of the same idea — including the
 * burger's 120-second poll of `/api/notifications/unread-count`, which was a
 * function invocation per tick per open tab for a number Postgres will simply
 * tell us has changed.
 */
export function useUnreadCounts(
  userId: string | null | undefined,
  onNotification?: (row: NotificationRow) => void,
): UnreadCounts {
  const [counts, setCounts] = useState<UnreadCounts>(() =>
    userId ? currentUnreadCounts() : noUnread,
  );

  useEffect(() => {
    if (!userId) {
      setCounts(noUnread);
      return;
    }
    return subscribeUnreadCounts(userId, setCounts, onNotification);
    // `onNotification` is deliberately not a dependency: an inline callback
    // would tear down and re-open the channel on every render of the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return counts;
}
