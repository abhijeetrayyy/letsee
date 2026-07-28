"use client";

import { useEffect, useState, useRef } from "react";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { Film, Tv, Clock, Star, TrendingUp, Calendar, Camera } from "lucide-react";

interface YearInReviewData {
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
}

interface YearInReviewProps {
  username: string;
  profileId: string;
  avatarUrl: string;
}

export default function YearInReview({ username, profileId, avatarUrl }: YearInReviewProps) {
  const [data, setData] = useState<YearInReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useMediaInteraction();

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }

    fetch(`/api/profile/stats/dashboard?userId=${encodeURIComponent(profileId)}`, {
      cache: "no-store",
    })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        const inner = d?.data ?? d;
        const yir = inner?.yearInReview;
        if (yir) {
          setData({
            moviesThisYear: yir.moviesThisYear ?? inner?.movieCount ?? 0,
            tvThisYear: yir.tvThisYear ?? inner?.tvShowsCount ?? 0,
            episodesThisYear: yir.episodesThisYear ?? 0,
            totalHoursThisYear: yir.totalHoursThisYear ?? Math.round((inner?.movieCount ?? 0) * 2 + (inner?.tvCount ?? 0) * 8 * 0.75),
            distinctGenresCount: yir.distinctGenresCount ?? inner?.genresExplored ?? 0,
            topGenreThisYear: yir.topGenreThisYear ?? inner?.topGenre ?? null,
            topRatedThisYear: yir.topRatedThisYear ?? [],
            mostWatchedMonth: yir.mostWatchedMonth ?? null,
            mostWatchedDay: yir.mostWatchedDay ?? null,
            totalDaysWatched: yir.totalDaysWatched ?? inner?.daysWatched ?? 0,
            currentYear: yir.currentYear ?? new Date().getFullYear(),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId, isAuthenticated]);

  const handleCapture = async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#1a1a2e",
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `letsee-year-in-review-${data?.currentYear}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // html2canvas might fail, ignore
    }
    setCapturing(false);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700 p-6 animate-pulse">
        <div className="h-6 bg-surface-700 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-surface-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || (data.moviesThisYear === 0 && data.tvThisYear === 0)) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-brand-500" />
          <h3 className="text-lg font-bold text-white">Your Year in Film — {data.currentYear}</h3>
        </div>
        <button
          onClick={handleCapture}
          disabled={capturing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-xs text-surface-300 transition-colors"
        >
          <Camera className="size-3.5" />
          {capturing ? "Saving..." : "Share"}
        </button>
      </div>

      {/* Shareable card */}
      <div
        ref={cardRef}
        className="rounded-2xl p-6 space-y-4"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-700 flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-surface-400 text-lg font-bold">
                {username[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="text-white font-bold text-lg">@{username}</p>
            <p className="text-xs text-surface-400">Year in Review · {data.currentYear}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox icon={<Film className="size-4 text-brand-400" />} value={data.moviesThisYear} label="Movies" />
          <StatBox icon={<Tv className="size-4 text-amber-400" />} value={data.tvThisYear} label="TV Shows" />
          <StatBox icon={<Clock className="size-4 text-blue-400" />} value={`${data.totalHoursThisYear}h`} label="Hours" />
          <StatBox icon={<TrendingUp className="size-4 text-emerald-400" />} value={data.distinctGenresCount} label="Genres" />
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.topGenreThisYear && (
            <div className="rounded-xl bg-white/5 p-3">
              <Star className="size-4 text-amber-400 mb-1" />
              <p className="text-xs text-surface-400">Top Genre</p>
              <p className="text-white font-semibold text-sm">{data.topGenreThisYear}</p>
            </div>
          )}
          {data.mostWatchedMonth && (
            <div className="rounded-xl bg-white/5 p-3">
              <Calendar className="size-4 text-brand-400 mb-1" />
              <p className="text-xs text-surface-400">Most Active Month</p>
              <p className="text-white font-semibold text-sm">{data.mostWatchedMonth}</p>
            </div>
          )}
        </div>

        {/* Top rated */}
        {data.topRatedThisYear.length > 0 && (
          <div>
            <p className="text-xs text-surface-400 mb-2 font-medium">Your Top Rated</p>
            <div className="flex gap-2 overflow-x-auto">
              {data.topRatedThisYear.slice(0, 5).map((item) => (
                <div key={item.itemId} className="shrink-0 text-center">
                  <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center">
                    <Star className="size-5 text-amber-400" />
                  </div>
                  <p className="text-[10px] text-surface-300 mt-1 line-clamp-1">{item.name}</p>
                  <p className="text-[10px] text-amber-400 font-semibold">{item.score}/10</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[10px] text-surface-500 text-center pt-2 border-t border-white/5">
          {data.totalDaysWatched} days of watching · letsee.app
        </p>
      </div>
    </div>
  );
}

function StatBox({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-white font-bold text-lg">{value}</p>
      <p className="text-surface-400 text-[10px] uppercase tracking-wider">{label}</p>
    </div>
  );
}
