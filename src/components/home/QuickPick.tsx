"use client";

import { useState } from "react";
import useSWR from "swr";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { Loader2, MonitorPlay, Shuffle, Star } from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";

interface WatchlistSuggestion {
  itemId: string;
  itemName: string;
  itemType: string;
  imageUrl: string | null;
  predictedRating: number;
  reason: string;
}

interface QuickPickProps {
  profileId?: string;
}

export default function QuickPick({ profileId }: QuickPickProps) {
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const { isAuthenticated } = useMediaInteraction();

  const params = profileId ? `?userId=${encodeURIComponent(profileId)}` : "";
  const { data, isLoading } = useSWR<{ items: WatchlistSuggestion[] }>(
    isAuthenticated ? `/api/watchlist/smart${params}` : null,
    swrFetcher,
  );
  const items = (data?.items ?? []).slice(0, 12);
  const loading = isAuthenticated && isLoading;

  const handleRandomPick = () => {
    if (!items.length) return;
    const idx = Math.floor(Math.random() * items.length);
    setPickedIndex(idx);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-surface-400 py-4">
        <Loader2 className="size-4 animate-spin" />
        Finding your next watch...
      </div>
    );
  }

  if (!items.length) return null;

  const sorted = [...items].sort((a, b) => b.predictedRating - a.predictedRating);
  const topPick = sorted[0];
  const picked = pickedIndex !== null ? items[pickedIndex] : null;

  return (
    <div className="rounded-xl border border-brand-500/10 bg-brand-500/3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <MonitorPlay className="size-4 text-brand-400" />
        <span className="text-sm font-semibold text-brand-400">What to Watch Tonight</span>
      </div>

      {/* Random pick button */}
      <button
        onClick={handleRandomPick}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 border border-brand-500/20 transition-all mb-3 group"
      >
        <Shuffle className="size-4 group-hover:animate-spin" />
        <span className="text-sm font-medium">Pick something for me</span>
      </button>

      {/* Picked item */}
      {picked && (
        <a
          href={`/app/${picked.itemType}/${picked.itemId}`}
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50 hover:bg-surface-700/50 transition-colors mb-3"
        >
          <div className="w-16 h-10 rounded-lg bg-surface-700 overflow-hidden flex-shrink-0">
            {picked.imageUrl ? (
              <img src={picked.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MonitorPlay className="size-5 text-surface-500" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{picked.itemName}</p>
            <div className="flex items-center gap-2 text-xs text-surface-400 mt-0.5">
              <Star className="size-3 text-amber-400 fill-amber-400" />
              <span className="text-amber-400 font-semibold">{picked.predictedRating}/10</span>
              <span>predicted</span>
            </div>
            <p className="text-[10px] text-surface-500 mt-0.5">{picked.reason}</p>
          </div>
        </a>
      )}

      {/* Top suggestions */}
      {topPick && !picked && (
        <div>
          <p className="text-xs text-surface-500 mb-2">Your top match based on taste</p>
          <a
            href={`/app/${topPick.itemType}/${topPick.itemId}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50 hover:bg-surface-700/50 transition-colors"
          >
            <div className="w-16 h-10 rounded-lg bg-surface-700 overflow-hidden flex-shrink-0">
              {topPick.imageUrl ? (
                <img src={topPick.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <MonitorPlay className="size-5 text-surface-500" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{topPick.itemName}</p>
              <div className="flex items-center gap-2 text-xs text-surface-400 mt-0.5">
                <Star className="size-3 text-amber-400 fill-amber-400" />
                <span className="text-amber-400 font-semibold">{topPick.predictedRating}/10</span>
                <span>predicted</span>
              </div>
            </div>
          </a>
        </div>
      )}

      <p className="text-[10px] text-surface-500 mt-3">
        Based on your ratings · {items.length} items in watchlist
      </p>
    </div>
  );
}
