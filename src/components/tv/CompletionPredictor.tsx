"use client";

import { useState, useEffect } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import Link from "next/link";

type Prediction = {
  showId: string;
  showName: string;
  posterUrl: string | null;
  totalEpisodes: number;
  watchedEpisodes: number;
  remainingEpisodes: number;
  episodesPerDay: number;
  estimatedDaysRemaining: number;
  estimatedCompletionDate: string;
  estimatedHoursRemaining: number;
  showStatus: string;
};

export default function CompletionPredictor() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tv/completion-predictor")
      .then((r) => r.json())
      .then((d) => {
        setPredictions(d.predictions ?? []);
        if (d.note) setNote(d.note);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" className="border-t-white" />
      </div>
    );
  }

  if (note || predictions.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6 text-center">
        <p className="text-surface-400 text-sm">{note ?? "No TV shows in progress to predict."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {predictions.map((p) => {
        const progressPct = p.totalEpisodes > 0 ? Math.round((p.watchedEpisodes / p.totalEpisodes) * 100) : 0;
        const urgent = p.estimatedDaysRemaining <= 3;
        const soon = p.estimatedDaysRemaining <= 14 && !urgent;

        return (
          <Link
            key={p.showId}
            href={`/app/tv/${p.showId}`}
            className="block rounded-xl border border-surface-700/60 bg-surface-900/40 p-4 hover:bg-surface-800/40 transition-colors"
          >
            <div className="flex items-center gap-4">
              {p.posterUrl && (
                <img src={p.posterUrl} alt="" className="w-10 h-14 rounded object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-surface-200 truncate">{p.showName}</h4>
                  {urgent && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 shrink-0">Almost done!</span>}
                  {soon && !urgent && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 shrink-0">2 weeks left</span>}
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-surface-400">
                  <span>{p.watchedEpisodes}/{p.totalEpisodes} eps</span>
                  <span>{p.estimatedHoursRemaining}h remaining</span>
                  {p.episodesPerDay > 0 && <span>{p.episodesPerDay}/day pace</span>}
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progressPct >= 80 ? "bg-green-500" : progressPct >= 40 ? "bg-brand-500" : "bg-accent-gold"
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-surface-500 shrink-0">
                    {urgent ? "Due " : "Done by "}{p.estimatedCompletionDate}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
