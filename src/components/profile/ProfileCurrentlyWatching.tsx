"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface WatchingItem {
  item_id: string;
  item_name: string;
  item_type: string;
  image_url: string | null;
  started_at: string;
}

interface Props {
  userId: string;
  /** Filter to anime (Animation genre) only */
  animeOnly?: boolean;
  /** Filter to TV or movies only (for anime sections) */
  itemType?: "tv" | "movie";
}

export default function ProfileCurrentlyWatching({
  userId,
  animeOnly = false,
  itemType,
}: Props) {
  const [items, setItems] = useState<WatchingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ userId });
    if (animeOnly) params.set("anime", "1");
    if (itemType) params.set("itemType", itemType);
    fetch(`/api/currently-watching?${params.toString()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.items?.length) setItems(data.items);
        else if (!cancelled) setItems([]);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, animeOnly, itemType]);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="shrink-0 w-32 sm:w-36 animate-pulse">
            <div className="aspect-2/3 rounded-lg bg-neutral-700/50" />
            <div className="mt-2 h-3 w-3/4 rounded bg-neutral-700/50" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-500 py-4">
        {animeOnly && itemType
          ? `No anime ${itemType === "tv" ? "series" : "movies"} in progress.`
          : "Not watching anything right now."}
      </p>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
      {items.map((item) => {
        const posterUrl =
          item.image_url && item.image_url.length > 1
            ? `https://image.tmdb.org/t/p/w185${item.image_url}`
            : "/no-photo.webp";
        const href =
          item.item_type === "tv"
            ? `/app/tv/${item.item_id}`
            : `/app/movie/${item.item_id}`;
        return (
          <Link
            key={item.item_id}
            href={href}
            className="shrink-0 w-32 sm:w-36 flex flex-col rounded-xl overflow-hidden border border-neutral-700 bg-neutral-800/80 hover:border-neutral-600 hover:bg-neutral-800 transition-colors"
          >
            <div className="relative aspect-2/3 w-full overflow-hidden">
              <img
                src={posterUrl}
                alt={item.item_name ?? ""}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-neutral-900 text-[10px] font-semibold uppercase tracking-wide">
                  {item.item_type === "tv" ? "TV" : "Movie"}
                </span>
              </div>
            </div>
            <div className="p-2 min-h-0">
              <p className="text-sm font-medium text-neutral-100 line-clamp-2">
                {item.item_name}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
