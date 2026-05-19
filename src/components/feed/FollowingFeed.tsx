"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ActivityCard from "./ActivityCard";
import { Users, RefreshCw, AlertCircle } from "lucide-react";

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
};

type FeedResponse = {
  items: ActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
  followedCount: number;
  isSupplemented: boolean;
};

export default function FollowingFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followedCount, setFollowedCount] = useState(0);
  const [isSupplemented, setIsSupplemented] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const fetchFeed = useCallback(async (cursorVal: string | null) => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (cursorVal) params.set("cursor", cursorVal);

      const res = await fetch(`/api/feed/following?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data: FeedResponse = await res.json();

      if (cursorVal) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setFollowedCount(data.followedCount);
      setIsSupplemented(data.isSupplemented);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchFeed(null);
  }, [fetchFeed]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setLoading(true);
          fetchFeed(cursor);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, cursor, fetchFeed]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-300">Could not load feed</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchFeed(null);
          }}
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
            onClick={() => {
              setLoading(true);
              setCursor(null);
              setHasMore(true);
              fetchFeed(null);
            }}
            className="ml-auto text-surface-500 hover:text-surface-300 transition-colors"
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
            {loading && (
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
