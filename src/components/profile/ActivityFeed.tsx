"use client";

import Link from "next/link";
import { useState } from "react";

type ActivityItem = {
  id: number;
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  watched_at: string;
  review_text?: string | null;
  score?: number | null;
  activity_type: "watched" | "rated" | "reviewed" | "list_created";
  list_name?: string;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function getPosterUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl?.trim()) return "/no-photo.webp";
  const u = imageUrl.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const path = u.startsWith("/") ? u.slice(1) : u;
  return `https://image.tmdb.org/t/p/w92/${path}`;
}

export default function ActivityFeed({
  items,
}: {
  items: ActivityItem[];
}) {
  if (!items?.length) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/50 p-12 text-center">
        <div className="text-4xl mb-4">🎬</div>
        <p className="text-surface-400 text-sm">
          No recent activity yet. Watched titles and ratings will show here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ActivityCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function ActivityCard({ item }: { item: ActivityItem }) {
  const posterUrl = getPosterUrl(item.image_url);
  const href = `/app/${item.item_type}/${item.item_id}`;

  return (
    <div className="flex gap-4 p-4 rounded-xl border border-surface-700/60 bg-surface-900/40 hover:border-surface-500/60 transition-all duration-300">
      {/* Poster */}
      <Link href={href} className="shrink-0 w-16 aspect-[2/3] rounded-lg overflow-hidden">
        <img
          src={posterUrl}
          alt={item.item_name}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              href={href}
              className="text-sm font-semibold text-surface-100 hover:text-brand-400 transition-colors line-clamp-1"
            >
              {item.item_name}
            </Link>
            <p className="text-xs text-surface-500 mt-0.5">
              {item.item_type === "tv" ? "TV Series" : "Movie"} · {formatDate(item.watched_at)}
            </p>
          </div>

          {/* Activity Badge */}
          <span className="shrink-0 px-2 py-1 rounded-md bg-surface-800 text-xs font-medium text-surface-300">
            {item.activity_type === "watched" && "Watched"}
            {item.activity_type === "rated" && "Rated"}
            {item.activity_type === "reviewed" && "Reviewed"}
            {item.activity_type === "list_created" && "List"}
          </span>
        </div>

        {/* Rating */}
        {item.score != null && (
          <div className="flex items-center gap-1 mt-2">
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
            <span className="text-xs text-surface-400 ml-1">
              {item.score}/10
            </span>
          </div>
        )}

        {/* Review Snippet */}
        {item.review_text && (
          <p className="text-sm text-surface-300 line-clamp-2 mt-2">
            {item.review_text}
          </p>
        )}
      </div>
    </div>
  );
}
