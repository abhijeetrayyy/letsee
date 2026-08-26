"use client";

import Link from "@components/ui/AppLink";
import { Film, Tv } from "lucide-react";
import { buildBrowseUrl } from "@/utils/browseUrl";

interface Genre {
  id: number;
  name: string;
}

const GENRE_ICONS: Record<string, string> = {
  Action: "💥", Adventure: "🗺️", Animation: "✨", Comedy: "😂", Crime: "🔍",
  Documentary: "📚", Drama: "🎭", Family: "👨‍👩‍👧", Fantasy: "🧙", History: "📜",
  Horror: "👻", Music: "🎵", Mystery: "🕵️", Romance: "💕", "Science Fiction": "🚀",
  Thriller: "😱", War: "⚔️", Western: "🤠", "TV Movie": "📺",
  "Action & Adventure": "💥", Kids: "🧒", News: "📰", Reality: "📹",
  "Sci-Fi & Fantasy": "🚀", Soap: "📺", Talk: "💬", "War & Politics": "⚔️",
};

export default function GenreExplorer({
  movieGenres,
  tvGenres,
}: {
  movieGenres: Genre[];
  tvGenres: Genre[];
}) {
  const topMovie = movieGenres.slice(0, 6);
  const topTv = tvGenres.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Movie genres */}
      <div>
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
          <Film className="size-3.5" /> Movies
        </h3>
        <div className="flex flex-wrap gap-2">
          {topMovie.map((g) => (
            <Link
              key={g.id}
              href={buildBrowseUrl({ genre: String(g.id) })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-900/60 border border-surface-800/50 hover:border-brand-500/30 hover:bg-surface-800/80 transition-all text-xs font-medium text-surface-300 hover:text-white"
            >
              <span>{GENRE_ICONS[g.name] ?? "🎬"}</span>
              {g.name}
            </Link>
          ))}
        </div>
      </div>

      {/* TV genres */}
      <div>
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
          <Tv className="size-3.5" /> TV Shows
        </h3>
        <div className="flex flex-wrap gap-2">
          {topTv.map((g) => (
            <Link
              key={g.id}
              href={buildBrowseUrl({ type: "tv", genre: String(g.id) })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-900/60 border border-surface-800/50 hover:border-brand-500/30 hover:bg-surface-800/80 transition-all text-xs font-medium text-surface-300 hover:text-white"
            >
              <span>{GENRE_ICONS[g.name] ?? "📺"}</span>
              {g.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
