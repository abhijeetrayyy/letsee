"use client";

import { useEffect, useState, useCallback } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchReactionState, toggleReaction } from "@/lib/db/reactions";

type LikeButtonProps = {
  targetType: string;
  targetId: number;
  initialCount?: number;
  initialLiked?: boolean;
  size?: "sm" | "md";
  onToggle?: (liked: boolean, count: number) => void;
};

export default function LikeButton({
  targetType,
  targetId,
  initialCount: initialCountProp,
  initialLiked: initialLikedProp,
  size = "sm",
  onToggle,
}: LikeButtonProps) {
  const hasInitialState = initialCountProp !== undefined || initialLikedProp !== undefined;
  const [liked, setLiked] = useState(initialLikedProp ?? false);
  const [count, setCount] = useState(initialCountProp ?? 0);
  const [loading, setLoading] = useState(false);
  const [initDone, setInitDone] = useState(hasInitialState);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  /**
   * Read on mount — skipped entirely when the caller already provided
   * `initialCount`/`initialLiked` (the comment thread batches them alongside
   * its own query), so a page rendering many of these does not fire one read
   * per button.
   *
   * Both this and the toggle below went through `/api/reactions/toggle`. A like
   * is the cheapest possible write and it was costing a function invocation;
   * `reactions_select_all` and the two `_self` policies make it something the
   * viewer's own token can do.
   */
  const fetchState = useCallback(async () => {
    try {
      const state = await fetchReactionState(userId, targetType, targetId);
      setLiked(state.liked);
      setCount(state.count);
    } catch {
      // A like count that fails to load is not worth an error state.
    } finally {
      setInitDone(true);
    }
  }, [targetType, targetId, userId]);

  useEffect(() => {
    if (hasInitialState) return;
    fetchState();
  }, [fetchState, hasInitialState]);

  const toggle = async () => {
    if (loading || !userId) return;
    setLoading(true);

    // Optimistic update
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);

    try {
      const result = await toggleReaction(userId, targetType, targetId);
      setLiked(result.liked);
      setCount(result.count);
      onToggle?.(result.liked, result.count);
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  const sizeClass = size === "sm" ? "text-xs gap-1" : "text-sm gap-1.5";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const padding = size === "sm" ? "px-2 py-1" : "px-3 py-1.5";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading || !initDone}
      className={`inline-flex items-center ${sizeClass} ${padding} rounded-lg transition-all duration-200 ${
        liked
          ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
          : "text-surface-400 hover:text-surface-200 hover:bg-surface-800/50"
      } disabled:opacity-50`}
    >
      <Heart
        className={`${iconSize} transition-all duration-200 ${
          liked ? "fill-red-400 scale-110" : ""
        }`}
      />
      {count > 0 && <span className="font-medium tabular-nums">{count}</span>}
    </button>
  );
}
