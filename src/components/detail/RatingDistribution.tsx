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
      <div className="glass-card rounded-2xl p-5 animate-pulse">
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
    <div className="card-accent rounded-2xl p-5 animate-fade-up stagger-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
          <h3 className="text-sm font-semibold text-surface-100">Community Ratings</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-accent-gold">{data.average.toFixed(1)}</span>
            <span className="text-xs text-surface-500">avg</span>
          </div>
          <span className="text-xs text-surface-500 bg-surface-800/50 px-2.5 py-1 rounded-full">
            {data.total} rating{data.total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-1 h-24">
        {data.distribution.map((d) => {
          const height = maxCount > 0 ? Math.max(4, (d.count / maxCount) * 100) : 4;
          const pct = d.percentage;
          return (
            <div key={d.score} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80 cursor-pointer"
                style={{
                  height: `${height}%`,
                  backgroundColor: barColors[d.score - 1],
                  opacity: 0.5 + (pct / 100) * 0.5,
                }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-surface-800 border border-surface-700 text-[10px] text-surface-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                {d.count} ({pct}%)
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 mt-1.5">
        {data.distribution.map((d) => (
          <div key={d.score} className="flex-1 text-center text-[10px] text-surface-600 font-medium">
            {d.score}
          </div>
        ))}
      </div>
    </div>
  );
}
