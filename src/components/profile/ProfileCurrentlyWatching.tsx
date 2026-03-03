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
  const [progressMap, setProgressMap] = useState<Record<string, string>>({});

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
      .then(async (data) => {
        if (cancelled) return;
        if (data?.items?.length) {
          setItems(data.items);

          // Fetch progress for each TV show
          const tvItems = data.items.filter((it: any) => it.item_type === "tv");
          const pMap: Record<string, string> = {};
          await Promise.all(
            tvItems.map(async (it: any) => {
              try {
                const pr = await fetch(`/api/tv-progress?showId=${it.item_id}`);
                const pd = await pr.json();
                if (pd && pd.next_season && pd.next_episode) {
                  // Show current/last watched or next?
                  // Let's show "Up to S1 E5" or similar. Actually next up is better.
                  // But often "Currently Watching" implies where you ARE.
                  // Let's use "S1 E5" as the next one to watch.
                  pMap[it.item_id] =
                    `Next: S${pd.next_season} E${pd.next_episode}`;
                } else if (pd && pd.all_complete) {
                  pMap[it.item_id] = "Completed";
                }
              } catch {}
            }),
          );
          if (!cancelled) setProgressMap(pMap);
        } else {
          setItems([]);
        }
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
    <div className="flex gap-4 overflow-x-auto pb-4 pretty-scrollbar">
      {items.map((item) => {
        const posterUrl =
          item.image_url && item.image_url.length > 1
            ? `https://image.tmdb.org/t/p/w185${item.image_url}`
            : "/no-photo.webp";
        const href =
          item.item_type === "tv"
            ? `/app/tv/${item.item_id}`
            : `/app/movie/${item.item_id}`;

        const progressText =
          item.item_type === "tv" ? progressMap[item.item_id] : null;

        return (
          <Link
            key={item.item_id}
            href={href}
            className="shrink-0 w-32 sm:w-36 flex flex-col rounded-xl overflow-hidden border border-neutral-700 bg-neutral-800/80 hover:border-neutral-600 hover:bg-neutral-800 transition-colors group"
          >
            <div className="relative aspect-2/3 w-full overflow-hidden">
              <img
                src={posterUrl}
                alt={item.item_name ?? ""}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-2 left-2">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-neutral-900 text-[10px] font-semibold uppercase tracking-wide">
                  {item.item_type === "tv" ? "TV" : "Movie"}
                </span>
              </div>
              {progressText && (
                <div className="absolute bottom-0 left-0 right-0 bg-neutral-900/80 backdrop-blur-sm px-2 py-1">
                  <p className="text-[10px] font-medium text-amber-400 truncate">
                    {progressText}
                  </p>
                </div>
              )}
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
