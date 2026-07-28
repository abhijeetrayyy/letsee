"use client";

import Link from "next/link";
import { Film, Tv } from "lucide-react";

interface Item {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string | null;
  vote_average?: number;
}

export default function TrendingNow({ items, trendingTv }: { items: Item[]; trendingTv: Item[] }) {
  const topItems = items.filter((i) => i.media_type !== "person").slice(0, 8);

  if (!topItems.length) {
    return (
      <div className="rounded-xl bg-surface-900/30 border border-surface-800/30 p-8 text-center">
        <p className="text-surface-500 text-sm">Loading trending content...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {topItems.map((item, i) => {
        const title = item.title ?? item.name ?? "Untitled";
        const mediaType = item.media_type === "tv" ? "tv" : "movie";
        const poster = item.poster_path
          ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
          : null;

        return (
          <Link
            key={item.id}
            href={`/app/${mediaType}/${item.id}`}
            className="group relative rounded-xl overflow-hidden bg-surface-900/50 border border-surface-800/30 hover:border-brand-500/20 transition-all hover:-translate-y-1"
          >
            <div className="aspect-[2/3] relative bg-surface-800">
              {poster ? (
                <img
                  src={poster}
                  alt={title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {mediaType === "tv" ? <Tv className="size-8 text-surface-600" /> : <Film className="size-8 text-surface-600" />}
                </div>
              )}

              {/* Rank badge */}
              <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-white">
                {i + 1}
              </div>

              {/* Rating */}
              {item.vote_average != null && (
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-accent-gold">
                  ★ {item.vote_average.toFixed(1)}
                </div>
              )}
            </div>

            <div className="p-2.5">
              <p className="text-xs font-medium text-surface-200 line-clamp-1 group-hover:text-white transition-colors">
                {title}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
