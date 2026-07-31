"use client";

import { useEffect, useRef } from "react";
import useSWRInfinite from "swr/infinite";
import ActivityCard from "./ActivityCard";
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
  items: ActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
  followedCount: number;
  isSupplemented: boolean;
};

async function feedFetcher(url: string): Promise<FeedResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new SwrFetchError(body.error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json();
}

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
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<FeedResponse>(getKey, feedFetcher);

  const items = data ? data.flatMap((p) => p.items) : [];
  const hasMore = data ? data[data.length - 1].hasMore : true;
  const followedCount = data?.[0]?.followedCount ?? 0;
  const isSupplemented = data?.[0]?.isSupplemented ?? false;
  const loading = isLoading;
  const loadingMore = isValidating && size > 1;

  const handleRefresh = async () => {
    try {
      const fresh = await feedFetcher(getKey(0, null)!);
      mutate([fresh], { revalidate: false });
      setSize(1);
    } catch {
      mutate();
    }
  };

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setSize((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, setSize]);

  if (error) {
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
    <div className="space-y-4">
      {/* Status bar */}
      {!loading && items.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <Users className="w-3.5 h-3.5" />
          {followedCount > 0 ? (
            <span>
              From {followedCount} {followedCount === 1 ? "person" : "people"} you follow
            </span>
          ) : (
            <span>Trending activity from the community</span>
          )}
          {isSupplemented && followedCount > 0 && followedCount < 3 && (
            <span className="text-surface-600">
              · supplemented with popular users
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

      {/* Activity list */}
      {items.length > 0 ? (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <ActivityCard key={`${item.activity_type}-${item.id}`} item={item} />
            ))}
          </div>

          {/* Infinite scroll trigger */}
          <div ref={loaderRef} className="py-4 flex justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-surface-500 text-xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Loading more...
              </div>
            )}
            {!hasMore && items.length > 10 && (
              <p className="text-xs text-surface-600">You&apos;re all caught up!</p>
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
