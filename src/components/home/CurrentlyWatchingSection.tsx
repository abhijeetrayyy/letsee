"use client";

import React, { useEffect, useState, useContext } from "react";
import Link from "next/link";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";

interface WatchingItem {
  item_id: string;
  item_name: string;
  item_type: string;
  image_url: string | null;
  started_at: string;
}

export default function CurrentlyWatchingSection() {
  const { user, userPrefrence } = useContext(UserPrefrenceContext);
  const watchingIds = userPrefrence.watching;
  const [items, setItems] = useState<WatchingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || watchingIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/currently-watching", { cache: "no-store" })
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
  }, [user, watchingIds.length]);

  if (loading || items.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-neutral-700/60 bg-neutral-800/50 px-4 sm:px-6 py-8 sm:py-10"
      aria-labelledby="currently-watching-heading"
    >
      <h2
        id="currently-watching-heading"
        className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2"
      >
        Currently watching
      </h2>
      <p className="text-sm sm:text-base text-neutral-400 mb-6">
        What you&apos;re watching right now
      </p>
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
              className="shrink-0 w-36 sm:w-40 flex flex-col rounded-xl overflow-hidden border border-neutral-700 bg-neutral-800/80 hover:border-neutral-600 hover:bg-neutral-800 transition-colors"
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
    </section>
  );
}
