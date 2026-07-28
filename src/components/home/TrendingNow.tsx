"use client";

import MediaCard from "@components/cards/MediaCard";

interface Item {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string | null;
  vote_average?: number;
}

export default function TrendingNow({ items }: { items: Item[]; trendingTv: Item[] }) {
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
        const mediaType = (item.media_type === "tv" ? "tv" : "movie") as "movie" | "tv";

        return (
          <div key={item.id} className="relative">
            <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-white">
              {i + 1}
            </div>
            <MediaCard
              id={item.id}
              title={title}
              mediaType={mediaType}
              posterPath={item.poster_path ?? undefined}
              rating={item.vote_average ?? undefined}
              showActions
            />
          </div>
        );
      })}
    </div>
  );
}
