"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

type DistributionItem = {
  score: number;
  count: number;
  percentage: number;
};

type RatingData = {
  total: number;
  average: number;
  distribution: DistributionItem[];
};

export default function RatingDistribution({
  itemId,
  itemType,
}: {
  itemId: string;
  itemType: string;
}) {
  const [data, setData] = useState<RatingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rating-distribution?itemId=${itemId}&itemType=${itemType}`)
      .then((r) => r.json())
      .then((result) => {
        if (!cancelled && !result.error) setData(result);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [itemId, itemType]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 backdrop-blur-sm p-5 animate-pulse">
        <div className="h-4 bg-surface-800 rounded w-32 mb-4" />
        <div className="h-20 bg-surface-800 rounded" />
      </div>
    );
  }

  if (!data || data.total === 0) return null;

  const barColors = [
    "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
    "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#3b82f6",
  ];

  const maxCount = Math.max(...data.distribution.map((d) => d.count), 1);

  return (
    <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
          <Star className="w-4 h-4 text-accent-gold" />
          Community Ratings
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-surface-400">
            <span className="text-accent-gold font-bold">{data.average.toFixed(1)}</span> avg
          </span>
          <span className="text-surface-500">
            {data.total} rating{data.total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1 h-24">
        {data.distribution.map((d) => {
          const height = maxCount > 0 ? Math.max(4, (d.count / maxCount) * 100) : 4;
          const pct = d.percentage;
          return (
            <div key={d.score} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80"
                style={{
                  height: `${height}%`,
                  backgroundColor: barColors[d.score - 1],
                  opacity: 0.5 + (pct / 100) * 0.5,
                }}
              />
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-surface-800 border border-surface-700 text-[10px] text-surface-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {d.count} ({pct}%)
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex gap-1 mt-1.5">
        {data.distribution.map((d) => (
          <div key={d.score} className="flex-1 text-center text-[10px] text-surface-600">
            {d.score}
          </div>
        ))}
      </div>
    </div>
  );
}
