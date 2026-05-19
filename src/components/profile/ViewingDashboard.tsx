"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import html2canvas from "html2canvas";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Tooltip, Legend, Title,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Download, Sparkles, Calendar, Film, Tv, Clock, Trophy, TrendingUp } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title);

type YearReview = {
  moviesThisYear: number;
  tvThisYear: number;
  episodesThisYear: number;
  totalHoursThisYear: number;
  distinctGenresCount: number;
  topGenreThisYear: string | null;
  topRatedThisYear: { itemId: string; name: string; itemType: string; score: number }[];
  mostWatchedMonth: string | null;
  mostWatchedDay: string | null;
  totalDaysWatched: number;
  currentYear: number;
};

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
    watchedCount: number; favoriteCount: number; watchlistCount: number;
    watchingCount: number; episodesCount: number; totalHours: number;
    movieCount: number; tvCount: number;
  };
  genres: GenreStat[]; ratingDistribution: RatingStat[];
  yearlyActivity: YearStat[]; monthlyActivity: MonthStat[];
  weekdayDistribution: WeekdayStat[];
  streaks: StreakInfo; avgRatingPerGenre: GenreRating[];
  topRated: TopItem[]; tvCompletion: TvCompletion | null;
  yearInReview: YearReview | null;
};

const chartDefaults = (
  color: string,
  hoverColor: string,
  label: string,
) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      titleColor: "#e2e8f0",
      bodyColor: "#94a3b8",
      borderColor: "rgba(51, 65, 85, 0.5)",
      borderWidth: 1,
      padding: 8,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#64748b", font: { size: 10 } },
    },
    y: {
      grid: { color: "rgba(51, 65, 85, 0.3)" },
      ticks: { color: "#64748b", font: { size: 10 }, stepSize: 1 },
      beginAtZero: true,
    },
  },
});

const barDataset = (
  data: number[],
  bg: string,
  hover: string,
) => ({
  data,
  backgroundColor: bg,
  hoverBackgroundColor: hover,
  borderRadius: 4,
  borderSkipped: false,
  maxBarThickness: 32,
});

function OverviewCard({ label, value, icon, accent }: { label: string; value: number | string; icon?: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 backdrop-blur-sm p-4 text-center hover:border-surface-600/60 transition-all duration-300">
      {icon && <div className={`flex justify-center mb-2 ${accent ?? "text-brand-400"}`}>{icon}</div>}
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-surface-400 mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function YearInReviewCard({ review }: { review: YearReview }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0f172a",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `letsee-${review.currentYear}-review.png`;
      link.href = canvas.toDataURL();
      link.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative group">
      <div ref={cardRef} className="rounded-xl bg-gradient-to-br from-surface-900 via-surface-900/95 to-brand-950/30 border border-brand-500/20 p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-500/5 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent-gold/5 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {review.currentYear} in Review
            </h3>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 rounded-lg border border-brand-500/20 transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Exporting..." : "Export"}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
          <div className="text-center bg-surface-800/40 rounded-lg p-3">
            <Film className="w-4 h-4 text-brand-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{review.moviesThisYear}</p>
            <p className="text-[10px] text-surface-400 uppercase">Movies</p>
          </div>
          <div className="text-center bg-surface-800/40 rounded-lg p-3">
            <Tv className="w-4 h-4 text-accent-gold mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{review.tvThisYear}</p>
            <p className="text-[10px] text-surface-400 uppercase">Shows</p>
          </div>
          <div className="text-center bg-surface-800/40 rounded-lg p-3">
            <Clock className="w-4 h-4 text-accent-purple mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{review.totalHoursThisYear}h</p>
            <p className="text-[10px] text-surface-400 uppercase">Hours</p>
          </div>
          <div className="text-center bg-surface-800/40 rounded-lg p-3">
            <Calendar className="w-4 h-4 text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{review.totalDaysWatched}</p>
            <p className="text-[10px] text-surface-400 uppercase">Days Watched</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 relative z-10">
          <div className="text-center bg-surface-800/40 rounded-lg p-2.5">
            <p className="text-[10px] text-surface-500 uppercase">Top Genre</p>
            <p className="text-sm font-semibold text-surface-200 truncate">{review.topGenreThisYear ?? "—"}</p>
          </div>
          <div className="text-center bg-surface-800/40 rounded-lg p-2.5">
            <p className="text-[10px] text-surface-500 uppercase">Genres Explored</p>
            <p className="text-sm font-semibold text-surface-200">{review.distinctGenresCount}</p>
          </div>
          <div className="text-center bg-surface-800/40 rounded-lg p-2.5">
            <p className="text-[10px] text-surface-500 uppercase">Best Month</p>
            <p className="text-sm font-semibold text-surface-200">{review.mostWatchedMonth ?? "—"}</p>
          </div>
          <div className="text-center bg-surface-800/40 rounded-lg p-2.5">
            <p className="text-[10px] text-surface-500 uppercase">Favorite Day</p>
            <p className="text-sm font-semibold text-surface-200">{review.mostWatchedDay ?? "—"}</p>
          </div>
        </div>

        {review.topRatedThisYear.length > 0 && (
          <div className="mt-3 relative z-10">
            <p className="text-[10px] text-surface-500 uppercase mb-1.5 flex items-center gap-1">
              <Trophy className="w-3 h-3 text-accent-gold" /> Top Rated This Year
            </p>
            <div className="flex flex-wrap gap-2">
              {review.topRatedThisYear.map((item) => (
                <span key={item.itemId} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-800/60 rounded-full text-xs text-surface-300 border border-surface-700/50">
                  {item.name}
                  <span className="text-accent-gold font-semibold">{item.score}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const dashboardRef = useRef<HTMLDivElement>(null);

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
    } catch {
      setError("Network error loading dashboard");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleExportAll = async () => {
    if (!dashboardRef.current) return;
    const canvas = await html2canvas(dashboardRef.current, {
      backgroundColor: "#0f172a",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `letsee-dashboard-${userId.slice(0, 8)}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

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
        <button onClick={fetchDashboard} className="mt-3 text-xs text-brand-400 hover:underline">Try again</button>
      </div>
    );
  }

  if (!data) return null;

  const {
    overview, genres, ratingDistribution, yearlyActivity, monthlyActivity,
    weekdayDistribution, streaks, avgRatingPerGenre, topRated, tvCompletion, yearInReview,
  } = data;

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
    <div ref={dashboardRef} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-surface-100">Viewing Dashboard</h2>
          <p className="text-xs text-surface-500 mt-0.5">Your personal viewing analytics</p>
        </div>
        <button
          onClick={handleExportAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-lg border border-surface-700/50 transition-all"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Year in Review */}
      {yearInReview && <YearInReviewCard review={yearInReview} />}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <OverviewCard label="Movies Watched" value={overview.movieCount} icon={<Film className="w-5 h-5" />} accent="text-brand-400" />
        <OverviewCard label="TV Shows" value={overview.tvCount} icon={<Tv className="w-5 h-5" />} accent="text-accent-gold" />
        <OverviewCard label="Episodes" value={overview.episodesCount} icon={<Calendar className="w-5 h-5" />} accent="text-accent-purple" />
        <OverviewCard label="Total Hours" value={`${overview.totalHours}h`} icon={<Clock className="w-5 h-5" />} accent="text-green-400" />
      </div>

      {/* Streaks + Favorites */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 p-4 text-center">
          <p className="text-2xl font-bold text-brand-400">{streaks.current}</p>
          <p className="text-xs text-surface-400 mt-0.5 uppercase tracking-wider">Current Streak</p>
        </div>
        <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 p-4 text-center">
          <p className="text-2xl font-bold text-accent-gold">{streaks.longest}</p>
          <p className="text-xs text-surface-400 mt-0.5 uppercase tracking-wider">Longest Streak</p>
        </div>
        <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 p-4 text-center">
          <p className="text-2xl font-bold text-accent-purple">{overview.favoriteCount}</p>
          <p className="text-xs text-surface-400 mt-0.5 uppercase tracking-wider">Favorites</p>
        </div>
        <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{overview.watchlistCount}</p>
          <p className="text-xs text-surface-400 mt-0.5 uppercase tracking-wider">Watchlist</p>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Monthly Activity */}
        {monthlyActivity.length > 0 && (
          <ChartCard title="This Year" subtitle="Monthly watches">
            <div className="h-32">
              <Bar
                data={{
                  labels: monthlyActivity.map((m) => m.label),
                  datasets: [barDataset(
                    monthlyActivity.map((m) => m.count),
                    "rgba(139, 92, 246, 0.6)",
                    "rgba(139, 92, 246, 0.9)",
                  )],
                }}
                options={{
                  ...chartDefaults("rgba(139, 92, 246, 0.6)", "rgba(139, 92, 246, 0.9)", "Watched"),
                  plugins: { ...chartDefaults("", "", "").plugins, legend: { display: false } },
                }}
              />
            </div>
          </ChartCard>
        )}

        {/* Yearly Activity */}
        {yearlyActivity.length > 0 && (
          <ChartCard title="Yearly Activity" subtitle="Movies vs TV per year">
            <div className="h-32">
              <Bar
                data={{
                  labels: yearlyActivity.map((y) => String(y.year)),
                  datasets: [
                    barDataset(
                      yearlyActivity.map((y) => y.movieCount),
                      "rgba(139, 92, 246, 0.6)",
                      "rgba(139, 92, 246, 0.9)",
                    ),
                    barDataset(
                      yearlyActivity.map((y) => y.tvCount),
                      "rgba(251, 191, 36, 0.6)",
                      "rgba(251, 191, 36, 0.9)",
                    ),
                  ],
                }}
                options={{
                  ...chartDefaults("", "", ""),
                  plugins: {
                    legend: {
                      display: true,
                      position: "top",
                      labels: { color: "#94a3b8", boxWidth: 10, padding: 8, font: { size: 10 } },
                    },
                    tooltip: chartDefaults("", "", "").plugins.tooltip,
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 10 } }, stacked: false },
                    y: { grid: { color: "rgba(51, 65, 85, 0.3)" }, ticks: { color: "#64748b", font: { size: 10 }, stepSize: 1 }, beginAtZero: true },
                  },
                }}
              />
            </div>
          </ChartCard>
        )}
      </div>

      {/* Weekday Distribution */}
      {weekdayDistribution.some((w) => w.count > 0) && (
        <ChartCard title="Watching Habits" subtitle="What day you watch most">
          <div className="h-28">
            <Bar
              data={{
                labels: weekdayDistribution.map((w) => w.day),
                datasets: [barDataset(
                  weekdayDistribution.map((w) => w.count),
                  "rgba(34, 211, 238, 0.5)",
                  "rgba(34, 211, 238, 0.8)",
                )],
              }}
              options={{
                ...chartDefaults("rgba(34, 211, 238, 0.5)", "rgba(34, 211, 238, 0.8)", ""),
                plugins: { ...chartDefaults("", "", "").plugins, legend: { display: false } },
              }}
            />
          </div>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Genres */}
        {genres.length > 0 && (
          <ChartCard title="Top Genres" subtitle="What you watch most">
            <div className="h-48">
              <Bar
                data={{
                  labels: genres.slice(0, 8).map((g) => g.genre),
                  datasets: [barDataset(
                    genres.slice(0, 8).map((g) => g.count),
                    "rgba(139, 92, 246, 0.6)",
                    "rgba(139, 92, 246, 0.9)",
                  )],
                }}
                options={{
                  ...chartDefaults("", "", ""),
                  indexAxis: "y" as const,
                  plugins: { ...chartDefaults("", "", "").plugins, legend: { display: false } },
                  scales: {
                    x: { grid: { color: "rgba(51, 65, 85, 0.3)" }, ticks: { color: "#64748b", font: { size: 10 }, stepSize: 1 }, beginAtZero: true },
                    y: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 10 } } },
                  },
                }}
              />
            </div>
          </ChartCard>
        )}

        {/* Rating Distribution */}
        {ratingDistribution.length > 0 && (
          <ChartCard title="Rating Distribution" subtitle="How you rate">
            <div className="h-48">
              <Bar
                data={{
                  labels: ratingDistribution.map((r) => String(r.score)),
                  datasets: [barDataset(
                    ratingDistribution.map((r) => r.count),
                    "rgba(251, 191, 36, 0.6)",
                    "rgba(251, 191, 36, 0.9)",
                  )],
                }}
                options={{
                  ...chartDefaults("", "", ""),
                  plugins: { ...chartDefaults("", "", "").plugins, legend: { display: false } },
                }}
              />
            </div>
          </ChartCard>
        )}
      </div>

      {/* Average Rating by Genre */}
      {avgRatingPerGenre.length > 0 && (
        <ChartCard title="Average Rating by Genre" subtitle="What genres you rate highest">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {avgRatingPerGenre.slice(0, 12).map((g) => (
              <div key={g.genre} className="flex items-center justify-between bg-surface-800/40 rounded-lg px-3 py-2 hover:bg-surface-800/60 transition-colors">
                <span className="text-xs text-surface-300 truncate mr-2">{g.genre}</span>
                <span className="text-sm font-semibold text-accent-gold shrink-0">{g.avgRating}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* TV Completion Rate */}
      {tvCompletion && (
        <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-3 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" /> TV Completion Rate
          </h3>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(30 41 59)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none" stroke="rgb(34 197 94)"
                  strokeWidth="3" strokeDasharray={`${tvCompletion.rate} ${100 - tvCompletion.rate}`}
                  strokeLinecap="round" className="transition-all duration-700"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{tvCompletion.rate}%</span>
            </div>
            <div className="text-sm text-surface-400 space-y-0.5">
              <p><span className="text-white font-semibold">{tvCompletion.completed}</span> completed</p>
              <p><span className="text-white font-semibold">{tvCompletion.total - tvCompletion.completed}</span> in progress / on hold</p>
              <p className="text-xs text-surface-500">{tvCompletion.total} total shows</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Rated Items */}
      {topRated.length > 0 && (
        <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold text-surface-200 mb-3 uppercase tracking-wider">Highest Rated</h3>
          <div className="space-y-1.5">
            {topRated.map((item, i) => (
              <div
                key={`${item.itemType}:${item.itemId}`}
                className="flex items-center justify-between bg-surface-800/40 rounded-lg px-4 py-2.5 hover:bg-surface-800/60 transition-colors"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] text-surface-500 uppercase w-10 shrink-0">{item.itemType}</span>
                  <span className="text-sm text-surface-200 truncate">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-accent-gold shrink-0 ml-3">{item.score}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 backdrop-blur-sm p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">{title}</h3>
        <span className="text-[10px] text-surface-500">{subtitle}</span>
      </div>
      {children}
    </div>
  );
}
