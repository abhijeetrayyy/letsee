"use client";

import Link from "next/link";

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

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function getActivityLabel(type: string): string {
  switch (type) {
    case "watched": return "Watched";
    case "rated": return "Rated";
    case "reviewed": return "Reviewed";
    case "list_created": return "Created List";
    case "favored": return "Favorited";
    default: return type;
  }
}

function getPosterUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl?.trim()) return null;
  const u = imageUrl.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const path = u.startsWith("/") ? u.slice(1) : u;
  return `https://image.tmdb.org/t/p/w154/${path}`;
}

function getAvatarUrl(avatarUrl: string | null | undefined): string {
  if (!avatarUrl?.trim()) return "/default-avatar.webp";
  const u = avatarUrl.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return u;
}

export default function ActivityCard({ item }: { item: ActivityItem }) {
  const posterUrl = getPosterUrl(item.image_url);
  const avatarUrl = getAvatarUrl(item.avatar_url);
  const detailHref = item.item_id && item.item_type
    ? `/app/${item.item_type}/${item.item_id}`
    : null;
  const profileHref = `/app/profile/${item.username}`;

  const badgeColors: Record<string, string> = {
    watched: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    rated: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    reviewed: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    list_created: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    favored: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  };

  return (
    <div className="flex gap-3 p-4 rounded-xl border border-surface-700/50 bg-surface-900/30 hover:bg-surface-900/50 hover:border-surface-600/60 transition-all duration-200">
      {/* Avatar */}
      <Link href={profileHref} className="shrink-0">
        <img
          src={avatarUrl}
          alt={item.username}
          className="w-10 h-10 rounded-full object-cover border-2 border-surface-700 hover:border-brand-400/50 transition-colors"
        />
      </Link>

      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Header: username + badge + timestamp */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={profileHref}
            className="text-sm font-semibold text-surface-100 hover:text-brand-400 transition-colors truncate max-w-[140px]"
          >
            {item.username}
          </Link>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badgeColors[item.activity_type] ?? "bg-surface-700/50 text-surface-300"}`}
          >
            {getActivityLabel(item.activity_type)}
          </span>
          <span className="text-[11px] text-surface-500 ml-auto shrink-0">
            {formatDate(item.created_at)}
          </span>
        </div>

        {/* Content row */}
        <div className="flex gap-3">
          {/* Poster */}
          {posterUrl && detailHref && (
            <Link href={detailHref} className="shrink-0">
              <img
                src={posterUrl}
                alt={item.item_name ?? ""}
                className="w-12 aspect-[2/3] rounded-md object-cover shadow-md hover:scale-105 transition-transform duration-200"
              />
            </Link>
          )}

          <div className="flex-1 min-w-0">
            {/* Item name or list name */}
            {item.item_name && detailHref && (
              <Link
                href={detailHref}
                className="text-sm font-medium text-surface-200 hover:text-brand-400 transition-colors line-clamp-1"
              >
                {item.item_name}
              </Link>
            )}
            {item.list_name && (
              <p className="text-sm font-medium text-surface-200 line-clamp-1">
                {item.list_name}
              </p>
            )}

            {/* Rating stars */}
            {item.score != null && (
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-xs text-surface-400">Score:</span>
                <div className="flex">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      className={`text-xs ${
                        i < item.score! ? "text-accent-gold" : "text-surface-700"
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-xs text-surface-400 ml-1">{item.score}/10</span>
              </div>
            )}

            {/* Review text snippet */}
            {item.review_text && (
              <p className="text-xs text-surface-400 line-clamp-2 mt-1.5 italic leading-relaxed">
                &ldquo;{item.review_text}&rdquo;
              </p>
            )}

            {/* No poster fallback for rated/list_created */}
            {!posterUrl && !item.review_text && (
              <p className="text-xs text-surface-500 mt-1">
                {item.activity_type === "rated" && "Rated an item"}
                {item.activity_type === "list_created" && "Created a new list"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
