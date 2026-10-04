"use client";

import Link from "@components/ui/AppLink";
import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { titlePath } from "@/utils/urls";

type CalendarData = Record<string, Array<{
  show_id: string;
  show_name: string;
  show_image: string | null;
  season_number: number;
  episode_number: number;
  watched_at: string;
}>>;

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - i);

export default function TvCalendarView({
  userId,
  isOwner = false,
}: {
  userId: string;
  isOwner?: boolean;
}) {
  const [data, setData] = useState<CalendarData>({});
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [totalEpisodes, setTotalEpisodes] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId });
      if (selectedYear) params.set("year", selectedYear);
      if (selectedMonth) params.set("month", selectedMonth);

      const res = await fetch(`/api/profile/tv-calendar?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const result = await res.json();
      setData(result.data ?? {});
      setTotalEpisodes(result.totalEpisodes ?? 0);
    } catch (e) {
      console.error(e);
      setData({});
    } finally {
      setLoading(false);
    }
  }, [userId, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedDates = Object.keys(data).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="rounded-xl border border-line-strong/60 bg-raised/40 p-6 flex flex-col items-center justify-center gap-3 min-h-50">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-sm text-ink-500 animate-pulse">Loading calendar…</p>
      </div>
    );
  }

  if (totalEpisodes === 0) {
    return (
      <div className="rounded-xl border border-line-strong/60 bg-raised/50 p-12 text-center">
        <div className="text-4xl mb-4">📅</div>
        <p className="text-ink-400 text-sm">
          {isOwner
            ? "No episodes watched yet. Start tracking your TV shows to see your watch history here."
            : "No watch history available."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedYear}
          onChange={(e) => {
            setSelectedYear(e.target.value);
            setSelectedMonth("");
          }}
          className="bg-overlay border border-line-strong text-ink-200 text-sm py-2 px-3 rounded-lg focus:ring-1 focus:ring-focus outline-none"
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        {selectedYear && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-overlay border border-line-strong text-ink-200 text-sm py-2 px-3 rounded-lg focus:ring-1 focus:ring-focus outline-none"
          >
            <option value="">All months</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>
                {new Date(2000, month - 1).toLocaleDateString(undefined, {
                  month: "long",
                })}
              </option>
            ))}
          </select>
        )}

        <span className="text-sm text-ink-500">
          {totalEpisodes} episode{totalEpisodes !== 1 ? "s" : ""} watched
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {sortedDates.map((date) => {
          const episodes = data[date];
          const dateObj = new Date(date + "T00:00:00");
          const dayName = dateObj.toLocaleDateString(undefined, {
            weekday: "short",
          });
          const monthDay = dateObj.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });

          return (
            <div key={date} className="flex gap-4">
              {/* Date Column */}
              <div className="shrink-0 w-20 text-right pt-1">
                <p className="text-sm font-semibold text-ink-200">{dayName}</p>
                <p className="text-xs text-ink-500">{monthDay}</p>
                <p className="text-xs text-accent mt-0.5">
                  {episodes.length} ep{episodes.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute top-2 left-0 w-3 h-3 rounded-full bg-action border-2 border-page" />
                <div className="absolute top-5 left-1.5 w-px h-full bg-hover/50" />
              </div>

              {/* Episodes */}
              <div className="flex-1 space-y-2 pb-4">
                {episodes.map((ep, idx) => (
                  <Link
                    key={`${ep.show_id}-${ep.season_number}-${ep.episode_number}-${idx}`}
                    href={titlePath("tv", ep.show_id, ep.show_name)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-line-strong/50 bg-raised/40 hover:border-line-bold/60 hover:bg-overlay/50 transition-all group"
                  >
                    {/* Show Poster */}
                    {ep.show_image ? (
                      <img loading="lazy" decoding="async"
                        src={`https://image.tmdb.org/t/p/w92${ep.show_image}`}
                        alt=""
                        className="shrink-0 w-8 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="shrink-0 w-8 h-12 rounded bg-overlay flex items-center justify-center text-ink-600 text-xs">
                        TV
                      </div>
                    )}

                    {/* Episode Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-100 group-hover:text-accent transition-colors line-clamp-1">
                        {ep.show_name}
                      </p>
                      <p className="text-xs text-ink-500">
                        S{ep.season_number}E{ep.episode_number}
                      </p>
                    </div>

                    {/* Watched Time */}
                    <span className="text-xs text-ink-600 shrink-0">
                      {new Date(ep.watched_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
