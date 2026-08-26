/**
 * The notifications page, read and marked from the browser.
 *
 * `notifications_select_self`, `_update_self` and `_delete_self` are all
 * `auth.uid() = user_id`, so this table is one of the clearest cases in the
 * codebase of a route that existed only to hold a cookie. The bell above it has
 * been reading the same table directly since 079 published it for realtime.
 */

import { supabase } from "@/utils/supabase/client";

export type NotificationItem = Record<string, unknown> & {
  id: number;
  is_read: boolean;
  created_at: string;
  actor: { username: string | null; avatar_url: string | null } | null;
};

export type NotificationPage = {
  data: NotificationItem[];
  unreadCount: number;
  totalItems: number;
  totalPages: number;
  page: number;
};

export async function fetchNotifications(
  userId: string,
  page = 1,
  limit = 20,
): Promise<NotificationPage> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const from = (safePage - 1) * safeLimit;

  const [listRes, unreadRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("*, actor:users!actor_id (username, avatar_url)", { count: "exact" })
      .eq("user_id", userId)
      /**
       * A unique tiebreaker makes the sort total. Without it, rows sharing a
       * timestamp can reshuffle between pages — and they do share one: the
       * quick-add bulk endpoint stamps a single `now` across an entire batch,
       * so logging forty titles at once creates forty rows with identical
       * times.
       */
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + safeLimit - 1),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false),
  ]);

  if (listRes.error) throw listRes.error;

  // PostgREST returns an embedded one-to-one as an array on some shapes.
  const data = (listRes.data ?? []).map((n: Record<string, unknown>) => ({
    ...n,
    actor: Array.isArray(n.actor) ? (n.actor[0] ?? null) : (n.actor ?? null),
  })) as NotificationItem[];

  const totalItems = listRes.count ?? 0;

  return {
    data,
    unreadCount: unreadRes.count ?? 0,
    totalItems,
    totalPages: Math.ceil(totalItems / safeLimit),
    page: safePage,
  };
}

/** Mark some notifications read, or all of them when `ids` is omitted. */
export async function markNotificationsRead(
  userId: string,
  ids?: number[],
): Promise<string | null> {
  let query = supabase.from("notifications").update({ is_read: true }).eq("user_id", userId);
  if (Array.isArray(ids) && ids.length > 0) query = query.in("id", ids);
  const { error } = await query;
  return error ? error.message : null;
}
