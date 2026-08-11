"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Heart, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { swrFetcher } from "@/utils/swrFetcher";

type FavoriteItem = {
  id: number;
  user_id: string;
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  genres: string[] | null;
  created_at: string;
};

type PaginatedResponse = {
  data: FavoriteItem[];
  page: number;
  totalPages: number;
  totalItems: number;
  perloadLength: number;
};

export default function FavoritesSection({
  userId,
  isOwner,
  initialItems,
  totalCount,
}: {
  userId: string;
  isOwner: boolean;
  initialItems: FavoriteItem[];
  totalCount: number;
}) {
  const [page, setPage] = useState(1);
  const [loadedItems, setLoadedItems] = useState<FavoriteItem[]>(initialItems);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const hasMore = loadedItems.length < totalCount;

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const res = await fetch("/api/UserFavoritePagination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userID: userId, page: page + 1, limit: 12 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PaginatedResponse = await res.json();
      setLoadedItems((prev) => [...prev, ...json.data]);
      setPage((p) => p + 1);
    } catch (e: any) {
      setLoadError(e.message ?? "Failed to load more");
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, page, userId]);

  if (loadedItems.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/50 p-12 text-center">
        <Heart className="w-8 h-8 text-surface-600 mx-auto mb-3" />
        <p className="text-surface-400 text-sm">
          {isOwner
            ? "No favorites yet. Heart the films and shows you love."
            : "No favorites yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {loadedItems.map((item) => (
          <Link
            key={item.id}
            href={`/app/${item.item_type}/${item.item_id}`}
            className="group flex flex-col rounded-xl border border-surface-700/60 bg-surface-900/40 hover:border-surface-500/60 transition-all overflow-hidden"
          >
            <div className="aspect-[2/3] overflow-hidden bg-surface-800">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.item_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-surface-600 text-xs">
                  {item.item_type === "tv" ? "TV" : "Film"}
                </div>
              )}
            </div>
            <div className="p-2.5 flex-1 flex flex-col gap-1">
              <p className="text-xs text-surface-200 line-clamp-2 group-hover:text-white transition-colors leading-snug">
                {item.item_name}
              </p>
              <span className="text-[10px] text-surface-500 uppercase">
                {item.item_type === "tv" ? "TV" : "Movie"}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {loadError && (
        <div className="text-center">
          <p className="text-xs text-red-400 mb-2">Failed to load more: {loadError}</p>
          <button
            onClick={loadMore}
            className="text-xs px-3 py-1 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {hasMore && !loadError && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-surface-600/60 text-sm text-surface-300 hover:bg-surface-800 hover:text-white transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              `Show more (${totalCount - loadedItems.length} left)`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
