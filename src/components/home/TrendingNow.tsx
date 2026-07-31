"use client";

import MediaCard from "@components/cards/MediaCard";
import { GenreList } from "@/staticData/genreList";

interface Item {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string | null;
  vote_average?: number;
  adult?: boolean;
  genre_ids?: number[];
}

function genreNames(ids?: number[]): string[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => GenreList.genres.find((g) => g.id === id)?.name)
    .filter((name): name is string => Boolean(name));
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
      {topItems.map((item, i) => (
        <MediaCard
          key={item.id}
          id={item.id}
          title={item.title ?? item.name ?? "Untitled"}
          mediaType={item.media_type === "tv" ? "tv" : "movie"}
          posterPath={item.poster_path}
          adult={item.adult}
          genres={genreNames(item.genre_ids)}
          rating={item.vote_average}
          rank={i + 1}
        />
      ))}
    </div>
  );
}
