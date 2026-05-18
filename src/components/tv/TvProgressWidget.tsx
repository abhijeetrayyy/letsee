"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type ProgressData = {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  seasons_completed: number;
  episodes_watched: number;
  total_episodes: number;
  next_season: number | null;
  next_episode: number | null;
  all_complete: boolean;
  tv_status: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  watching: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  completed: "bg-brand-500/20 text-brand-400 border-brand-500/30",
  on_hold: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  dropped: "bg-red-500/20 text-red-400 border-red-500/30",
  plan_to_watch: "bg-surface-500/20 text-surface-400 border-surface-500/30",
  rewatching: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  watching: "Watching",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
  plan_to_watch: "Plan to Watch",
  rewatching: "Rewatching",
};

export default function TvProgressWidget({
  showId,
  showName,
  posterPath,
  onRefresh,
}: {
  showId: string;
  showName?: string;
  posterPath?: string | null;
  onRefresh?: () => void;
}) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetch(`/api/tv-progress?showId=${encodeURIComponent(showId)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [showId]);

  const handleMarkNext = async () => {
    if (!data?.next_season || !data?.next_episode || marking) return;
    setMarking(true);
    try {
      const res = await fetch("/api/watched-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          seasonNumber: data.next_season,
          episodeNumber: data.next_episode,
        }),
      });
      if (res.ok) {
        // Refresh
        const r = await fetch(`/api/tv-progress?showId=${encodeURIComponent(showId)}`);
        const d = await r.json();
        setData(d);
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-4 flex items-center justify-center gap-3 min-h-[80px]">
        <LoadingSpinner size="sm" className="border-t-white" />
        <span className="text-sm text-surface-400">Loading progress…</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const percent =
    data.total_episodes > 0
      ? Math.round((data.episodes_watched / data.total_episodes) * 100)
      : 0;
  const statusColor = STATUS_COLORS[data.tv_status ?? ""] ?? STATUS_COLORS.plan_to_watch;
  const statusLabel = STATUS_LABELS[data.tv_status ?? ""] ?? "Not Started";

  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {posterPath && (
            <img
              src={`https://image.tmdb.org/t/p/w92${posterPath}`}
              alt=""
              className="w-10 h-14 rounded object-cover"
            />
          )}
          <div>
            <h3 className="text-sm font-semibold text-surface-100 line-clamp-1">
              {showName || data.show_name}
            </h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{percent}%</p>
          <p className="text-xs text-surface-400">
            {data.episodes_watched}/{data.total_episodes} eps
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        {!data.all_complete && data.next_season && data.next_episode ? (
          <button
            onClick={handleMarkNext}
            disabled={marking}
            className="flex-1 py-2 rounded-lg bg-brand-500 text-surface-950 text-sm font-semibold hover:bg-brand-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {marking ? (
              <>
                <LoadingSpinner size="sm" className="border-t-surface-950" />
                Marking…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Mark S{data.next_season}E{data.next_episode} Watched
              </>
            )}
          </button>
        ) : (
          <div className="flex-1 py-2 rounded-lg bg-surface-800 text-surface-400 text-sm font-medium text-center">
            {data.all_complete ? "All episodes watched" : "No upcoming episodes"}
          </div>
        )}

        <Link
          href={`/app/tv/${showId}`}
          className="px-3 py-2 rounded-lg bg-surface-800 text-surface-300 text-sm font-medium hover:bg-surface-700 transition-colors"
        >
          View Show
        </Link>
      </div>

      {/* Season Info */}
      <div className="flex items-center justify-between text-xs text-surface-500">
        <span>{data.seasons_completed} season{data.seasons_completed !== 1 ? "s" : ""} completed</span>
        {data.next_season && data.next_episode && (
          <span>Next: S{data.next_season}E{data.next_episode}</span>
        )}
      </div>
    </div>
  );
}
