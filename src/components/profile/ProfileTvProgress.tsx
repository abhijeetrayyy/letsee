"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import EditTvProgressModal from "@components/tv/EditTvProgressModal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const INITIAL_LIMIT = 5;
const VIEW_MORE_BATCH = 10;

const TV_STATUS_LABELS: Record<string, string> = {
  watching: "Watching",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
  plan_to_watch: "Plan to Watch",
  rewatching: "Rewatching",
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
  const [loadingAll, setLoadingAll] = useState(false);
  const [editModalShowId, setEditModalShowId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"last_watched" | "name" | "progress">(
    "last_watched",
  );

  const fetchSlice = useCallback(
    async (
      limit: number,
      offset: number,
      append: boolean,
      status: string = statusFilter,
    ) => {
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
      {
        cache: "no-store",
      },
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          if (data?.items) setItems(data.items);
          if (data?.total != null) setTotal(data.total);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  const handleLoadAll = useCallback(async () => {
    const nextOffset = items.length;
    const remaining = total - nextOffset;
    if (remaining <= 0) return;
    setLoadingAll(true);
    try {
      await fetchSlice(remaining, nextOffset, true);
    } finally {
      setLoadingAll(false);
    }
  }, [items.length, total, fetchSlice]);

  const refreshList = useCallback(() => {
    setLoading(true);
    fetch(
      `/api/profile/tv-progress?userId=${encodeURIComponent(userId)}&limit=${Math.max(items.length, INITIAL_LIMIT)}&offset=0${statusFilter ? `&status=${statusFilter}` : ""}`,
      {
        cache: "no-store",
      },
    )
      .then((r) => r.json())
      .then((data) => {
        if (data?.items) setItems(data.items);
        if (data?.total != null) setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, items.length, statusFilter]);

  const handleStatusChange = useCallback(
    async (showId: string, newStatus: string) => {
      setStatusUpdating(showId);
      try {
        const res = await fetch("/api/tv-list-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showId, status: newStatus }),
        });
        if (res.ok) {
          setItems((prev) =>
            prev.map((it) =>
              it.show_id === showId ? { ...it, tv_status: newStatus } : it,
            ),
          );
        }
      } finally {
        setStatusUpdating(null);
      }
    },
    [],
  );

  const handleMarkNext = async (item: ProfileTvProgressItem) => {
    if (!item.next_season || !item.next_episode || markingId) return;
    setMarkingId(item.show_id);
    try {
      const res = await fetch("/api/watched-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId: item.show_id,
          seasonNumber: item.next_season,
          episodeNumber: item.next_episode,
        }),
      });
      if (res.ok) {
        // Optimistically update or just refresh the slice?
        // Let's just refresh the whole list for simplicity to ensure all stats (seasons completed etc) are right.
        refreshList();
      }
    } catch (err) {
      console.error("Failed to mark next episode:", err);
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 p-6 flex flex-col items-center justify-center gap-3 min-h-[120px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-neutral-500 text-sm animate-pulse">
          Loading series progress…
        </p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 p-6">
        <p className="text-neutral-500 text-sm text-center py-4">
          No episode progress yet. Mark episodes as watched on TV show pages to
          see your progress here.
        </p>
      </div>
    );
  }

  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "name") return a.show_name.localeCompare(b.show_name);
    if (sortBy === "progress") {
      const pa =
        a.total_episodes > 0 ? a.episodes_watched / a.total_episodes : 0;
      const pb =
        b.total_episodes > 0 ? b.episodes_watched / b.total_episodes : 0;
      return pb - pa;
    }
    return 0; // Default is API sort (last watched)
  });

  const remainingCount = total - items.length;
  const hasMore = remainingCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto no-scrollbar whitespace-nowrap">
          {[
            { id: "", label: "All" },
            { id: "watching", label: "Watching" },
            { id: "completed", label: "Completed" },
            { id: "on_hold", label: "On Hold" },
            { id: "dropped", label: "Dropped" },
            { id: "plan_to_watch", label: "Planned" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setLoading(true);
                setStatusFilter(s.id);
                setItems([]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s.id
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-400"
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
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs py-2 px-3 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none h-[38px]"
          >
            <option value="last_watched">Last Activity</option>
            <option value="name">Sort by Name</option>
            <option value="progress">Sort by Progress</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-400"
              }`}
              title="Grid View"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-400"
              }`}
              title="List View"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {!loading && total === 0 && (
        <div className="rounded-2xl border border-neutral-700/60 bg-neutral-800/10 p-12 text-center">
          <p className="text-neutral-500 text-sm">
            No series found in this category.
          </p>
        </div>
      )}

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedItems.map((item) => {
            const percent =
              item.total_episodes > 0
                ? Math.round(
                    (item.episodes_watched / item.total_episodes) * 100,
                  )
                : 0;
            const isCompleted =
              item.tv_status === "completed" || item.all_complete;
            const nextLabel = isCompleted
              ? "Completed"
              : item.tv_status === "dropped"
                ? "Dropped"
                : `Next: S${item.next_season} E${item.next_episode}`;
            const posterUrl = item.poster_path
              ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
              : "/no-photo.webp";

            return (
              <div
                key={item.show_id}
                className="group relative flex flex-col rounded-2xl border border-neutral-700/60 bg-neutral-800/20 overflow-hidden hover:border-neutral-500/60 transition-all duration-300"
              >
                {/* Poster & Overlay */}
                <div className="aspect-[16/9] relative overflow-hidden">
                  <img
                    src={posterUrl}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-60 group-hover:opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 rounded-md bg-neutral-950/80 backdrop-blur-md border border-neutral-700 text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                      {TV_STATUS_LABELS[item.tv_status ?? ""] ?? "Unknown"}
                    </span>
                  </div>

                  {/* Progress Info Overlay */}
                  <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1.5">
                    <h3 className="text-base font-bold text-white line-clamp-1 group-hover:text-indigo-300 transition-colors">
                      {item.show_name}
                    </h3>
                    <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400">
                      <span>
                        {item.episodes_watched} / {item.total_episodes} eps
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-800/80 rounded-full overflow-hidden border border-neutral-700/30">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500 group-hover:bg-indigo-400"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="p-4 flex flex-col gap-3 bg-neutral-900/40">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={
                        item.all_complete
                          ? `/app/tv/${item.show_id}`
                          : `/app/tv/${item.show_id}/season/${item.next_season}/episode/${item.next_episode}`
                      }
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {nextLabel}
                    </Link>
                    {isOwner && (
                      <button
                        onClick={() => setEditModalShowId(item.show_id)}
                        className="text-[10px] font-medium text-neutral-500 hover:text-neutral-300"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {isOwner &&
                    !item.all_complete &&
                    item.tv_status !== "completed" &&
                    item.tv_status !== "dropped" && (
                      <button
                        onClick={() => handleMarkNext(item)}
                        disabled={!!markingId}
                        className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] font-bold text-neutral-200 transition-all flex items-center justify-center gap-2 hover:border-indigo-500/50 hover:text-white disabled:opacity-50 active:scale-[0.98]"
                      >
                        {markingId === item.show_id ? (
                          <LoadingSpinner
                            size="sm"
                            className="border-t-white"
                          />
                        ) : (
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
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                        Mark S{item.next_season}E{item.next_episode} Watched
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 overflow-hidden">
          <div className="overflow-x-auto pretty-scrollbar pb-1">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-700/60 bg-neutral-800/50">
                  <th className="px-4 py-3 font-semibold text-neutral-200">
                    Series
                  </th>
                  <th className="px-4 py-3 font-semibold text-neutral-200 text-center whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-neutral-200 text-center whitespace-nowrap">
                    Seasons
                  </th>
                  <th className="px-4 py-3 font-semibold text-neutral-200 text-center whitespace-nowrap">
                    Episodes
                  </th>
                  <th className="px-4 py-3 font-semibold text-neutral-200 whitespace-nowrap">
                    Next up
                  </th>
                  {isOwner && (
                    <th className="px-4 py-3 font-semibold text-neutral-200 whitespace-nowrap text-center">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const percent =
                    item.total_episodes > 0
                      ? Math.round(
                          (item.episodes_watched / item.total_episodes) * 100,
                        )
                      : 0;
                  const isCompleted =
                    item.tv_status === "completed" || item.all_complete;
                  const nextLabel = isCompleted
                    ? "Caught up"
                    : item.tv_status === "dropped"
                      ? "Dropped"
                      : `S${item.next_season} E${item.next_episode}`;
                  const nextUrl =
                    !item.all_complete &&
                    item.next_season != null &&
                    item.next_episode != null
                      ? `/app/tv/${item.show_id}/season/${item.next_season}/episode/${item.next_episode}`
                      : `/app/tv/${item.show_id}`;

                  return (
                    <tr
                      key={item.show_id}
                      className="border-b border-neutral-700/40 hover:bg-neutral-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/tv/${item.show_id}`}
                          className="font-medium text-white hover:text-indigo-300 hover:underline flex items-center gap-3"
                        >
                          {item.poster_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                              alt=""
                              className="w-9 h-[54px] object-cover rounded shrink-0 shadow-lg"
                            />
                          ) : (
                            <div className="w-9 h-[54px] rounded bg-neutral-700 shrink-0 flex items-center justify-center text-neutral-500 text-[10px]">
                              No poster
                            </div>
                          )}
                          <div className="flex flex-col gap-1">
                            <span className="line-clamp-1">
                              {item.show_name}
                            </span>
                            <div className="w-24 h-1 bg-neutral-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isOwner ? (
                          <select
                            value={item.tv_status ?? ""}
                            onChange={(e) =>
                              handleStatusChange(item.show_id, e.target.value)
                            }
                            disabled={statusUpdating === item.show_id}
                            className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-[11px] py-1 px-2 rounded-lg"
                          >
                            <option value="">Status</option>
                            {Object.entries(TV_STATUS_LABELS).map(
                              ([val, lab]) => (
                                <option key={val} value={val}>
                                  {lab}
                                </option>
                              ),
                            )}
                          </select>
                        ) : (
                          <span className="text-[11px] font-medium text-neutral-400">
                            {item.tv_status
                              ? TV_STATUS_LABELS[item.tv_status]
                              : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-300 text-center text-xs font-medium">
                        {item.seasons_completed}
                      </td>
                      <td className="px-4 py-3 text-neutral-300 text-center text-xs font-medium">
                        {item.episodes_watched}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={nextUrl}
                          className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline-offset-4 hover:underline"
                        >
                          {nextLabel}
                        </Link>
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setEditModalShowId(item.show_id)}
                            className="text-[11px] font-medium text-neutral-400 hover:text-indigo-400 transition-colors"
                          >
                            Edit
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
      )}

      {/* Count + View more / Load all */}
      <div className="px-4 py-3 border-t border-neutral-700/60 bg-neutral-800/50 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-400">
          Showing{" "}
          <span className="font-medium text-neutral-200">{items.length}</span>{" "}
          of <span className="font-medium text-neutral-200">{total}</span> TV
          show{total !== 1 ? "s" : ""}
        </p>
        {hasMore && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleViewMore}
              disabled={loadingMore || loadingAll}
              aria-busy={loadingMore}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-700 text-neutral-200 hover:bg-neutral-600 disabled:opacity-50 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loadingMore ? (
                <>
                  <LoadingSpinner
                    size="sm"
                    className="border-t-white shrink-0"
                  />
                  <span>Loading…</span>
                </>
              ) : (
                `View more (${remainingCount} left)`
              )}
            </button>
            {remainingCount > VIEW_MORE_BATCH && (
              <button
                type="button"
                onClick={handleLoadAll}
                disabled={loadingMore || loadingAll}
                aria-busy={loadingAll}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-900/60 text-amber-200 hover:bg-amber-900/80 disabled:opacity-50 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
                title="Load all series. This may take a while."
              >
                {loadingAll ? (
                  <>
                    <LoadingSpinner
                      size="sm"
                      className="border-t-amber-400 shrink-0"
                    />
                    <span>Loading all…</span>
                  </>
                ) : (
                  "Load all (may take a while)"
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {loadingAll && (
        <div className="px-4 py-3 border-t border-neutral-700/60 bg-neutral-800/50 text-center">
          <p className="text-sm text-amber-200/90">
            Loading all series… This may take a while.
          </p>
        </div>
      )}

      {editModalShowId && (
        <EditTvProgressModal
          showId={editModalShowId}
          showName={
            items.find((i) => i.show_id === editModalShowId)?.show_name ?? ""
          }
          isOpen={!!editModalShowId}
          onClose={() => setEditModalShowId(null)}
          onSuccess={refreshList}
        />
      )}
    </div>
  );
}
