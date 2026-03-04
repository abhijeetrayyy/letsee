"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface TvShowProgressProps {
  showId: string;
  /** Optional key to trigger a re-fetch from outside */
  refreshKey?: number;
}

type Progress = {
  show_name: string;
  seasons_completed: number;
  episodes_watched: number;
  total_episodes: number;
  next_season: number | null;
  next_episode: number | null;
  all_complete: boolean;
};

export default function TvShowProgress({
  showId,
  refreshKey,
}: TvShowProgressProps) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchProgress = async () => {
    try {
      const r = await fetch(
        `/api/tv-progress?showId=${encodeURIComponent(showId)}`,
        {
          cache: "no-store",
        },
      );
      if (r.status === 401) return;
      const data = await r.json();
      if (data && !data.error) setProgress(data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [showId, refreshKey]);

  const handleMarkNext = async () => {
    if (!progress?.next_season || !progress?.next_episode || updating) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/watched-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          seasonNumber: progress.next_season,
          episodeNumber: progress.next_episode,
        }),
      });
      if (res.ok) {
        await fetchProgress();
      }
    } catch (err) {
      console.error("Failed to mark next episode:", err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !progress) return null;

  const nextLabel = progress.all_complete
    ? "All caught up"
    : progress.next_season != null && progress.next_episode != null
      ? `S${progress.next_season} E${progress.next_episode}`
      : null;
  const nextUrl =
    !progress.all_complete &&
    progress.next_season != null &&
    progress.next_episode != null
      ? `/app/tv/${showId}/season/${progress.next_season}/episode/${progress.next_episode}`
      : null;

  const percent =
    progress.total_episodes > 0
      ? Math.round((progress.episodes_watched / progress.total_episodes) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/40 p-5 mt-4 group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-white">Your progress</h3>
          <button
            onClick={() => {
              setLoading(true);
              fetchProgress();
            }}
            className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition-all"
            title="Refresh progress"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              <polyline points="23 4 23 10 17 10" />
            </svg>
          </button>
        </div>
        <span className="text-xs font-medium text-neutral-400 bg-neutral-700/50 px-2 py-1 rounded-md">
          {percent}% Complete
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-neutral-700/50 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-300">
          <span>
            <strong className="text-white">{progress.episodes_watched}</strong>
            <span className="text-neutral-500">
              {" "}
              / {progress.total_episodes}
            </span>{" "}
            episodes
          </span>
          <span className="text-neutral-500">·</span>
          {nextLabel && (
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Next:</span>
              {nextUrl ? (
                <Link
                  href={nextUrl}
                  className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium"
                >
                  {nextLabel}
                </Link>
              ) : (
                <span className="text-neutral-400">{nextLabel}</span>
              )}
            </div>
          )}
        </div>

        {!progress.all_complete && (
          <button
            type="button"
            onClick={handleMarkNext}
            disabled={updating}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
          >
            {updating ? "Updating..." : `Mark ${nextLabel} watched`}
          </button>
        )}
      </div>
    </div>
  );
}
