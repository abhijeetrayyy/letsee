"use client";

import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { useInView } from "@/hooks/useInView";
import FeedRow, { type FeedRowData } from "./FeedRow";
import { Users, RefreshCw, AlertCircle } from "lucide-react";
import { SwrFetchError } from "@/utils/swrFetcher";

type ActivityItem = {
  id: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  activity_type: "watched" | "rated" | "reviewed" | "list_created" | "favored";
  item_id: string | null;
  item_type: string | null;
  item_name: string | null;
  image_url: string | null;
  score: number | null;
  review_text: string | null;
  list_name: string | null;
  created_at: string;
  source_type: "review" | "rating" | "list" | null;
  source_id: number | null;
};

type FeedResponse = {
  items: FeedRowData[];
  nextCursor: string | null;
  hasMore: boolean;
  followedCount: number;
  isSupplemented: boolean;
  isSignedIn: boolean;
};

async function feedFetcher(url: string): Promise<FeedResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new SwrFetchError(body.error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json();
}

/** Shown before the reader asks for more. */
const INITIAL_VISIBLE = 4;
/** How many more each press of the button reveals. */
const REVEAL_STEP = 10;

function getKey(pageIndex: number, previousPageData: FeedResponse | null) {
  if (previousPageData && !previousPageData.hasMore) return null;
  const params = new URLSearchParams();
  params.set("limit", "20");
  if (pageIndex > 0 && previousPageData?.nextCursor) {
    params.set("cursor", previousPageData.nextCursor);
  }
  return `/api/feed/following?${params}`;
}

export default function FollowingFeed() {
  /**
   * Deferred until scrolled to.
   *
   * `/api/feed/following` is the heaviest route in the app — it walks everyone
   * the viewer follows, merges four kinds of activity and enriches the result
   * from TMDB — and it ran on every load of the signed-in home page, above a
   * fold most sessions never cross. It is also the one place where waiting a
   * beat is invisible: the reader is scrolling towards it when it starts.
   */
  const { ref, inView } = useInView<HTMLDivElement>();

  // How many the reader has asked to see. Grows only on an explicit press —
  // the feed used to keep loading itself as you scrolled past it, which made
  // the home page never end on mobile.
  const [visible, setVisible] = useState(INITIAL_VISIBLE);

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<FeedResponse>(
      (index, prev) => (inView ? getKey(index, prev) : null),
      feedFetcher,
      {
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        keepPreviousData: true,
      },
    );

  const items = data ? data.flatMap((p) => p.items) : [];
  const hasMore = data ? (data[data.length - 1]?.hasMore ?? false) : true;
  const followedCount = data?.[0]?.followedCount ?? 0;
  const isSupplemented = data?.[0]?.isSupplemented ?? false;
  const isSignedIn = data?.[0]?.isSignedIn ?? false;
  const loading = !inView || isLoading;
  const loadingMore = isValidating && size > 1;
  const hasStaleData = items.length > 0;

  const handleRefresh = async () => {
    try {
      const fresh = await feedFetcher(getKey(0, null)!);
      mutate([fresh], { revalidate: false });
      setSize(1);
    } catch {
      mutate();
    }
  };

  const shown = items.slice(0, visible);
  // More to reveal from what's already fetched, or another page to fetch.
  const canReveal = visible < items.length || hasMore;

  const revealMore = () => {
    const next = visible + REVEAL_STEP;
    setVisible(next);
    // Only fetch another page once the reader has nearly exhausted this one.
    if (next >= items.length && hasMore && !loadingMore) {
      setSize((prev) => prev + 1);
    }
  };

  // Full error only when there's no data at all
  if (error && !hasStaleData) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-300">Could not load feed</p>
        <button
          onClick={() => mutate()}
          className="mt-3 text-xs text-red-400 hover:text-red-300 underline transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-4">
      {/* Status bar */}
      {!loading && items.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <Users className="w-3.5 h-3.5" />
          {followedCount > 0 ? (
            <span>
              From {followedCount} {followedCount === 1 ? "person" : "people"} you follow
            </span>
          ) : (
            // Before you follow anyone the feed is your own history plus
            // whoever has been active lately, so don't call it the community's.
            // And a signed-out visitor has no history at all — telling them
            // they are looking at "your activity" is simply false.
            <span>{isSignedIn ? "Your activity, and people active lately" : "From across LetSee"}</span>
          )}
          {isSupplemented && followedCount > 0 && followedCount < 3 && (
            <span className="text-surface-600">
              · plus people active recently
            </span>
          )}
          <button
            onClick={handleRefresh}
            className="btn-ghost ml-auto"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      {/* Stale-data warning banner */}
      {error && hasStaleData && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 flex items-center gap-2 text-xs">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-amber-300">Couldn&apos;t refresh — showing last loaded data.</span>
          <button
            onClick={() => mutate()}
            className="ml-auto text-amber-400 hover:text-amber-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Activity list */}
      {items.length > 0 ? (
        <>
          <div className="space-y-3">
            {shown.map((row) => (
              <FeedRow key={row.key} row={row} />
            ))}
          </div>

          <div className="py-4 flex justify-center">
            {canReveal ? (
              <button
                type="button"
                onClick={revealMore}
                disabled={loadingMore}
                className="px-4 py-2.5 rounded-xl bg-surface-800 text-surface-200 text-sm font-medium border border-surface-700/50 hover:bg-surface-700 disabled:opacity-60 transition-colors"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Loading…
                  </span>
                ) : (
                  `Show ${REVEAL_STEP} more`
                )}
              </button>
            ) : (
              items.length > INITIAL_VISIBLE && (
                <p className="text-xs text-surface-600">You&apos;re all caught up!</p>
              )
            )}
          </div>
        </>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-3 p-4 rounded-xl border border-surface-700/50 bg-surface-900/30 animate-pulse"
            >
              <div className="w-10 h-10 rounded-full bg-surface-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-surface-800 rounded w-24" />
                <div className="h-4 bg-surface-800 rounded w-40" />
                <div className="h-3 bg-surface-800 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-surface-700/50 bg-surface-900/30 p-8 text-center">
          <Users className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">
            No activity to show yet.
          </p>
          <p className="text-surface-600 text-xs mt-1">
            Follow people to see what they&apos;re watching and reviewing.
          </p>
        </div>
      )}
    </div>
  );
}
