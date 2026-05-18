"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type GenreStat = { genre: string; count: number };
type RatingStat = { score: number; count: number };
type YearStat = { year: number; count: number };

export default function StatsSection({
  userId,
  isOwner = false,
  stats,
}: {
  userId: string;
  isOwner?: boolean;
  stats?: {
    watchedCount: number;
    favoriteCount: number;
    watchlistCount: number;
    watchingCount: number;
    watchedThisYear: number;
    movieCount: number;
    tvCount: number;
    episodesCount: number;
  };
}) {
  const [topGenres, setTopGenres] = useState<GenreStat[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<RatingStat[]>([]);
  const [yearlyActivity, setYearlyActivity] = useState<YearStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch genres
      const genresRes = await fetch(
        `/api/profile/stats/genres?userId=${encodeURIComponent(userId)}`
      );
      if (genresRes.ok) {
        const genresData = await genresRes.json();
        setTopGenres(genresData.data ?? []);
      }

      // Fetch rating distribution
      const ratingsRes = await fetch(
        `/api/profile/stats/ratings?userId=${encodeURIComponent(userId)}`
      );
      if (ratingsRes.ok) {
        const ratingsData = await ratingsRes.json();
        setRatingDistribution(ratingsData.data ?? []);
      }

      // Fetch yearly activity
      const yearsRes = await fetch(
        `/api/profile/stats/years?userId=${encodeURIComponent(userId)}`
      );
      if (yearsRes.ok) {
        const yearsData = await yearsRes.json();
        setYearlyActivity(yearsData.data ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-sm text-surface-500 animate-pulse">Loading stats…</p>
      </div>
    );
  }

  const maxGenreCount = Math.max(...topGenres.map((g) => g.count), 1);
  const maxRatingCount = Math.max(...ratingDistribution.map((r) => r.count), 1);
  const maxYearCount = Math.max(...yearlyActivity.map((y) => y.count), 1);

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Watched" value={stats.watchedCount} />
          <StatCard label="This Year" value={stats.watchedThisYear} />
          <StatCard label="Movies" value={stats.movieCount} />
          <StatCard label="TV Shows" value={stats.tvCount} />
          <StatCard label="Episodes" value={stats.episodesCount} />
          <StatCard label="Favorites" value={stats.favoriteCount} />
          <StatCard label="Watchlist" value={stats.watchlistCount} />
          <StatCard label="Watching" value={stats.watchingCount} />
        </div>
      )}

      {/* Top Genres */}
      {topGenres.length > 0 && (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6">
          <h3 className="text-lg font-semibold text-surface-100 mb-4">
            Top Genres
          </h3>
          <div className="space-y-3">
            {topGenres.slice(0, 10).map((genre) => (
              <div key={genre.genre} className="flex items-center gap-3">
                <span className="text-sm text-surface-300 w-32 truncate">
                  {genre.genre}
                </span>
                <div className="flex-1 h-6 bg-surface-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${(genre.count / maxGenreCount) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-surface-400 w-12 text-right">
                  {genre.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rating Distribution */}
      {ratingDistribution.length > 0 && (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6">
          <h3 className="text-lg font-semibold text-surface-100 mb-4">
            Rating Distribution
          </h3>
          <div className="flex items-end gap-2 h-40">
            {ratingDistribution.map((rating) => (
              <div
                key={rating.score}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className="w-full bg-accent-gold/80 rounded-t-sm transition-all duration-500 hover:bg-accent-gold"
                  style={{
                    height: `${(rating.count / maxRatingCount) * 100}%`,
                    minHeight: rating.count > 0 ? "4px" : "0",
                  }}
                />
                <span className="text-xs text-surface-500">{rating.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yearly Activity */}
      {yearlyActivity.length > 0 && (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6">
          <h3 className="text-lg font-semibold text-surface-100 mb-4">
            Yearly Activity
          </h3>
          <div className="flex items-end gap-2 h-40">
            {yearlyActivity.map((year) => (
              <div
                key={year.year}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className="w-full bg-brand-500/80 rounded-t-sm transition-all duration-500 hover:bg-brand-500"
                  style={{
                    height: `${(year.count / maxYearCount) * 100}%`,
                    minHeight: year.count > 0 ? "4px" : "0",
                  }}
                />
                <span className="text-xs text-surface-500">{year.year}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topGenres.length === 0 &&
        ratingDistribution.length === 0 &&
        yearlyActivity.length === 0 && (
          <div className="rounded-xl border border-surface-700/60 bg-surface-900/50 p-12 text-center">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-surface-400 text-sm">
              {isOwner
                ? "No stats yet. Start watching and rating to see your statistics here."
                : "No stats available yet."}
            </p>
          </div>
        )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-surface-400 mt-1 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
