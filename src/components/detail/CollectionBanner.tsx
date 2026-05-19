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
      className="group block rounded-2xl overflow-hidden glass-card hover:border-surface-600/40 transition-all duration-300 animate-fade-up"
    >
      <div className="relative flex items-center gap-5 p-5">
        {backdropUrl && (
          <div className="absolute inset-0 opacity-15">
            <img src={backdropUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-surface-950 via-surface-950/70 to-transparent" />
          </div>
        )}
        {posterUrl && (
          <div className="relative z-10 shrink-0">
            <img
              src={posterUrl}
              alt={collection.name}
              className="w-16 h-24 rounded-lg object-cover shadow-lg group-hover:scale-105 transition-transform duration-300 ring-1 ring-white/10"
            />
          </div>
        )}
        <div className="relative z-10 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] text-brand-400 font-semibold uppercase tracking-[0.15em] mb-1.5">
            <Film className="w-3 h-3" />
            Part of a Collection
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors truncate">
            {collection.name}
          </h3>
          <p className="text-xs text-surface-500 mt-1 flex items-center gap-1 group-hover:gap-2 transition-all">
            View the full collection
            <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </p>
        </div>
        {!posterUrl && (
          <div className="relative z-10 w-16 h-24 rounded-lg bg-surface-800/80 flex items-center justify-center ring-1 ring-white/5">
            <Film className="w-6 h-6 text-surface-600" />
          </div>
        )}
      </div>
    </Link>
  );
}
