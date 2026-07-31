"use client";

import useSWR from "swr";
import Link from "next/link";
import { Tv } from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";

interface Episode {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  season_number: number;
  episode_number: number;
  episode_name: string;
  air_date: string;
}

export default function AiringSoon() {
  const { data, isLoading } = useSWR<{ episodes: Episode[] }>(
    "/api/upcoming-episodes",
    swrFetcher,
  );
  const episodes = data?.episodes ?? [];

  if (isLoading) {
    return (
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-28 aspect-[2/3] rounded-xl bg-surface-800 animate-pulse shrink-0" />
        ))}
      </div>
    );
  }

  if (episodes.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Tv className="size-3.5 text-purple-400" />
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Airing Soon</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {episodes.slice(0, 6).map((e) => (
          <Link
            key={`${e.show_id}-${e.season_number}-${e.episode_number}`}
            href={`/app/tv/${e.show_id}`}
            className="shrink-0 w-28 group"
          >
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-surface-800 border border-surface-700/30 group-hover:border-brand-500/30 transition-all relative">
              {e.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w342${e.poster_path}`}
                  alt={e.show_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Tv className="size-6 text-surface-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-1.5">
                <p className="text-[9px] text-brand-300 font-semibold">
                  S{e.season_number}E{e.episode_number}
                </p>
                <p className="text-[9px] text-surface-400">
                  {new Date(e.air_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-surface-300 line-clamp-1 group-hover:text-white">
              {e.show_name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
