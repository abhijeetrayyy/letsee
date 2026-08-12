"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { followUser } from "@/utils/followerAction";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export type FollowStatus = "following" | "pending" | "follow";

export type FollowButtonProps = {
  targetUserId: string;
  /** Null when signed out — the button becomes a link to /login. */
  currentUserId: string | null;
  /** Target profile's visibility; "public" follows connect instantly, others queue a request. */
  targetVisibility?: string;
  /**
   * Known status from the caller (e.g. `isFollowing` off a list API). When
   * omitted the component resolves it itself on mount.
   */
  initialStatus?: FollowStatus;
  /** Subscribe to follow-request changes. Only worth it on a profile page — a
   *  grid of cards would open one channel per card. */
  watchRequests?: boolean;
  size?: "sm" | "md";
  className?: string;
  onStatusChange?: (status: FollowStatus) => void;
};

const LABEL: Record<FollowStatus, string> = {
  following: "Following",
  pending: "Requested",
  follow: "Follow",
};

/**
 * The single follow control for the whole app. Renders nothing for your own
 * profile, and links signed-out visitors to /login rather than blocking them
 * behind a modal.
 */
export default function FollowButton({
  targetUserId,
  currentUserId,
  targetVisibility = "public",
  initialStatus,
  watchRequests = false,
  size = "md",
  className = "",
  onStatusChange,
}: FollowButtonProps) {
  const [status, setStatus] = useState<FollowStatus>(initialStatus ?? "follow");
  const [isLoading, setIsLoading] = useState(false);
  const [hovering, setHovering] = useState(false);

  const isSelf = !!currentUserId && currentUserId === targetUserId;

  const sizeClass =
    size === "sm"
      ? "px-3 py-1.5 text-xs gap-1.5"
      : "px-4 py-2 text-sm gap-2";

  const resolveStatus = useCallback(async () => {
    if (!currentUserId || isSelf) return;
    try {
      const { data: connection } = await supabase
        .from("user_connections")
        .select("id")
        .eq("follower_id", currentUserId)
        .eq("followed_id", targetUserId)
        .limit(1);

      if (connection?.length) {
        setStatus("following");
        return;
      }

      const { data: request } = await supabase
        .from("user_follow_requests")
        .select("id")
        .eq("sender_id", currentUserId)
        .eq("receiver_id", targetUserId)
        .eq("status", "pending")
        .limit(1);

      setStatus(request?.length ? "pending" : "follow");
    } catch (error) {
      console.error("FollowButton: failed to resolve status", error);
    }
  }, [currentUserId, targetUserId, isSelf]);

  useEffect(() => {
    // Only self-resolve when the caller didn't already tell us the status.
    if (initialStatus === undefined) void resolveStatus();
  }, [initialStatus, resolveStatus]);

  useEffect(() => {
    if (!watchRequests || !currentUserId || isSelf) return;
    const channel = supabase
      .channel(`follow-requests-${targetUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_follow_requests" },
        () => void resolveStatus(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [watchRequests, currentUserId, targetUserId, isSelf, resolveStatus]);

  const apply = (next: FollowStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  };

  const handleClick = async () => {
    if (isLoading || !currentUserId) return;
    setIsLoading(true);
    try {
      if (status === "following") {
        await supabase
          .from("user_connections")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("followed_id", targetUserId);
        apply("follow");
      } else if (status === "pending") {
        await supabase
          .from("user_follow_requests")
          .delete()
          .eq("sender_id", currentUserId)
          .eq("receiver_id", targetUserId);
        apply("follow");
      } else {
        const { error, instant } = await followUser(
          currentUserId,
          targetUserId,
          targetVisibility,
        );
        if (error) {
          console.error("FollowButton: follow failed", error);
        } else {
          apply(instant ? "following" : "pending");
        }
      }
    } catch (error) {
      console.error("FollowButton: action failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSelf) return null;

  const base = `inline-flex items-center justify-center rounded-full font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation ${sizeClass}`;

  // Signed out: send them to log in rather than dead-ending in a modal.
  if (!currentUserId) {
    return (
      <Link
        href="/login"
        className={`${base} bg-brand-500 text-surface-950 hover:bg-brand-400 ${className}`}
      >
        Follow
      </Link>
    );
  }

  const tone =
    status === "following"
      ? hovering
        ? "bg-red-500/10 text-red-300 border border-red-500/30"
        : "bg-surface-800 text-surface-300 border border-surface-700"
      : status === "pending"
        ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
        : "bg-brand-500 text-surface-950 hover:bg-brand-400";

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      disabled={isLoading}
      aria-busy={isLoading}
      className={`${base} ${tone} ${className}`}
    >
      {isLoading ? (
        <>
          <LoadingSpinner size="sm" className="border-t-current shrink-0" />
          <span>…</span>
        </>
      ) : status === "following" && hovering ? (
        "Unfollow"
      ) : (
        LABEL[status]
      )}
    </button>
  );
}
