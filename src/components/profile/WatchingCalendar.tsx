"use client";

import { useEffect, useState } from "react";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";

interface CalendarDay {
  date: string;
  count: number;
}

export default function WatchingCalendar() {
  const [data, setData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useMediaInteraction();

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetch("/api/profile/tv-calendar", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const days = d.data ?? d.entries ?? [];
        setData(days);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (loading || !data.length) return null;

  // Build 52-week x 7-day grid (GitHub-style)
  const today = new Date();
  const weeks = 20;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - weeks * 7);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const dayMap = new Map<string, number>();
  for (const d of data) {
    dayMap.set(d.date, d.count);
  }

  const grid: { date: Date; count: number }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: { date: Date; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + w * 7 + d);
      const key = date.toISOString().slice(0, 10);
      week.push({ date, count: dayMap.get(key) ?? 0 });
    }
    grid.push(week);
  }

  const maxCount = Math.max(1, ...data.map((d) => d.count));

  function getColor(count: number): string {
    if (count === 0) return "bg-neutral-800";
    const intensity = count / maxCount;
    if (intensity <= 0.25) return "bg-brand-900/40";
    if (intensity <= 0.5) return "bg-brand-700/60";
    if (intensity <= 0.75) return "bg-brand-600/80";
    return "bg-brand-500";
  }

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-1 h-5 rounded-full bg-brand-500 shrink-0" />
        <h3 className="text-sm font-semibold text-white">Watching Activity</h3>
      </div>

      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1">
          {dayLabels.map((label, i) => (
            <div
              key={i}
              className="h-3 w-5 text-[10px] text-neutral-500 flex items-center"
              style={{ lineHeight: "12px" }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex gap-1">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`h-3 w-3 rounded-sm ${getColor(day.count)} transition-colors`}
                  title={`${day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${day.count} episodes`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-xs text-neutral-500">
        <span>Less</span>
        <div className="h-3 w-3 rounded-sm bg-neutral-800" />
        <div className="h-3 w-3 rounded-sm bg-brand-900/40" />
        <div className="h-3 w-3 rounded-sm bg-brand-700/60" />
        <div className="h-3 w-3 rounded-sm bg-brand-600/80" />
        <div className="h-3 w-3 rounded-sm bg-brand-500" />
        <span>More</span>
      </div>
    </div>
  );
}
