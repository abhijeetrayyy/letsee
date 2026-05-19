"use client";

import { useState } from "react";
import { Film, Tv, Clock, Calendar, Sparkles, Trophy, ChevronDown, ChevronUp } from "lucide-react";

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

export default function ProfileYearInReview({
  review,
  isOwner,
}: {
  review: YearReview;
  isOwner: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-brand-500/20 bg-gradient-to-br from-surface-900 via-surface-900/95 to-brand-950/20 p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-brand-500/5 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none" />

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full relative z-10"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {review.currentYear} in Review
          </h3>
        </div>
        <span className="text-surface-500">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      <div className="grid grid-cols-4 gap-2 mt-3 relative z-10">
        <div className="text-center bg-surface-800/40 rounded-lg p-2">
          <Film className="w-3.5 h-3.5 text-brand-400 mx-auto mb-0.5" />
          <p className="text-sm font-bold text-white">{review.moviesThisYear}</p>
          <p className="text-[9px] text-surface-500 uppercase">Movies</p>
        </div>
        <div className="text-center bg-surface-800/40 rounded-lg p-2">
          <Tv className="w-3.5 h-3.5 text-accent-gold mx-auto mb-0.5" />
          <p className="text-sm font-bold text-white">{review.tvThisYear}</p>
          <p className="text-[9px] text-surface-500 uppercase">Shows</p>
        </div>
        <div className="text-center bg-surface-800/40 rounded-lg p-2">
          <Clock className="w-3.5 h-3.5 text-accent-purple mx-auto mb-0.5" />
          <p className="text-sm font-bold text-white">{review.totalHoursThisYear}h</p>
          <p className="text-[9px] text-surface-500 uppercase">Hours</p>
        </div>
        <div className="text-center bg-surface-800/40 rounded-lg p-2">
          <Calendar className="w-3.5 h-3.5 text-green-400 mx-auto mb-0.5" />
          <p className="text-sm font-bold text-white">{review.totalDaysWatched}</p>
          <p className="text-[9px] text-surface-500 uppercase">Days</p>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-surface-700/30 relative z-10">
          <div className="grid grid-cols-2 gap-2 text-xs text-surface-400">
            <div>
              <span className="text-surface-500">Top genre: </span>
              <span className="text-surface-200">{review.topGenreThisYear ?? "—"}</span>
            </div>
            <div>
              <span className="text-surface-500">Genres explored: </span>
              <span className="text-surface-200">{review.distinctGenresCount}</span>
            </div>
            <div>
              <span className="text-surface-500">Best month: </span>
              <span className="text-surface-200">{review.mostWatchedMonth ?? "—"}</span>
            </div>
            <div>
              <span className="text-surface-500">Favorite day: </span>
              <span className="text-surface-200">{review.mostWatchedDay ?? "—"}</span>
            </div>
          </div>

          {review.topRatedThisYear.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-surface-500 uppercase mb-1 flex items-center gap-1">
                <Trophy className="w-3 h-3 text-accent-gold" /> Top Rated
              </p>
              <div className="flex flex-wrap gap-1.5">
                {review.topRatedThisYear.map((item: { itemId: string; name: string; score: number }) => (
                  <span key={item.itemId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-800/60 rounded text-[10px] text-surface-300 border border-surface-700/50">
                    {item.name} <span className="text-accent-gold font-semibold">{item.score}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isOwner && (
        <div className="mt-2 text-center relative z-10">
          <a href="/app/profile/setup" className="text-[10px] text-brand-400 hover:underline">
            View full dashboard
          </a>
        </div>
      )}
    </div>
  );
}
