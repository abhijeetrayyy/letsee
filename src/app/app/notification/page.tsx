"use client";

import Link from "@components/ui/AppLink";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import toast from "react-hot-toast";
import { acceptFollowRequest, rejectFollowRequest } from "@/utils/followerAction";
import {
  UserPlus,
  UserCheck,
  MessageSquare,
  CheckCheck,
  Bell,
  Loader2,
  Users,
  Gift,
  Reply,
  MonitorPlay,
  Tv,
} from "lucide-react";
import Avatar from "@components/ui/Avatar";
import {
  fetchNotifications as fetchNotificationPage,
  markNotificationsRead,
} from "@/lib/db/notifications";
import { acceptCoLog } from "@/lib/db/viewings";
import { episodePath, reviewPath, seasonPath, titlePath } from "@/utils/urls";

type ActorProfile = {
  username: string | null;
  avatar_url: string | null;
};

type NotificationItem = {
  id: number;
  notification_type: string;
  /** Nullable in the schema (063). Every surviving type has an actor. */
  actor_id: string | null;
  actor: ActorProfile;
  target_type: string | null;
  target_id: number | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

type FollowRequestItem = {
  id: number;
  sender_id: string;
  status: string;
  created_at: string;
  sender: {
    username: string | null;
    avatar_url: string | null;
  } | null;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function notificationIcon(type: string) {
  switch (type) {
    case "follow_request": return <UserPlus className="w-4 h-4 text-blue-400" />;
    case "follow_accepted": return <UserCheck className="w-4 h-4 text-emerald-400" />;
    case "new_follower": return <UserPlus className="w-4 h-4 text-blue-400" />;
    case "dm_received": return <MessageSquare className="w-4 h-4 text-brand-400" />;
    case "co_log_invite": return <Users className="w-4 h-4 text-brand-400" />;
    case "recommendation_watched": return <Gift className="w-4 h-4 text-amber-400" />;
    case "comment_reply": return <Reply className="w-4 h-4 text-purple-400" />;
    case "watchlist_available": return <MonitorPlay className="w-4 h-4 text-emerald-400" />;
    case "new_episode": return <Tv className="w-4 h-4 text-sky-400" />;
    default: return <Bell className="w-4 h-4 text-surface-400" />;
  }
}

/**
 * Nine kinds, and the database will not store a tenth (098).
 *
 * 092 cut the list to four — a named human doing something to you, on purpose,
 * that you would want to answer — and dropped nine ambient broadcasts, two of
 * which fanned out one row per follower per write. The rule that survives
 * across every tracker that lasted is one step wider than "person to person":
 * **only what the user caused.** 096–098 add five kinds under that rule:
 *
 *   co_log_invite          someone logged a viewing and named you
 *   recommendation_watched someone watched a title you recommended
 *   comment_reply          someone answered you
 *   watchlist_available    a title on YOUR watchlist arrived on YOUR service
 *   new_episode            a show YOU are watching has a new episode
 *
 * The last two have no actor — nobody did anything to you; you caused them by
 * saving a title and naming a service — and are written once a day, per user,
 * from that user's own list. Nothing fans out.
 *
 * `default` still exists and still reads sensibly, because a row written
 * before 092 could in principle survive a restore; it is not a placeholder for
 * a type that is coming back.
 */
type Rendered = { text: string; href?: string; detail?: string; action?: "co_log" };

function str(meta: Record<string, unknown> | null, key: string): string {
  const v = meta?.[key];
  return typeof v === "string" ? v : "";
}
function num(meta: Record<string, unknown> | null, key: string): number | null {
  const v = meta?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Where a reply's thread lives: a title, a review, a season or an episode. */
function threadHref(itemType: string, itemId: string): string | undefined {
  if (!itemId) return undefined;
  if (itemType === "movie" || itemType === "tv") return titlePath(itemType, itemId);
  if (itemType === "review") return reviewPath(itemId);
  const season = /^(\d+)-s(\d+)$/.exec(itemId);
  if (itemType === "season" && season) return seasonPath(season[1], season[2]);
  const episode = /^(\d+)-s(\d+)-e(\d+)$/.exec(itemId);
  if (itemType === "episode" && episode) return episodePath(episode[1], episode[2], episode[3]);
  return undefined;
}

function getNotificationText(n: NotificationItem): Rendered {
  const username = n.actor?.username ?? "Someone";
  const meta = n.metadata;
  switch (n.notification_type) {
    case "follow_request":
      return { text: `${username} wants to follow you`, href: undefined };
    case "follow_accepted":
      return { text: `${username} accepted your follow request`, href: `/app/profile/${username}` };
    case "new_follower":
      return { text: `${username} started following you`, href: `/app/profile/${username}` };
    case "dm_received":
      return { text: `${username} sent you a message`, href: `/app/messages/${n.actor_id ?? ""}` };
    case "co_log_invite": {
      const title = str(meta, "item_name") || "something";
      return {
        text: `${username} watched ${title} with you`,
        detail: "Add it to your diary too, on the same day.",
        action: "co_log",
      };
    }
    case "recommendation_watched": {
      const title = str(meta, "item_name") || "something";
      return {
        text: `${username} watched ${title}. You told them to.`,
        href: titlePath(str(meta, "item_type") || "movie", str(meta, "item_id"), title),
      };
    }
    case "comment_reply": {
      const body = str(meta, "comment_body");
      return {
        text: `${username} replied to you`,
        detail: body ? `“${body}”` : undefined,
        href: threadHref(str(meta, "item_type"), str(meta, "item_id")),
      };
    }
    case "watchlist_available": {
      const count = num(meta, "count") ?? 1;
      const first = str(meta, "first_name");
      const provider = str(meta, "provider_name");
      const text =
        count === 1
          ? `${first || "A title on your watchlist"} arrived on ${provider || "a service you have"}`
          : `${count} titles on your watchlist arrived on ${provider || "your services"}`;
      return { text, href: "/app/watchlist" };
    }
    case "new_episode": {
      const show = str(meta, "show_name") || "A show you are watching";
      const s = num(meta, "season_number");
      const e = num(meta, "episode_number");
      const name = str(meta, "episode_name");
      const label = s != null && e != null ? `S${s}E${e}${name ? ` · ${name}` : ""}` : "a new episode";
      const showId = str(meta, "show_id");
      return {
        text: `${show} is back: ${label}`,
        href: showId && s != null ? seasonPath(showId, s, show) : undefined,
      };
    }
    default:
      return { text: `New notification from ${username}` };
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const limit = 20;

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Fetch notifications
  /**
   * Read straight from `notifications`, the way the bell above it already does.
   *
   * `notifications_select_self` is `auth.uid() = user_id`, so `/api/notifications`
   * was a Vercel function whose only contribution was reading the cookie that
   * the browser client reads for itself. The follow-request query directly
   * below has been doing it this way the whole time.
   */
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchNotificationPage(userId, page, limit);
      setNotifications(data.data as unknown as NotificationItem[]);
      setUnreadCount(data.unreadCount);
      setTotalPages(data.totalPages);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [page, userId]);

  // Fetch follow requests directly
  const fetchFollowRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("user_follow_requests")
        .select(`
          id,
          sender_id,
          status,
          created_at,
          sender:users!sender_id (
            username,
            avatar_url
          )
        `)
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      // Supabase returns joined data as array; extract first element
      const requests: FollowRequestItem[] = (data ?? []).map((r: any) => ({
        id: r.id,
        sender_id: r.sender_id,
        status: r.status,
        created_at: r.created_at,
        sender: Array.isArray(r.sender) && r.sender.length > 0 ? r.sender[0] : null,
      }));

      setFollowRequests(requests);
    } catch {
      // Silent
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchFollowRequests();
  }, [fetchFollowRequests]);

  // Mark all as read
  const markAllRead = async () => {
    if (!userId) return;
    const message = await markNotificationsRead(userId);
    if (message) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    // The badge lives in a shared store now, and marking read is an UPDATE the
    // realtime channel reports — but the store re-reads on this event too,
    // because "usually delivered" is what left this badge stale before.
    window.dispatchEvent(new Event("letsee:messages-read"));
  };

  // Accept follow request
  const handleAccept = async (requestId: number) => {
    if (!userId) return;
    const { error } = await acceptFollowRequest(requestId);
    if (error) {
      // Silence here is what kept migration 080's bug invisible: the insert was
      // rejected by RLS on every attempt and this branch did nothing, so the
      // button looked like a missed tap rather than a failure.
      toast.error(error.message || "Couldn't accept that request.");
      return;
    }
    setFollowRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  // Reject follow request
  const handleReject = async (requestId: number) => {
    const { error } = await rejectFollowRequest(requestId);
    if (error) {
      toast.error(error.message || "Couldn't decline that request.");
      return;
    }
    setFollowRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-400" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-surface-400 mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Follow Requests */}
      {followRequests.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
            Follow Requests ({followRequests.length})
          </h2>
          <div className="space-y-2">
            {followRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5"
              >
                <Avatar
                  src={req.sender?.avatar_url}
                  name={req.sender?.username ?? "user"}
                  size="md"
                  className="border-2 border-surface-700"
                />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/app/profile/${req.sender?.username ?? ""}`}
                    className="text-sm font-semibold text-surface-100 hover:text-brand-400 transition-colors"
                  >
                    {req.sender?.username ?? "Unknown"}
                  </Link>
                  <p className="text-xs text-surface-500">
                    wants to follow you · {formatDate(req.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleAccept(req.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-xs font-semibold hover:bg-surface-600 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-surface-400 animate-spin" />
        </div>
      ) : notifications.length === 0 && followRequests.length === 0 ? (
        <div className="rounded-xl border border-surface-700/50 bg-surface-900/30 p-12 text-center">
          <Bell className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">No notifications yet.</p>
          <p className="text-surface-600 text-xs mt-1">
            When someone follows you, messages you, answers you, names you on a viewing, or watches
            something you told them to — and when a title you saved arrives on a service you have —
            it will show here.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {notifications.map((n) => {
              const { text, href, detail, action } = getNotificationText(n);
              const content = (
                <div
                  className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                    n.is_read
                      ? "bg-surface-900/20 hover:bg-surface-900/40"
                      : "bg-brand-500/5 border border-brand-500/10 hover:bg-brand-500/10"
                  }`}
                >
                  {/* Actor avatar — or, for the two kinds nobody sent, the icon alone. */}
                  <div className="shrink-0 relative">
                    {n.actor_id ? (
                      <>
                        <Avatar
                          src={n.actor?.avatar_url}
                          name={n.actor?.username ?? "user"}
                          size="md"
                          className="border-2 border-surface-700"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 bg-surface-900 rounded-full p-0.5">
                          {notificationIcon(n.notification_type)}
                        </span>
                      </>
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded-full border-2 border-surface-700 bg-surface-800">
                        {notificationIcon(n.notification_type)}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-200">
                      {text}
                    </p>
                    {detail && (
                      <p className="text-xs text-surface-400 mt-0.5 line-clamp-2">{detail}</p>
                    )}
                    <p className="text-xs text-surface-500 mt-0.5">
                      {formatDate(n.created_at)}
                    </p>
                    {action === "co_log" && n.target_id != null && (
                      <CoLogAction
                        viewingId={n.target_id}
                        done={n.is_read}
                        href={titlePath(str(n.metadata, "item_type") || "movie", str(n.metadata, "item_id"), str(n.metadata, "item_name"))}
                        onDone={() =>
                          setNotifications((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
                          )
                        }
                      />
                    )}
                  </div>

                  {/* Unread indicator */}
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-brand-400 shrink-0 mt-2" />
                  )}
                </div>
              );

              return href ? (
                <Link key={n.id} href={href} className="block">
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-800 text-surface-200 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-surface-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-800 text-surface-200 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * "I was there too": the one notification that is a question.
 *
 * Accepting writes the viewer's own viewing — same day, same place — through
 * `accept_co_log` (096), links it to the other person's, and marks the title
 * watched. Nothing happened to the viewer's library until they tapped this.
 */
function CoLogAction({
  viewingId,
  done,
  href,
  onDone,
}: {
  viewingId: number;
  done: boolean;
  href: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      const { error } = await acceptCoLog(viewingId);
      if (error) {
        toast.error(error);
        return;
      }
      setAccepted(true);
      onDone();
      toast.success("Added to your diary");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {accepted || done ? (
        <Link href={href} className="text-xs text-brand-400 hover:text-brand-300">
          {accepted ? "In your diary — open it" : "Open the title"}
        </Link>
      ) : (
        <>
          <button
            type="button"
            onClick={accept}
            disabled={busy}
            className="rounded-full bg-brand-500/15 px-3 py-1.5 text-xs font-medium text-brand-300 transition hover:bg-brand-500/25 disabled:opacity-50"
          >
            {busy ? "Adding…" : "I was there too"}
          </button>
          <Link href={href} className="text-xs text-surface-500 hover:text-white">
            Open the title
          </Link>
        </>
      )}
    </div>
  );
}
