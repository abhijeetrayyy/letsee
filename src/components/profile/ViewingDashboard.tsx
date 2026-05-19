"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type GenreStat = { genre: string; count: number; percentage: number };
type RatingStat = { score: number; count: number };
type YearStat = { year: number; count: number; movieCount: number; tvCount: number };
type MonthStat = { month: number; count: number; label: string };
type WeekdayStat = { day: string; count: number };
type StreakInfo = { current: number; longest: number };
type GenreRating = { genre: string; avgRating: number; count: number };
type TopItem = { itemId: string; name: string; itemType: string; score: number; imageUrl: string | null };
type TvCompletion = { completed: number; total: number; rate: number };

type DashboardData = {
  overview: {
    watchedCount: number;
    favoriteCount: number;
    watchlistCount: number;
    watchingCount: number;
    episodesCount: number;
    totalHours: number;
    movieCount: number;
    tvCount: number;
  };
  genres: GenreStat[];
  ratingDistribution: RatingStat[];
  yearlyActivity: YearStat[];
  monthlyActivity: MonthStat[];
  weekdayDistribution: WeekdayStat[];
  streaks: StreakInfo;
  avgRatingPerGenre: GenreRating[];
  topRated: TopItem[];
  tvCompletion: TvCompletion | null;
};

export default function ViewingDashboard({
  userId,
  isOwner = false,
}: {
  userId: string;
  isOwner?: boolean;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/profile/stats/dashboard?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load dashboard");
        return;
      }
      const json = await res.json();
      setData(json.data);
    } catch (e) {
      setError("Network error loading dashboard");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-12 flex flex-col items-center justify-center gap-3 min-h-[300px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-sm text-surface-500 animate-pulse">Analyzing your viewing habits...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-800/40 bg-red-900/20 p-8 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={fetchDashboard} className="mt-3 text-xs text-brand-400 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { overview, genres, ratingDistribution, yearlyActivity, monthlyActivity, weekdayDistribution, streaks, avgRatingPerGenre, topRated, tvCompletion } = data;

  const maxRatingCount = Math.max(...ratingDistribution.map((r) => r.count), 1);
  const maxYearCount = Math.max(...yearlyActivity.map((y) => y.count), 1);
  const maxMonthCount = Math.max(...monthlyActivity.map((m) => m.count), 1);
  const maxWeekdayCount = Math.max(...weekdayDistribution.map((w) => w.count), 1);
  const maxGenreCount = Math.max(...genres.map((g) => g.count), 1);

  const isEmpty = overview.watchedCount === 0;

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-12 text-center">
        <div className="text-5xl mb-4">📊</div>
        <p className="text-surface-400 text-sm">
          {isOwner
            ? "Start watching and rating to unlock your personalized viewing dashboard."
            : "No dashboard data available yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <OverviewCard label="Movies Watched" value={overview.movieCount} />
        <OverviewCard label="TV Shows" value={overview.tvCount} />
        <OverviewCard label="Episodes" value={overview.episodesCount} />
        <OverviewCard label="Total Hours" value={overview.totalHours} suffix="h" />
      </div>

      {/* Streaks Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-4 text-center">
          <p className="text-3xl font-bold text-brand-400">{streaks.current}</p>
          <p className="text-xs text-surface-400 mt-1 uppercase tracking-wider">Current Streak (days)</p>
        </div>
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-4 text-center">
          <p className="text-3xl font-bold text-accent-gold">{streaks.longest}</p>
          <p className="text-xs text-surface-400 mt-1 uppercase tracking-wider">Longest Streak (days)</p>
        </div>
      </div>

      {/* Monthly Activity (Current Year) */}
      {monthlyActivity.length > 0 && (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 uppercase tracking-wider">
            This Year
          </h3>
          <div className="flex items-end gap-1.5 h-28">
            {monthlyActivity.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-brand-500/80 rounded-t-sm transition-all duration-500 hover:bg-brand-500"
                  style={{ height: `${(m.count / maxMonthCount) * 100}%`, minHeight: m.count > 0 ? "3px" : "0" }}
                />
                <span className="text-[10px] text-surface-500">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yearly Activity */}
      {yearlyActivity.length > 0 && (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 uppercase tracking-wider">
            Yearly Activity
          </h3>
          <div className="flex items-end gap-1.5 h-28">
            {yearlyActivity.map((y) => (
              <div key={y.year} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-accent-gold/70 rounded-t-sm transition-all duration-500 hover:bg-accent-gold"
                  style={{ height: `${(y.count / maxYearCount) * 100}%`, minHeight: y.count > 0 ? "3px" : "0" }}
                />
                <span className="text-[10px] text-surface-500">{y.year}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs text-surface-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-500" /> Movies
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-gold" /> TV
            </span>
          </div>
        </div>
      )}

      {/* Weekday Distribution */}
      {weekdayDistribution.some((w) => w.count > 0) && (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 uppercase tracking-wider">
            Watching Habits
          </h3>
          <div className="flex items-end gap-1.5 h-24">
            {weekdayDistribution.map((w) => (
              <div key={w.day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-accent-purple/70 rounded-t-sm transition-all duration-500 hover:bg-accent-purple"
                  style={{ height: `${(w.count / maxWeekdayCount) * 100}%`, minHeight: w.count > 0 ? "3px" : "0" }}
                />
                <span className="text-[10px] text-surface-500">{w.day}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Genres */}
        {genres.length > 0 && (
          <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-5">
            <h3 className="text-sm font-semibold text-surface-200 mb-4 uppercase tracking-wider">
              Top Genres
            </h3>
            <div className="space-y-2.5">
              {genres.slice(0, 8).map((g) => (
                <div key={g.genre} className="flex items-center gap-2.5">
                  <span className="text-xs text-surface-300 w-28 truncate shrink-0">{g.genre}</span>
                  <div className="flex-1 h-5 bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max((g.count / maxGenreCount) * 100, 3)}%` }}
                    />
                  </div>
                  <span className="text-xs text-surface-500 w-10 text-right shrink-0">{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rating Distribution */}
        {ratingDistribution.length > 0 && (
          <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-5">
            <h3 className="text-sm font-semibold text-surface-200 mb-4 uppercase tracking-wider">
              Rating Distribution
            </h3>
            <div className="flex items-end gap-1 h-36">
              {ratingDistribution.map((r) => (
                <div key={r.score} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-accent-gold/80 rounded-t-sm transition-all duration-500 hover:bg-accent-gold"
                    style={{ height: `${(r.count / maxRatingCount) * 100}%`, minHeight: r.count > 0 ? "3px" : "0" }}
                  />
                  <span className="text-[10px] text-surface-500">{r.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Average Rating by Genre */}
      {avgRatingPerGenre.length > 0 && (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 uppercase tracking-wider">
            Average Rating by Genre
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {avgRatingPerGenre.slice(0, 12).map((g) => (
              <div key={g.genre} className="flex items-center justify-between bg-surface-800/40 rounded-lg px-3 py-2">
                <span className="text-xs text-surface-300 truncate mr-2">{g.genre}</span>
                <span className="text-sm font-semibold text-accent-gold shrink-0">{g.avgRating}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TV Completion Rate */}
      {tvCompletion && (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 uppercase tracking-wider">
            TV Completion Rate
          </h3>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(30 41 59)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none" stroke="rgb(34 197 94)"
                  strokeWidth="3" strokeDasharray={`${tvCompletion.rate} ${100 - tvCompletion.rate}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                {tvCompletion.rate}%
              </span>
            </div>
            <div className="text-sm text-surface-400">
              <p><span className="text-white font-semibold">{tvCompletion.completed}</span> completed</p>
              <p><span className="text-white font-semibold">{tvCompletion.total - tvCompletion.completed}</span> in progress / on hold</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Rated Items */}
      {topRated.length > 0 && (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-4 uppercase tracking-wider">
            Highest Rated
          </h3>
          <div className="space-y-2">
            {topRated.map((item) => (
              <div key={`${item.itemType}:${item.itemId}`} className="flex items-center justify-between bg-surface-800/40 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-surface-500 uppercase w-10">{item.itemType}</span>
                  <span className="text-sm text-surface-200">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-accent-gold">{item.score}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-4 text-center">
      <p className="text-2xl font-bold text-white">
        {value}
        {suffix && <span className="text-sm text-surface-400 ml-0.5">{suffix}</span>}
      </p>
      <p className="text-[11px] text-surface-400 mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}
