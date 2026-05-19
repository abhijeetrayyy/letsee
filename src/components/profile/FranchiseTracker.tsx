"use client";

import { useState, useEffect } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import Link from "next/link";

type Entry = {
  id: number;
  title: string;
  type: "movie" | "tv";
  year: number;
  tmdbId: number;
  watched: boolean;
};

type FranchiseData = {
  franchiseId: string;
  name: string;
  total: number;
  completed: number;
  percentage: number;
  nextUp: Entry | null;
  entries: Entry[];
};

export default function FranchiseTracker() {
  const [franchises, setFranchises] = useState<FranchiseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/franchises")
      .then((r) => r.json())
      .then((d) => setFranchises(d.franchises ?? []))
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

  if (franchises.length === 0) return null;

  return (
    <div className="space-y-3">
      {franchises.map((f) => (
        <div
          key={f.franchiseId}
          className="rounded-xl border border-surface-700/60 bg-surface-900/40 overflow-hidden"
        >
          <button
            onClick={() => setExpanded(expanded === f.franchiseId ? null : f.franchiseId)}
            className="w-full flex items-center gap-4 p-4 hover:bg-surface-800/30 transition-colors text-left"
          >
            <div className="relative w-12 h-12 shrink-0">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(30 41 59)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke={f.percentage >= 80 ? "rgb(34 197 94)" : f.percentage >= 40 ? "rgb(250 204 21)" : "rgb(96 165 250)"}
                  strokeWidth="3"
                  strokeDasharray={`${f.percentage} ${100 - f.percentage}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                {f.percentage}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-surface-200 truncate">{f.name}</h4>
              <p className="text-xs text-surface-500">
                {f.completed}/{f.total} entries
                {f.nextUp && <span className="ml-2 text-brand-400">Next: {f.nextUp.title}</span>}
              </p>
            </div>
            <svg className={`w-4 h-4 text-surface-400 transition-transform ${expanded === f.franchiseId ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded === f.franchiseId && (
            <div className="px-4 pb-4 space-y-1 max-h-60 overflow-y-auto">
              {f.entries.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/app/${entry.type}/${entry.tmdbId}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-800/50 transition-colors group"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    entry.watched
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : "border-surface-600 group-hover:border-surface-500"
                  }`}>
                    {entry.watched && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs flex-1 truncate ${entry.watched ? "text-surface-400" : "text-surface-200"}`}>
                    {entry.title}
                  </span>
                  <span className="text-[10px] text-surface-600">{entry.year}</span>
                  <span className={`text-[10px] uppercase ${entry.type === "tv" ? "text-accent-purple" : "text-brand-400"}`}>
                    {entry.type}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
