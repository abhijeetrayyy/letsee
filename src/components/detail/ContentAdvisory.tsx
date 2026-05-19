"use client";

import { Shield, Globe } from "lucide-react";

type Rating = {
  iso_3166_1: string;
  rating: string;
};

const ratingColors: Record<string, string> = {
  "TV-Y": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "TV-Y7": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "TV-G": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "TV-PG": "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  "TV-14": "bg-orange-500/15 text-orange-300 border-orange-500/25",
  "TV-MA": "bg-red-500/15 text-red-300 border-red-500/25",
  "G": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "PG": "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  "PG-13": "bg-orange-500/15 text-orange-300 border-orange-500/25",
  "R": "bg-red-500/15 text-red-300 border-red-500/25",
  "NC-17": "bg-red-600/15 text-red-200 border-red-600/25",
};

export default function ContentAdvisory({ ratings }: { ratings: Rating[] }) {
  if (!ratings || ratings.length === 0) return null;

  const usRating = ratings.find((r) => r.iso_3166_1 === "US");
  const enRating = ratings.find((r) => ["GB", "CA", "AU"].includes(r.iso_3166_1));
  const primary = usRating || enRating || ratings[0];

  if (!primary?.rating || primary.rating === "") return null;

  const colorClass = ratingColors[primary.rating] ?? "bg-surface-700/50 text-surface-300 border-surface-600/30";

  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${colorClass}`}>
        <Shield className="w-3.5 h-3.5" />
        {primary.rating}
      </span>
      <span className="flex items-center gap-1 text-[10px] text-surface-500">
        <Globe className="w-3 h-3" />
        {primary.iso_3166_1}
      </span>
    </div>
  );
}
