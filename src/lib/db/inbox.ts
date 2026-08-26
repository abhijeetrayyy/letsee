/**
 * Unread counts for the bell, the message icon and the mobile burger badge.
 *
 * All three of these render in the header on every page, and they had three
 * different implementations: the bell and the message icon each read Supabase
 * directly and subscribed to realtime, while the burger polled
 * `/api/notifications/unread-count` on a 120-second interval for as long as a
 * tab stayed open. Same number, three sources, one of them billed per tick.
 *
 * `notifications` and `messages` are both in the `supabase_realtime`
 * publication (migrations 070 and 079), so the count does not need a clock at
 * all — the database says when it changed.
 */

import { supabase } from "@/utils/supabase/client";

export type UnreadCounts = {
  notifications: number;
  messages: number;
  total: number;
};

export const noUnread: UnreadCounts = { notifications: 0, messages: 0, total: 0 };

export async function fetchUnreadCounts(userId: string): Promise<UnreadCounts> {
  const [notifications, messages] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("is_read", false),
  ]);

  const notificationCount = notifications.error ? 0 : notifications.count ?? 0;
  const messageCount = messages.error ? 0 : messages.count ?? 0;

  return {
    notifications: notificationCount,
    messages: messageCount,
    total: notificationCount + messageCount,
  };
}

/**
 * One subscription for the whole header, not one per badge.
 *
 * The bell, the message icon and the burger all want the same two numbers, and
 * all three render at once. Three components each opening their own channel is
 * three websocket topics and three `select count(*)` round trips for one
 * answer, so the subscription lives here, at module scope, and the components
 * attach to it.
 *
 * The count is recomputed rather than incremented on every event except a
 * notification INSERT. Incrementing is only safe when the event *is* the
 * change; an UPDATE ("mark as read") can be one row or forty, and a DELETE
 * carries no unread flag to reason about, so those ask Postgres.
 */

type CountListener = (counts: UnreadCounts) => void;
export type NotificationRow = {
  notification_type?: string;
  metadata?: { name?: string; icon?: string } | null;
};
type NotificationListener = (row: NotificationRow) => void;

const countListeners = new Set<CountListener>();
const notificationListeners = new Set<NotificationListener>();

let current: UnreadCounts = noUnread;
let activeUserId: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
let detachWindow: (() => void) | null = null;

function publish(next: UnreadCounts) {
  current = next;
  for (const listener of countListeners) listener(next);
}

async function reload() {
  const requestedFor = activeUserId;
  if (!requestedFor) return;
  const next = await fetchUnreadCounts(requestedFor);
  // A response that arrives after a sign-out, or after a different account
  // signed in, belongs to nobody — publishing it would badge the new header
  // with the previous person's count.
  if (activeUserId === requestedFor) publish(next);
}

function teardown() {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  if (detachWindow) {
    detachWindow();
    detachWindow = null;
  }
  activeUserId = null;
  current = noUnread;
}

function setup(userId: string) {
  activeUserId = userId;
  void reload();

  channel = supabase
    .channel(`inbox-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => {
        publish({
          ...current,
          notifications: current.notifications + 1,
          total: current.total + 1,
        });
        for (const listener of notificationListeners) {
          listener(payload.new as NotificationRow);
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      () => void reload(),
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "notifications" },
      () => void reload(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` },
      () => void reload(),
    )
    .subscribe();

  /**
   * Reading a conversation clears its `dm_received` notifications, and that
   * happens through a path realtime does not always report in time. The thread
   * announces what it did; this listens, because "usually delivered" is what
   * left the badge stale for a whole session.
   */
  const onMessagesRead = () => void reload();
  const onVisible = () => {
    if (document.visibilityState === "visible") void reload();
  };
  window.addEventListener("letsee:messages-read", onMessagesRead);
  document.addEventListener("visibilitychange", onVisible);
  detachWindow = () => {
    window.removeEventListener("letsee:messages-read", onMessagesRead);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** Attach to the shared counts. Returns an unsubscribe. */
export function subscribeUnreadCounts(
  userId: string,
  onCounts: CountListener,
  onNotification?: NotificationListener,
): () => void {
  if (activeUserId && activeUserId !== userId) teardown();
  countListeners.add(onCounts);
  if (onNotification) notificationListeners.add(onNotification);

  if (!activeUserId) setup(userId);
  else onCounts(current);

  return () => {
    countListeners.delete(onCounts);
    if (onNotification) notificationListeners.delete(onNotification);
    // The last badge to unmount closes the channel. A header that is still on
    // screen keeps it open, which is the normal case for a route change.
    if (countListeners.size === 0) teardown();
  };
}

/** The counts as last known, for a component mounting mid-session. */
export function currentUnreadCounts(): UnreadCounts {
  return current;
}

/** Force a re-read — for a path that changed the counts without an event. */
export function refreshUnreadCounts() {
  void reload();
}
