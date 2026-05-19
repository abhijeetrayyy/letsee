"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type CompatibilityData = {
  compatibility: number;
  genreSimilarity: number;
  ratingCorrelation: number;
  sharedRatings: number;
  genreMatchLevel: "high" | "medium" | "low";
};

export default function FriendCompatibility({ profileId }: { profileId: string }) {
  const [data, setData] = useState<CompatibilityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/compatibility?userId=${encodeURIComponent(profileId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (mounted && d.compatibility !== undefined) setData(d);
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [profileId]);

  if (loading) return null;
  if (!data) return null;

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
        <div className="text-xs text-surface-400 space-y-0.5">
          <p className="font-medium text-surface-200">Taste compatibility</p>
          <p>{data.genreSimilarity}% genre overlap</p>
          {data.sharedRatings > 0 && (
            <p>{data.ratingCorrelation}% rating correlation ({data.sharedRatings} shared)</p>
          )}
        </div>
      </div>
    </div>
  );
}
