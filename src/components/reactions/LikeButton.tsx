"use client";

import { useEffect, useState, useCallback } from "react";
import { Heart } from "lucide-react";

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
  initialCount = 0,
  initialLiked = false,
  size = "sm",
  onToggle,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [initDone, setInitDone] = useState(false);

  // Fetch initial state on mount
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/reactions/toggle?targetType=${encodeURIComponent(targetType)}&targetId=${targetId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      // Silent fail
    } finally {
      setInitDone(true);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);

    // Optimistic update
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);

    try {
      const res = await fetch("/api/reactions/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });

      if (!res.ok) {
        // Revert on failure
        setLiked(prevLiked);
        setCount(prevCount);
        return;
      }

      const data = await res.json();
      setLiked(data.liked);
      setCount(data.count);
      onToggle?.(data.liked, data.count);
    } catch {
      // Revert on failure
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
