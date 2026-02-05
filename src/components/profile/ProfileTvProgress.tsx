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
  on_hold: "On hold",
  dropped: "Dropped",
  plan_to_watch: "Plan to watch",
};

export type ProfileTvProgressItem = {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  seasons_completed: number;
  episodes_watched: number;
  next_season: number | null;
  next_episode: number | null;
  all_complete: boolean;
  tv_status: string | null;
};

interface ProfileTvProgressProps {
  userId: string;
  isOwner?: boolean;
}

export default function ProfileTvProgress({ userId, isOwner = false }: ProfileTvProgressProps) {
  const [items, setItems] = useState<ProfileTvProgressItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [editModalShowId, setEditModalShowId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const fetchSlice = useCallback(
    async (limit: number, offset: number, append: boolean) => {
      const url = `/api/profile/tv-progress?userId=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!data?.items) return [];
      if (append) setItems((prev) => [...prev, ...data.items]);
      else setItems(data.items);
      if (data.total != null) setTotal(data.total);
      return data.items;
    },
    [userId]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/profile/tv-progress?userId=${encodeURIComponent(userId)}&limit=${INITIAL_LIMIT}&offset=0`, {
      cache: "no-store",
    })
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
    fetch(`/api/profile/tv-progress?userId=${encodeURIComponent(userId)}&limit=${Math.max(items.length, INITIAL_LIMIT)}&offset=0`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.items) setItems(data.items);
        if (data?.total != null) setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, items.length]);

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
            prev.map((it) => (it.show_id === showId ? { ...it, tv_status: newStatus } : it))
          );
        }
      } finally {
        setStatusUpdating(null);
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 p-6 flex flex-col items-center justify-center gap-3 min-h-[120px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-neutral-500 text-sm animate-pulse">Loading series progress…</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 p-6">
        <p className="text-neutral-500 text-sm text-center py-4">
          No episode progress yet. Mark episodes as watched on TV show pages to see your progress here.
        </p>
      </div>
    );
  }

  const remaining = total - items.length;
  const hasMore = remaining > 0;

  return (
    <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-700/60 bg-neutral-800/50">
              <th className="px-4 py-3 font-semibold text-neutral-200">Series</th>
              <th className="px-4 py-3 font-semibold text-neutral-200 text-center whitespace-nowrap">
                Status
              </th>
              <th className="px-4 py-3 font-semibold text-neutral-200 text-center whitespace-nowrap">
                Seasons done
              </th>
              <th className="px-4 py-3 font-semibold text-neutral-200 text-center whitespace-nowrap">
                Episodes
              </th>
              <th className="px-4 py-3 font-semibold text-neutral-200 whitespace-nowrap">
                Next / status
              </th>
              {isOwner && (
                <th className="px-4 py-3 font-semibold text-neutral-200 whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const nextLabel =
                item.all_complete
                  ? "All caught up"
                  : item.next_season != null && item.next_episode != null
                    ? `S${item.next_season} E${item.next_episode}`
                    : "—";
              const nextUrl =
                !item.all_complete && item.next_season != null && item.next_episode != null
                  ? `/app/tv/${item.show_id}/season/${item.next_season}/episode/${item.next_episode}`
                  : `/app/tv/${item.show_id}`;
              const statusLabel = item.tv_status ? TV_STATUS_LABELS[item.tv_status] ?? item.tv_status : "—";
              return (
                <tr
                  key={item.show_id}
                  className="border-b border-neutral-700/40 hover:bg-neutral-800/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/tv/${item.show_id}`}
                      className="font-medium text-white hover:text-indigo-300 hover:underline flex items-center gap-2"
                    >
                      {item.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                          alt=""
                          className="w-10 h-[60px] object-cover rounded shrink-0"
                        />
                      ) : (
                        <span className="w-10 h-[60px] rounded bg-neutral-700 shrink-0 flex items-center justify-center text-neutral-500 text-xs">
                          —
                        </span>
                      )}
                      <span className="line-clamp-2">{item.show_name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isOwner ? (
                      <select
                        value={item.tv_status ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) handleStatusChange(item.show_id, v);
                        }}
                        disabled={statusUpdating === item.show_id}
                        className="rounded-lg border border-neutral-600 bg-neutral-800 text-neutral-200 text-xs py-1.5 px-2 disabled:opacity-50"
                      >
                        <option value="">—</option>
                        {(["watching", "completed", "on_hold", "dropped", "plan_to_watch"] as const).map((s) => (
                          <option key={s} value={s}>{TV_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-neutral-400 text-xs">{statusLabel}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-300 text-center">
                    {item.seasons_completed}
                  </td>
                  <td className="px-4 py-3 text-neutral-300 text-center">
                    {item.episodes_watched}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={nextUrl}
                      className="text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      {nextLabel}
                    </Link>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditModalShowId(item.show_id)}
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                      >
                        Edit progress
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Count + View more / Load all */}
      <div className="px-4 py-3 border-t border-neutral-700/60 bg-neutral-800/50 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-400">
          Showing <span className="font-medium text-neutral-200">{items.length}</span> of{" "}
          <span className="font-medium text-neutral-200">{total}</span> TV show{total !== 1 ? "s" : ""}
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
                  <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                  <span>Loading…</span>
                </>
              ) : (
                `View more (${remaining} left)`
              )}
            </button>
            {remaining > VIEW_MORE_BATCH && (
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
                    <LoadingSpinner size="sm" className="border-t-amber-400 shrink-0" />
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
          <p className="text-sm text-amber-200/90">Loading all series… This may take a while.</p>
        </div>
      )}

      {editModalShowId && (
        <EditTvProgressModal
          showId={editModalShowId}
          showName={items.find((i) => i.show_id === editModalShowId)?.show_name ?? ""}
          isOpen={!!editModalShowId}
          onClose={() => setEditModalShowId(null)}
          onSuccess={refreshList}
        />
      )}
    </div>
  );
}
