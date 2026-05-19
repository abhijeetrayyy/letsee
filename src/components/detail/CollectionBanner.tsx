"use client";

import Link from "next/link";
import { Film } from "lucide-react";

type Collection = {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
};

export default function CollectionBanner({ collection }: { collection: Collection | null }) {
  if (!collection) return null;

  const backdropUrl = collection.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${collection.backdrop_path}`
    : null;
  const posterUrl = collection.poster_path
    ? `https://image.tmdb.org/t/p/w185${collection.poster_path}`
    : null;

  return (
    <Link
      href={`/app/collection/${collection.id}`}
      className="block rounded-2xl overflow-hidden border border-surface-700/40 bg-surface-900/40 backdrop-blur-sm hover:border-surface-600/60 transition-all duration-300 group"
    >
      <div className="relative flex items-center gap-5 p-5">
        {backdropUrl && (
          <div className="absolute inset-0 opacity-20">
            <img
              src={backdropUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-surface-950 via-surface-950/60 to-transparent" />
          </div>
        )}
        {posterUrl && (
          <div className="relative z-10 shrink-0">
            <img
              src={posterUrl}
              alt={collection.name}
              className="w-16 h-24 rounded-lg object-cover shadow-lg group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <div className="relative z-10 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-brand-400 font-semibold uppercase tracking-wider mb-1">
            <Film className="w-3.5 h-3.5" />
            Part of a Collection
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors truncate">
            {collection.name}
          </h3>
          <p className="text-xs text-surface-500 mt-1">
            View the full collection →
          </p>
        </div>
      </div>
    </Link>
  );
}
