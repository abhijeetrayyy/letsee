"use client";

import useSWR from "swr";
import { swrFetcher } from "@/utils/swrFetcher";

type SharedTitle = {
  itemId: string;
  itemType: "movie" | "tv";
  name: string;
  viewers: number;
  totalUsers: number;
};

type CompatibilityData = {
  compatibility: number;
  genreSimilarity: number;
  genreMatchLevel: "high" | "medium" | "low";
  sharedTitles?: SharedTitle[];
  sharedCount?: number;
  icebreaker?: string;
};

export default function FriendCompatibility({ profileId }: { profileId: string }) {
  const { data, isLoading } = useSWR<CompatibilityData>(
    `/api/compatibility?userId=${encodeURIComponent(profileId)}`,
    swrFetcher,
  );

  if (isLoading) return null;
  if (!data || data.compatibility === undefined) return null;

  const levelColor = data.compatibility >= 60
    ? "text-green-400"
    : data.compatibility >= 30
      ? "text-yellow-400"
      : "text-surface-400";

  const levelBg = data.compatibility >= 60
    ? "bg-green-500/10 border-green-500/20"
    : data.compatibility >= 30
      ? "bg-yellow-500/10 border-yellow-500/20"
      : "bg-surface-800/40 border-surface-700/60";

  return (
    <div className={`rounded-xl border ${levelBg} p-4`}>
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14 shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(30 41 59)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke={data.compatibility >= 60 ? "rgb(34 197 94)" : data.compatibility >= 30 ? "rgb(250 204 21)" : "rgb(148 163 184)"}
              strokeWidth="3"
              strokeDasharray={`${data.compatibility} ${100 - data.compatibility}`}
              strokeLinecap="round"
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${levelColor}`}>
            {data.compatibility}%
          </span>
        </div>
        <div className="text-xs text-surface-400 space-y-0.5 min-w-0">
          <p className="font-medium text-surface-200">Taste compatibility</p>
          <p>{data.genreSimilarity}% genre overlap</p>
          {!!data.sharedCount && (
            <p>
              {data.sharedCount} title{data.sharedCount === 1 ? "" : "s"} in common
            </p>
          )}
        </div>
      </div>

      {/* The rarity evidence — a far stronger signal than the percentage. */}
      {!!data.sharedTitles?.length && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-surface-300">{data.icebreaker}</p>
          {data.sharedTitles.length > 1 && (
            <p className="mt-1 text-[11px] text-surface-500">
              Also both seen: {data.sharedTitles.slice(1).map((t) => t.name).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
