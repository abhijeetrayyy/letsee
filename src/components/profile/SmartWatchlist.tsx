"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import MediaCard from "@components/cards/MediaCard";

type SmartItem = {
  id: number;
  itemId: string;
  itemName: string;
  itemType: string;
  imageUrl: string | null;
  genres: string[] | null;
  addedAt: string;
  predictedRating: number;
  reason: string;
};

type TasteItem = {
  genre: string;
  affinity: number;
  sampleCount: number;
};

type SmartWatchlistData = {
  items: SmartItem[];
  tasteProfile: TasteItem[];
  total: number;
  note?: string;
};

export default function SmartWatchlist({ userId }: { userId: string }) {
  const [data, setData] = useState<SmartWatchlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist/smart");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-800/40 bg-red-900/20 p-6 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={fetchData} className="mt-2 text-xs text-brand-400 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-8 text-center">
        <p className="text-surface-400 text-sm">{data?.note ?? "Your watchlist is empty."}</p>
      </div>
    );
  }

  const displayItems = showAll ? data.items : data.items.slice(0, 10);

  return (
    <div className="space-y-5">
      {/* Taste Profile */}
      {data.tasteProfile.length > 0 && (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-4">
          <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
            Your Taste Profile
          </h4>
          <div className="flex flex-wrap gap-2">
            {data.tasteProfile.map((t) => (
              <div
                key={t.genre}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-800 text-xs"
              >
                <span className="text-surface-200">{t.genre}</span>
                <span className={t.affinity > 0 ? "text-green-400" : "text-red-400"}>
                  {t.affinity > 0 ? "+" : ""}{t.affinity}%
                </span>
                <span className="text-surface-500">({t.sampleCount})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sorted Watchlist */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {displayItems.map((item) => (
          <div key={item.id} className="relative">
            <MediaCard
              id={Number(item.itemId)}
              title={item.itemName}
              mediaType={item.itemType as "movie" | "tv"}
              imageUrl={item.imageUrl}
              adult={false}
              genres={Array.isArray(item.genres) ? item.genres : []}
              showActions={true}
              typeLabel={item.itemType}
            />
            <div
              className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold backdrop-blur-sm ${
                item.predictedRating >= 7
                  ? "bg-green-500/80 text-white"
                  : item.predictedRating >= 5
                    ? "bg-yellow-500/80 text-black"
                    : "bg-red-500/80 text-white"
              }`}
            >
              {item.predictedRating}
            </div>
            {item.reason !== "No genre data" && (
              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] text-surface-300 max-w-[90%] truncate">
                {item.reason}
              </div>
            )}
          </div>
        ))}
      </div>

      {data.items.length > 10 && (
        <div className="text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-brand-400 hover:underline"
          >
            {showAll
              ? `Show top 10`
              : `Show all ${data.items.length} items`}
          </button>
        </div>
      )}

      <p className="text-xs text-surface-500 text-center">
        Sorted by predicted rating based on your genre preferences.
        {data.items.length > 0 && ` ${data.total} items in watchlist.`}
      </p>
    </div>
  );
}
