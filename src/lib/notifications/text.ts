import { episodePath, reviewPath, seasonPath, titlePath } from "@/utils/urls";

/** What a notification needs to be put into words. */
export type NotificationLike = {
  notification_type: string;
  actor_id: string | null;
  actor: { username: string | null } | null;
  metadata: Record<string, unknown> | null;
};

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
export type Rendered = { text: string; href?: string; detail?: string; action?: "co_log" };

export function str(meta: Record<string, unknown> | null, key: string): string {
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

export function getNotificationText(n: NotificationLike): Rendered {
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
      return { text: `${username} sent you a message`, href: `/app/people/${encodeURIComponent(n.actor?.username ?? n.actor_id ?? "")}` };
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
      return { text, href: "/app/up-next" };
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
