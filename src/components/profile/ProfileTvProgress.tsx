"use client";

import React, { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import TvShowCard from "@components/profile/TvShowCard";
import TvCalendarView from "@components/profile/TvCalendarView";
import EpisodeManagementModal from "@components/tv/EpisodeManagementModal";

const INITIAL_LIMIT = 12;
const VIEW_MORE_BATCH = 12;

const TV_STATUS_LABELS: Record<string, string> = {
  watching: "Watching",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
  plan_to_watch: "Plan to Watch",
  rewatching: "Rewatching",
  untagged: "Untagged",
};

export type ProfileTvProgressItem = {
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

interface ProfileTvProgressProps {
  userId: string;
  isOwner?: boolean;
}

export default function ProfileTvProgress({
  userId,
  isOwner = false,
}: ProfileTvProgressProps) {
  const [items, setItems] = useState<ProfileTvProgressItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"last_watched" | "name" | "progress">("last_watched");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "calendar">("grid");
  const [editModalShowId, setEditModalShowId] = useState<string | null>(null);
  const [editModalShowName, setEditModalShowName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchSlice = useCallback(
    async (limit: number, offset: number, append: boolean, status: string = statusFilter) => {
      const url = `/api/profile/tv-progress?userId=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}${status ? `&status=${status}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!data?.items) return [];
      if (append) setItems((prev) => [...prev, ...data.items]);
      else setItems(data.items);
      if (data.total != null) setTotal(data.total);
      return data.items;
    },
    [userId, statusFilter],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/profile/tv-progress?userId=${encodeURIComponent(userId)}&limit=${INITIAL_LIMIT}&offset=0${statusFilter ? `&status=${statusFilter}` : ""}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          if (data?.error) {
            setError(data.error);
          } else {
            if (data?.items) setItems(data.items);
            if (data?.total != null) setTotal(data.total);
            setError(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load progress details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, statusFilter]);

  const handleViewMore = useCallback(async () => {
    const nextOffset = items.length;
    const remaining = total - nextOffset;
    if (remaining <= 0) return;
    setLoadingMore(true);
    try {
      await fetchSlice(Math.min(VIEW_MORE_BATCH, remaining), nextOffset, true);
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, total, fetchSlice]);

  const refreshList = useCallback(() => {
    setLoading(true);
    fetch(
      `/api/profile/tv-progress?userId=${encodeURIComponent(userId)}&limit=${Math.max(items.length, INITIAL_LIMIT)}&offset=0${statusFilter ? `&status=${statusFilter}` : ""}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error);
        } else {
          if (data?.items) setItems(data.items);
          if (data?.total != null) setTotal(data.total);
          setError(null);
        }
      })
      .catch(() => setError("Failed to refresh list."))
      .finally(() => setLoading(false));
  }, [userId, items.length, statusFilter]);

  const handleMarkNext = async (showId: string) => {
    const item = items.find((i) => i.show_id === showId);
    if (!item?.next_season || !item?.next_episode || markingId) return;
    setMarkingId(showId);
    try {
      const res = await fetch("/api/watched-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          seasonNumber: item.next_season,
          episodeNumber: item.next_episode,
        }),
      });
      if (res.ok) refreshList();
    } catch (err) {
      console.error("Failed to mark next episode:", err);
    } finally {
      setMarkingId(null);
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "name") return a.show_name.localeCompare(b.show_name);
    if (sortBy === "progress") {
      const pa = a.total_episodes > 0 ? a.episodes_watched / a.total_episodes : 0;
      const pb = b.total_episodes > 0 ? b.episodes_watched / b.total_episodes : 0;
      return pb - pa;
    }
    return 0;
  });

  const remainingCount = total - items.length;
  const hasMore = remainingCount > 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6 flex flex-col items-center justify-center gap-3 min-h-[120px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-surface-500 text-sm animate-pulse">Loading series progress…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 flex flex-col items-center gap-3">
        <p className="text-amber-200 text-sm font-medium text-center">{error}</p>
        <button
          onClick={refreshList}
          className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 text-xs transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-900 border border-surface-800 rounded-xl overflow-x-auto no-scrollbar whitespace-nowrap">
          {[
            { id: "", label: "All" },
            { id: "watching", label: "Watching" },
            { id: "completed", label: "Completed" },
            { id: "on_hold", label: "On Hold" },
            { id: "dropped", label: "Dropped" },
            { id: "plan_to_watch", label: "Planned" },
            { id: "untagged", label: "Untagged" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => {
                if (statusFilter === s.id) return;
                setLoading(true);
                setItems([]);
                setStatusFilter(s.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s.id
                  ? "bg-surface-800 text-white shadow-sm"
                  : "text-surface-500 hover:text-surface-400"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Sorting */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-surface-900 border border-surface-800 text-surface-300 text-xs py-2 px-3 rounded-xl focus:ring-1 focus:ring-brand-500 outline-none h-[38px]"
          >
            <option value="last_watched">Last Activity</option>
            <option value="name">Sort by Name</option>
            <option value="progress">Sort by Progress</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-900 border border-surface-800 rounded-xl">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-surface-800 text-white shadow-sm"
                  : "text-surface-500 hover:text-surface-400"
              }`}
              title="Grid View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "list"
                  ? "bg-surface-800 text-white shadow-sm"
                  : "text-surface-500 hover:text-surface-400"
              }`}
              title="List View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "calendar"
                  ? "bg-surface-800 text-white shadow-sm"
                  : "text-surface-500 hover:text-surface-400"
              }`}
              title="Calendar View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {total === 0 && !loading && (
        <div className="rounded-2xl border border-surface-700/60 bg-surface-900/20 p-12 text-center">
          <p className="text-surface-500 text-sm">
            {statusFilter
              ? `No series found in the "${TV_STATUS_LABELS[statusFilter]}" category.`
              : "No episode progress yet. Mark episodes as watched on TV show pages to see your progress here."}
          </p>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" ? (
        <TvCalendarView userId={userId} isOwner={isOwner} />
      ) : viewMode === "grid" ? (
        <>
          {/* Grid View */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {sortedItems.map((item) => (
              <TvShowCard
                key={item.show_id}
                showId={item.show_id}
                showName={item.show_name}
                posterPath={item.poster_path}
                seasonsCompleted={item.seasons_completed}
                episodesWatched={item.episodes_watched}
                totalEpisodes={item.total_episodes}
                nextSeason={item.next_season}
                nextEpisode={item.next_episode}
                allComplete={item.all_complete}
                tvStatus={item.tv_status}
                isOwner={isOwner}
                onMarkNext={handleMarkNext}
                markingId={markingId}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleViewMore}
                disabled={loadingMore}
                className="px-6 py-3 rounded-xl text-sm font-medium bg-surface-800 text-surface-200 hover:bg-surface-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                    Loading…
                  </>
                ) : (
                  `Load more (${remainingCount} left)`
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* List View */}
          <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-700/60 bg-surface-800/50">
                    <th className="px-4 py-3 font-semibold text-surface-200">Series</th>
                    <th className="px-4 py-3 font-semibold text-surface-200 text-center whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 font-semibold text-surface-200 text-center whitespace-nowrap">Progress</th>
                    <th className="px-4 py-3 font-semibold text-surface-200 text-center whitespace-nowrap">Episodes</th>
                    <th className="px-4 py-3 font-semibold text-surface-200 whitespace-nowrap">Next up</th>
                    {isOwner && (
                      <th className="px-4 py-3 font-semibold text-surface-200 whitespace-nowrap text-center">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => {
                    const percent = item.total_episodes > 0
                      ? Math.round((item.episodes_watched / item.total_episodes) * 100)
                      : 0;
                    const statusColor = item.tv_status === "watching"
                      ? "text-emerald-400"
                      : item.tv_status === "completed"
                      ? "text-brand-400"
                      : item.tv_status === "dropped"
                      ? "text-red-400"
                      : "text-surface-400";

                    return (
                      <tr
                        key={item.show_id}
                        className="border-b border-surface-700/40 hover:bg-surface-800/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <a
                            href={`/app/tv/${item.show_id}`}
                            className="font-medium text-white hover:text-brand-400 hover:underline flex items-center gap-3"
                          >
                            {item.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                                alt=""
                                className="w-9 h-[54px] object-cover rounded shrink-0 shadow-lg"
                              />
                            ) : (
                              <div className="w-9 h-[54px] rounded bg-surface-700 shrink-0 flex items-center justify-center text-surface-500 text-[10px]">
                                No poster
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              <span className="line-clamp-1">{item.show_name}</span>
                              <div className="w-24 h-1 bg-surface-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-500"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </a>
                        </td>
                        <td className={`px-4 py-3 text-center text-xs font-medium ${statusColor}`}>
                          {TV_STATUS_LABELS[item.tv_status ?? "untagged"] ?? "Untagged"}
                        </td>
                        <td className="px-4 py-3 text-surface-300 text-center text-xs font-medium">
                          {percent}%
                        </td>
                        <td className="px-4 py-3 text-surface-300 text-center text-xs font-medium">
                          {item.episodes_watched}/{item.total_episodes}
                        </td>
                        <td className="px-4 py-3">
                          {item.next_season && item.next_episode ? (
                            <button
                              onClick={() => handleMarkNext(item.show_id)}
                              disabled={markingId === item.show_id}
                              className="text-xs font-medium text-brand-400 hover:text-brand-300 underline-offset-4 hover:underline disabled:opacity-50"
                            >
                              {markingId === item.show_id ? "Marking…" : `S${item.next_season}E${item.next_episode}`}
                            </button>
                          ) : (
                            <span className="text-xs text-surface-500">
                              {item.all_complete ? "Complete" : "—"}
                            </span>
                          )}
                        </td>
                        {isOwner && (
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setEditModalShowId(item.show_id);
                                setEditModalShowName(item.show_name);
                              }}
                              className="text-[11px] font-medium text-surface-400 hover:text-brand-400 transition-colors"
                            >
                              Manage
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleViewMore}
                disabled={loadingMore}
                className="px-6 py-3 rounded-xl text-sm font-medium bg-surface-800 text-surface-200 hover:bg-surface-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                    Loading…
                  </>
                ) : (
                  `Load more (${remainingCount} left)`
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Count */}
      {total > 0 && (
        <div className="px-4 py-3 border-t border-surface-700/60 bg-surface-800/50 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-surface-400">
            Showing{" "}
            <span className="font-medium text-surface-200">{items.length}</span>{" "}
            of <span className="font-medium text-surface-200">{total}</span> TV
            show{total !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Episode Management Modal */}
      {editModalShowId && (
        <EpisodeManagementModal
          showId={editModalShowId}
          showName={editModalShowName}
          isOpen={!!editModalShowId}
          onClose={() => setEditModalShowId(null)}
          onSuccess={() => {
            setEditModalShowId(null);
            refreshList();
          }}
        />
      )}
    </div>
  );
}
