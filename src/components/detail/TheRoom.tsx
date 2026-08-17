"use client";

import Link from "next/link";
import useSWR from "swr";
import { Users } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import FollowButton from "@components/profile/FollowButton";
import { swrFetcher } from "@/utils/swrFetcher";
import { formatStars } from "@/utils/ratingScale";

/**
 * Everyone who is in the room with you on one title.
 *
 * This replaces three sidebar cards — TitleAudience, FriendsWhoWatched and
 * RatingDistribution — which each fetched separately, each rendered its own
 * border, and between them still answered only "who did I already know". Three
 * boxes stacked in a column read as three unrelated facts; the people on a
 * title page are one fact.
 *
 * ── The order is the argument ───────────────────────────────────────────────
 * People first, numbers last. The histogram is the room's aggregate opinion and
 * it is genuinely useful, but it is the part of this block a reader can get
 * anywhere. Who is standing here is the part they cannot, so it goes on top and
 * the distribution sits underneath as the footnote it is.
 *
 * ── There is no composer here ───────────────────────────────────────────────
 * TitleTalk is the only place on a title page you can type. This block is for
 * reading the room, and it links into that thread rather than repeating it:
 * a person who wrote about the title is labelled as having written, and their
 * words stay in the one place they were posted.
 */

type Status = "watchlist" | "watching" | "watched" | "on_hold" | "dropped";

type Person = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: Status | null;
  score: number | null;
  /** They rated it. Separate from `score`, which is null when they hide it. */
  rated: boolean;
  hasNote: boolean;
  followState: "following" | "pending" | "follow";
  visibility: string;
};

type Room = {
  viewerId: string | null;
  viewerScore: number | null;
  viewerHasSeen: boolean;
  audience: {
    watchers: number;
    communityUsers: number;
    sample: { userId: string; username: string; avatarUrl: string | null }[];
  };
  ratings: {
    total: number;
    average: number;
    distribution: { score: number; count: number; percentage: number }[];
  };
  following: Person[];
  followingTotal: number;
  discover: Person[];
};

const STATUS_LABEL: Record<Status, string> = {
  watched: "Watched",
  watching: "Watching",
  on_hold: "On hold",
  dropped: "Dropped",
  watchlist: "Watchlist",
};

/**
 * The counts from `title_audience` exclude the viewer, so every sentence here
 * has to put them back in explicitly or it quietly undercounts the room by one
 * to the only person reading it.
 *
 * "Only" appears when the overlap is small. On a community this size a rare
 * title is the more interesting outcome, not the lesser one, and the word is
 * what carries that — the sentence states the number and stops.
 */
function audienceLine(
  watchers: number,
  communityUsers: number,
  viewerHasSeen: boolean,
  otherRaters: number,
): string {
  if (watchers > 0) {
    if (viewerHasSeen) {
      return watchers === 1
        ? "You and one other person here have seen this."
        : `You and ${watchers} others here have seen this.`;
    }
    if (watchers === 1) return "One person here has seen this.";
    const rare = communityUsers > 0 && (watchers <= 3 || watchers / communityUsers <= 0.15);
    return rare
      ? `Only ${watchers} people here have seen this.`
      : `${watchers} people here have seen this.`;
  }

  // `title_audience` counts library entries, so a title someone rated without
  // ever adding arrives here with zero watchers and a histogram directly
  // beneath it. "Nobody here has watched this" printed above a bar chart is the
  // block arguing with itself.
  if (otherRaters > 0) {
    return otherRaters === 1
      ? "One person here has rated this."
      : `${otherRaters} people here have rated this.`;
  }
  return viewerHasSeen
    ? "You're the only one here who's watched this."
    : "Nobody here has watched this yet.";
}

/** "Watched · wrote about it" — what this person did, in the order they did it. */
function personLine(p: Person): string {
  const bits: string[] = [];
  if (p.status) bits.push(STATUS_LABEL[p.status]);
  else if (p.rated) bits.push("Rated it");
  if (p.hasNote) bits.push(bits.length ? "wrote about it" : "Wrote about it");
  return bits.join(" · ");
}

function Score({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="shrink-0 text-xs font-medium text-accent-gold tabular-nums">
      ★ {formatStars(value)}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-surface-500">
      {children}
    </p>
  );
}

export default function TheRoom({
  itemId,
  itemType,
}: {
  itemId: string | number;
  itemType: "movie" | "tv";
}) {
  const { data, error, isLoading } = useSWR<Room>(
    `/api/title-room?itemId=${encodeURIComponent(String(itemId))}&itemType=${itemType}`,
    swrFetcher,
  );

  // A request that failed is not an empty room, and the skeleton below would
  // otherwise pulse forever — which is the one thing that reads as broken.
  if (error) return null;

  if (isLoading || !data) {
    return (
      <div className="card-accent animate-pulse rounded-2xl p-5">
        <div className="mb-5 h-3 w-24 rounded bg-surface-800" />
        <div className="mb-5 h-3 w-44 rounded bg-surface-800" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-9 shrink-0 rounded-full bg-surface-800" />
              <div className="h-3 w-28 rounded bg-surface-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { audience, ratings, following, followingTotal, discover, viewerId, viewerScore } = data;
  const maxCount = Math.max(...ratings.distribution.map((d) => d.count), 1);
  const line = audienceLine(
    audience.watchers,
    audience.communityUsers,
    data.viewerHasSeen,
    ratings.total - (viewerScore !== null ? 1 : 0),
  );

  /**
   * Nothing at all. The card stays — same frame, same heading — and says the
   * one true thing. An empty state that vanishes is indistinguishable from a
   * broken one, and an empty state that asks the reader for something turns a
   * quiet fact into a chore.
   */
  const bare =
    audience.watchers === 0 &&
    following.length === 0 &&
    discover.length === 0 &&
    ratings.total === 0;

  return (
    <section className="card-accent animate-fade-up rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-6 w-1 shrink-0 rounded-full bg-brand-500" />
        <h3 className="text-sm font-semibold text-surface-100">Who&apos;s here</h3>
      </div>

      {bare ? (
        <div className="flex items-center gap-3 py-1">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-800/60">
            <Users className="size-4 text-surface-500" />
          </span>
          <p className="text-sm text-surface-400">{line}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {audience.sample.length > 0 && (
              <div className="flex -space-x-2">
                {audience.sample.slice(0, 4).map((m) => (
                  <Link
                    key={m.userId}
                    href={`/app/profile/${m.username}`}
                    title={`@${m.username}`}
                  >
                    <Avatar
                      src={m.avatarUrl}
                      name={m.username}
                      size="sm"
                      className="ring-2 ring-surface-900 transition-transform hover:scale-110"
                    />
                  </Link>
                ))}
              </div>
            )}
            <p className="text-sm text-surface-300">{line}</p>
          </div>

          {following.length > 0 && (
            <div className="mt-6">
              <Label>You follow</Label>
              <ul className="space-y-2.5">
                {following.map((p) => (
                  <li key={p.userId} className="flex items-center gap-3">
                    <Link href={`/app/profile/${p.username}`} className="shrink-0">
                      <Avatar src={p.avatarUrl} name={p.username} size={36} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/app/profile/${p.username}`}
                        className="block truncate text-sm font-medium text-surface-200 transition-colors hover:text-white"
                      >
                        {p.username}
                      </Link>
                      <p className="truncate text-[11px] text-surface-500">{personLine(p)}</p>
                    </div>
                    <Score value={p.score} />
                  </li>
                ))}
              </ul>
              {followingTotal > following.length && (
                <p className="mt-2.5 text-[11px] text-surface-500">
                  +{followingTotal - following.length} more
                </p>
              )}
            </div>
          )}

          {discover.length > 0 && (
            <div className="mt-6">
              {/* The heading has to earn a follow button sitting beside a name
                  the reader does not know, so it states the one thing they have
                  in common. That these are strangers is carried by the
                  structure — this list is what is left after "You follow" —
                  rather than by a label announcing it. */}
              <Label>Rated it highly</Label>
              <ul className="space-y-2.5">
                {discover.map((p) => (
                  <li key={p.userId} className="flex items-center gap-3">
                    <Link href={`/app/profile/${p.username}`} className="shrink-0">
                      <Avatar src={p.avatarUrl} name={p.username} size={36} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/app/profile/${p.username}`}
                        className="block truncate text-sm font-medium text-surface-200 transition-colors hover:text-white"
                      >
                        {p.username}
                      </Link>
                      <p className="truncate text-[11px] text-surface-500">
                        {p.score !== null && (
                          <span className="text-accent-gold">★ {formatStars(p.score)}</span>
                        )}
                        {p.hasNote && <span>{p.score !== null ? " · " : ""}wrote about it</span>}
                      </p>
                    </div>
                    <FollowButton
                      targetUserId={p.userId}
                      currentUserId={viewerId}
                      targetVisibility={p.visibility}
                      initialStatus={p.followState}
                      size="sm"
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ratings.total > 0 && (
            <div className="mt-6 border-t border-surface-800/60 pt-5">
              <div className="mb-2.5 flex items-baseline justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wider text-surface-500">
                  How it rates here
                </p>
                <p className="text-xs text-surface-500">
                  {/* Halved, not re-rounded: 7.4/10 is 3.7 stars. Snapping a
                      mean to the nearest half-star throws away precision that
                      an average legitimately has even though no single rating
                      does. */}
                  <span className="text-base font-bold text-accent-gold">
                    {(ratings.average / 2).toFixed(1)}
                  </span>{" "}
                  of 5
                </p>
              </div>

              <div className="flex h-14 items-end gap-[3px]">
                {ratings.distribution.map((d) => {
                  const mine = viewerScore === d.score;
                  return (
                    <div key={d.score} className="flex h-full flex-1 items-end">
                      <div
                        title={`${formatStars(d.score)}★ — ${d.count} ${d.count === 1 ? "rating" : "ratings"}`}
                        style={{ height: `${Math.max(4, (d.count / maxCount) * 100)}%` }}
                        className={`w-full rounded-t-sm transition-colors ${
                          // The reader's own bar is gold, the room's are green.
                          // Where you sit in the distribution is the one thing
                          // in this chart that is about you.
                          mine ? "bg-accent-gold" : "bg-brand-500/40 hover:bg-brand-500/70"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Ten bars, five labels. The buckets are half-stars because that
                  is what is stored; labelling all ten is unreadable at a
                  sidebar's width, so only the whole stars are marked. */}
              <div className="mt-1 flex gap-[3px]">
                {ratings.distribution.map((d) => (
                  <div
                    key={d.score}
                    className="flex-1 text-center text-[10px] font-medium text-surface-600"
                  >
                    {d.score % 2 === 0 ? d.score / 2 : ""}
                  </div>
                ))}
              </div>

              <p className="mt-2 text-[11px] text-surface-500">
                {ratings.total} rating{ratings.total !== 1 ? "s" : ""}
                {viewerScore !== null && (
                  <>
                    {" · "}
                    <span className="text-accent-gold">yours ★ {formatStars(viewerScore)}</span>
                  </>
                )}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
