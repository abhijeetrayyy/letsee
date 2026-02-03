"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export interface EpisodeItem {
  id: number;
  episode_number: number;
  name: string;
  air_date: string | null;
  overview: string;
  still_path: string | null;
}

interface EpisodeListWithWatchedProps {
  showId: string;
  seasonNumber: number;
  episodes: EpisodeItem[];
}

function isWatched(
  episodes: { season_number: number; episode_number: number }[],
  seasonNumber: number,
  episodeNumber: number
): boolean {
  return episodes.some(
    (e) => e.season_number === seasonNumber && e.episode_number === episodeNumber
  );
}

export default function EpisodeListWithWatched({
  showId,
  seasonNumber,
  episodes,
}: EpisodeListWithWatchedProps) {
  const [watched, setWatched] = useState<
    { season_number: number; episode_number: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchWatched = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/watched-episodes?showId=${encodeURIComponent(showId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setWatched(data?.episodes ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    fetchWatched();
  }, [fetchWatched]);

  const toggleEpisode = useCallback(
    async (e: React.MouseEvent, episodeNumber: number) => {
      e.preventDefault();
      e.stopPropagation();
      const key = `${seasonNumber}-${episodeNumber}`;
      setToggling(key);
      try {
        const res = await fetch("/api/watched-episode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId,
            seasonNumber,
            episodeNumber,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) await fetchWatched();
      } finally {
        setToggling(null);
      }
    },
    [showId, seasonNumber, fetchWatched]
  );

  if (episodes.length === 0) {
    return (
      <p className="text-neutral-400 text-center">
        No episodes found for this season.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-4">
      {episodes.map((episode) => {
        const watchedState = isWatched(
          watched,
          seasonNumber,
          episode.episode_number
        );
        const key = `${seasonNumber}-${episode.episode_number}`;
        const busy = toggling === key;
        return (
          <li key={episode.id}>
            <Link
              href={`/app/tv/${showId}/season/${seasonNumber}/episode/${episode.episode_number}`}
              className="flex flex-col sm:flex-row gap-4 bg-neutral-700 hover:bg-neutral-800 p-3 rounded-md transition-colors"
            >
              {episode.still_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${episode.still_path}`}
                  alt={episode.name}
                  width={185}
                  height={104}
                  className="rounded-md object-cover shrink-0"
                />
              ) : (
                <div className="w-[185px] h-[104px] shrink-0 bg-neutral-600 rounded-md flex items-center justify-center">
                  <span className="text-xs text-neutral-400">No Image</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-semibold text-neutral-100">
                    {episode.episode_number.toString().padStart(2, "0")}.{" "}
                    {episode.name}
                  </h3>
                  {!loading && (
                    <button
                      type="button"
                      onClick={(e) => toggleEpisode(e, episode.episode_number)}
                      disabled={busy}
                      aria-pressed={watchedState}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        watchedState
                          ? "bg-emerald-600/80 text-white hover:bg-emerald-600"
                          : "bg-neutral-600 text-neutral-200 hover:bg-neutral-500"
                      } disabled:opacity-60`}
                    >
                      {busy
                        ? "…"
                        : watchedState
                          ? "✓ Watched"
                          : "Mark watched"}
                    </button>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
                  {episode.air_date || "Air date TBA"}
                </p>
                <p className="text-xs sm:text-sm text-neutral-300 mt-2 line-clamp-3">
                  {episode.overview || "No overview available."}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
