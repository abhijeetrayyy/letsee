"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Eye, Star, MessageSquare } from "lucide-react";

type Friend = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  action: "watched" | "rated" | "reviewed";
  date: string;
  review: string | null;
};

export default function FriendsWhoWatched({
  itemId,
  itemType,
}: {
  itemId: string;
  itemType: string;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/friends-watched?itemId=${itemId}&itemType=${itemType}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setFriends(data.friends ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [itemId, itemType]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-10 h-10 rounded-full bg-surface-800 shrink-0" />
        ))}
        <div className="h-3 bg-surface-800 rounded w-24" />
      </div>
    );
  }

  if (friends.length === 0) return null;

  const actionIcon = (action: string) => {
    switch (action) {
      case "watched": return <Eye className="w-3 h-3" />;
      case "rated": return <Star className="w-3 h-3" />;
      case "reviewed": return <MessageSquare className="w-3 h-3" />;
      default: return null;
    }
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case "watched": return "Watched";
      case "rated": return "Rated";
      case "reviewed": return "Reviewed";
      default: return action;
    }
  };

  const maxDisplay = 6;

  return (
    <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 backdrop-blur-sm p-5">
      <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-brand-400" />
        Friends Who Engaged
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        {friends.slice(0, maxDisplay).map((f) => (
          <Link
            key={f.userId}
            href={`/app/profile/${f.username}`}
            className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-800/50 hover:bg-surface-700/60 border border-surface-700/30 hover:border-surface-600/50 transition-all"
          >
            <div className="relative shrink-0">
              <img
                src={
                  f.avatarUrl
                    ? (f.avatarUrl.startsWith("http") ? f.avatarUrl : f.avatarUrl)
                    : "/default-avatar.webp"
                }
                alt={f.username}
                className="w-7 h-7 rounded-full object-cover border border-surface-600"
              />
              <span className="absolute -bottom-0.5 -right-0.5 bg-surface-900 rounded-full p-0.5 leading-none">
                <span className="text-[10px] text-brand-400">{actionIcon(f.action)}</span>
              </span>
            </div>
            <span className="text-xs font-medium text-surface-300 group-hover:text-white transition-colors truncate max-w-[80px]">
              {f.username}
            </span>
            <span className="text-[10px] text-surface-500 hidden sm:inline">
              {actionLabel(f.action)}
            </span>
          </Link>
        ))}
        {friends.length > maxDisplay && (
          <span className="text-xs text-surface-500">
            +{friends.length - maxDisplay} more
          </span>
        )}
      </div>
    </div>
  );
}
