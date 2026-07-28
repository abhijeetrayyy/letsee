"use client";

import { useEffect, useState } from "react";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import Link from "next/link";
import { Play, ChevronRight, Tv } from "lucide-react";

interface ContinueWatchingItem {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  next_season: number | null;
  next_episode: number | null;
  episodes_watched: number;
  total_episodes: number;
  tv_status: string | null;
  is_caught_up: boolean;
  last_air_date: string | null;
  next_air_date: string | null;
}

export default function ContinueWatchingProgress() {
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useMediaInteraction();

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetch("/api/continue-watching", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="shrink-0 w-44 animate-pulse">
            <div className="aspect-[2/3] rounded-xl bg-neutral-800" />
            <div className="mt-2 h-3 bg-neutral-800 rounded w-3/4" />
            <div className="mt-1 h-2 bg-neutral-800 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
        <h2 className="text-xl font-bold text-white tracking-tight">Continue Watching</h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 scrollbar-thin">
        {items.slice(0, 8).map((item) => (
          <Link
            key={item.show_id}
            href={`/app/tv/${item.show_id}`}
            className="shrink-0 w-44 group relative"
          >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-800">
              {item.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                  alt={item.show_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Tv className="size-10 text-neutral-600" />
                </div>
              )}

              {/* Progress bar at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-700">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((item.episodes_watched / Math.max(1, item.total_episodes)) * 100))}%`,
                  }}
                />
              </div>

              {/* Next episode badge */}
              {item.next_season != null && item.next_episode != null && (
                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-medium text-white flex items-center gap-1">
                  <Play className="size-3 fill-white" />
                  S{item.next_season}E{item.next_episode}
                </div>
              )}

              {item.is_caught_up && (
                <div className="absolute top-2 right-2 bg-amber-500/80 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-medium text-white">
                  Caught up
                </div>
              )}
            </div>

            <h3 className="mt-2 text-sm font-medium text-white truncate">{item.show_name}</h3>
            <p className="text-xs text-neutral-400">
              {item.episodes_watched}/{item.total_episodes} episodes
              {item.is_caught_up && item.next_air_date && (
                <span className="text-amber-400 ml-1">
                  · {new Date(item.next_air_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </p>
          </Link>
        ))}

        {items.length > 8 && (
          <Link
            href="/app/profile"
            className="shrink-0 w-44 flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-700 hover:border-brand-500/50 transition-colors group"
          >
            <div className="text-center">
              <ChevronRight className="size-8 text-neutral-500 group-hover:text-brand-400 mx-auto transition-colors" />
              <p className="mt-2 text-sm text-neutral-400 group-hover:text-brand-400">View all</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
