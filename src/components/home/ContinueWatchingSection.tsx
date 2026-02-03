"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface ContinueItem {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  next_season: number;
  next_episode: number;
  episodes_watched: number;
}

export default function ContinueWatchingSection() {
  const [items, setItems] = useState<ContinueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/continue-watching", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.items?.length) setItems(data.items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-neutral-700/60 bg-neutral-800/50 px-4 sm:px-6 py-8 sm:py-10"
      aria-labelledby="continue-watching-heading"
    >
      <h2
        id="continue-watching-heading"
        className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2"
      >
        Continue watching
      </h2>
      <p className="text-sm sm:text-base text-neutral-400 mb-6">
        Pick up where you left off
      </p>
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {items.map((item) => {
          const posterUrl = item.poster_path
            ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
            : "/no-photo.webp";
          const nextUrl = `/app/tv/${item.show_id}/season/${item.next_season}/episode/${item.next_episode}`;
          return (
            <Link
              key={item.show_id}
              href={nextUrl}
              className="shrink-0 w-36 sm:w-40 flex flex-col rounded-xl overflow-hidden border border-neutral-700 bg-neutral-800/80 hover:border-neutral-600 hover:bg-neutral-800 transition-colors"
            >
              <div className="relative aspect-2/3 w-full overflow-hidden">
                <img
                  src={posterUrl}
                  alt={item.show_name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 to-transparent px-2 py-2">
                  <span className="text-xs font-semibold text-white">
                    S{item.next_season} E{item.next_episode}
                  </span>
                </div>
              </div>
              <div className="p-2 min-h-0">
                <p className="text-sm font-medium text-neutral-100 line-clamp-2">
                  {item.show_name}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {item.episodes_watched} episode{item.episodes_watched !== 1 ? "s" : ""} watched
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
