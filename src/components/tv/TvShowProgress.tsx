"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface TvShowProgressProps {
  showId: string;
}

type Progress = {
  show_name: string;
  seasons_completed: number;
  episodes_watched: number;
  next_season: number | null;
  next_episode: number | null;
  all_complete: boolean;
};

export default function TvShowProgress({ showId }: TvShowProgressProps) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tv-progress?showId=${encodeURIComponent(showId)}`, {
      cache: "no-store",
    })
      .then((r) => {
        if (r.status === 401) return null;
        return r.json();
      })
      .then((data) => {
        if (!cancelled && data && !data.error) setProgress(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showId]);

  if (loading || !progress) return null;

  const nextLabel =
    progress.all_complete
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

  return (
    <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/40 p-4 mt-4">
      <h3 className="text-base font-semibold text-white mb-2">Your progress</h3>
      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-300">
        <span>
          <strong className="text-white">{progress.seasons_completed}</strong>{" "}
          season{progress.seasons_completed !== 1 ? "s" : ""} completed
        </span>
        <span className="text-neutral-500">·</span>
        <span>
          <strong className="text-white">{progress.episodes_watched}</strong>{" "}
          episode{progress.episodes_watched !== 1 ? "s" : ""} watched
        </span>
        {nextLabel && (
          <>
            <span className="text-neutral-500">·</span>
            {nextUrl ? (
              <Link
                href={nextUrl}
                className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium"
              >
                Next: {nextLabel}
              </Link>
            ) : (
              <span className="text-neutral-400">{nextLabel}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
