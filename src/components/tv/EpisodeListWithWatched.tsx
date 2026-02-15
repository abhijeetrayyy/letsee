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

interface SeasonSummary {
  id: number;
  season_number: number;
  episode_count: number;
}

interface EpisodeListWithWatchedProps {
  showId: string;
  seasonNumber: number;
  episodes: EpisodeItem[];
  allSeasons?: SeasonSummary[];
}

function getWatchedInfo(
  episodes: {
    season_number: number;
    episode_number: number;
    watched_at?: string;
  }[],
  seasonNumber: number,
  episodeNumber: number,
): { watched: boolean; date?: string } {
  const match = episodes.find(
    (e) =>
      e.season_number === seasonNumber && e.episode_number === episodeNumber,
  );
  return { watched: !!match, date: match?.watched_at };
}

export default function EpisodeListWithWatched({
  showId,
  seasonNumber,
  episodes,
  allSeasons,
}: EpisodeListWithWatchedProps) {
  const [watched, setWatched] = useState<
    { season_number: number; episode_number: number; watched_at?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const fetchWatched = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/watched-episodes?showId=${encodeURIComponent(showId)}`,
        { cache: "no-store" },
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
        if (res.ok) await fetchWatched();
      } finally {
        setToggling(null);
      }
    },
    [showId, seasonNumber, fetchWatched],
  );

  const handleBulkMark = async (
    targetEpisodes: { season_number: number; episode_number: number }[],
  ) => {
    if (targetEpisodes.length === 0) return;
    setBulkUpdating(true);
    try {
      const res = await fetch("/api/watched-episodes-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          episodes: targetEpisodes,
          action: "mark",
        }),
      });
      if (res.ok) await fetchWatched();
    } finally {
      setBulkUpdating(false);
    }
  };

  const markSeasonWatched = () => {
    // Filter out unaired episodes
    const now = new Date();
    const target = episodes
      .filter((e) => !e.air_date || new Date(e.air_date) <= now)
      .map((e) => ({
        season_number: seasonNumber,
        episode_number: e.episode_number,
      }));
    handleBulkMark(target);
  };

  const markAllPrevious = (currentEpNumber: number) => {
    const now = new Date();

    // 1. Previous episodes in CURRENT season
    const prevInSeason = episodes
      .filter((e) => e.episode_number < currentEpNumber)
      .filter((e) => !e.air_date || new Date(e.air_date) <= now)
      .map((e) => ({
        season_number: seasonNumber,
        episode_number: e.episode_number,
      }));

    // 2. All episodes in PREVIOUS seasons (if allSeasons provided)
    let prevSeasonsEpisodes: {
      season_number: number;
      episode_number: number;
    }[] = [];
    if (allSeasons) {
      allSeasons
        .filter((s) => s.season_number < seasonNumber && s.season_number > 0) // Ignore season 0 for bulk previous
        .forEach((s) => {
          // We don't check air_date for previous seasons as we assume they are aired if the season is previous?
          // Actually, some previous season specials might be future? Unlikely.
          // Or if strict, we can't check air_date without fetching their details.
          // We assume previous seasons are fully aired.
          for (let i = 1; i <= s.episode_count; i++) {
            prevSeasonsEpisodes.push({
              season_number: s.season_number,
              episode_number: i,
            });
          }
        });
    }

    handleBulkMark([...prevSeasonsEpisodes, ...prevInSeason]);
  };

  const isUnaired = (dateStr: string | null) => {
    if (!dateStr) return false; // Assume aired if no date? Or unaired? Usually aired.
    return new Date(dateStr) > new Date();
  };

  if (episodes.length === 0) {
    return (
      <p className="text-neutral-400 text-center">
        No episodes found for this season.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-neutral-200">Episodes</h3>
        <button
          onClick={markSeasonWatched}
          disabled={bulkUpdating || loading}
          className="text-xs sm:text-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-200 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
        >
          {bulkUpdating ? "Updating..." : "Mark Season Watched"}
        </button>
      </div>
      <ul className="space-y-4">
        {episodes.map((episode) => {
          const watchedInfo = getWatchedInfo(
            watched,
            seasonNumber,
            episode.episode_number,
          );
          const key = `${seasonNumber}-${episode.episode_number}`;
          const busy = toggling === key;
          const unaired = isUnaired(episode.air_date);

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
                    {!loading && !unaired && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markAllPrevious(episode.episode_number);
                          }}
                          disabled={bulkUpdating}
                          title="Mark all previous episodes as watched"
                          className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-600 rounded"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-4 h-4"
                          >
                            <path d="M7 9a1 1 0 011-1h8a1 1 0 110 2H8a1 1 0 01-1-1z" />
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={(e) =>
                            toggleEpisode(e, episode.episode_number)
                          }
                          disabled={busy}
                          aria-pressed={watchedInfo.watched}
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                            watchedInfo.watched
                              ? "bg-emerald-600/80 text-white hover:bg-emerald-600"
                              : "bg-neutral-600 text-neutral-200 hover:bg-neutral-500"
                          } disabled:opacity-60`}
                        >
                          {busy
                            ? "…"
                            : watchedInfo.watched
                              ? "✓ Watched"
                              : "Mark watched"}
                        </button>
                      </div>
                    )}
                    {unaired && (
                      <span className="text-xs font-medium text-amber-500 bg-amber-900/20 px-2 py-1 rounded">
                        Unaired
                      </span>
                    )}
                    {watchedInfo.watched && watchedInfo.date && (
                      <span className="text-xs text-neutral-500 ml-2 hidden sm:inline">
                        Watched on{" "}
                        {new Date(watchedInfo.date).toLocaleDateString()}
                      </span>
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
    </div>
  );
}
