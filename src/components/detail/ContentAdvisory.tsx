"use client";

import { Shield } from "lucide-react";

type Rating = {
  iso_3166_1: string;
  rating: string;
};

export default function ContentAdvisory({ ratings }: { ratings: Rating[] }) {
  if (!ratings || ratings.length === 0) return null;

  // Find US rating first, then any English-speaking country, then first available
  const usRating = ratings.find((r) => r.iso_3166_1 === "US");
  const enRating = ratings.find((r) => ["GB", "CA", "AU"].includes(r.iso_3166_1));
  const primary = usRating || enRating || ratings[0];

  if (!primary?.rating || primary.rating === "") return null;

  const ratingColors: Record<string, string> = {
    "TV-Y": "bg-green-500/20 text-green-300 border-green-500/30",
    "TV-Y7": "bg-green-500/20 text-green-300 border-green-500/30",
    "TV-G": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    "TV-PG": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    "TV-14": "bg-orange-500/20 text-orange-300 border-orange-500/30",
    "TV-MA": "bg-red-500/20 text-red-300 border-red-500/30",
    "G": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    "PG": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    "PG-13": "bg-orange-500/20 text-orange-300 border-orange-500/30",
    "R": "bg-red-500/20 text-red-300 border-red-500/30",
    "NC-17": "bg-red-600/20 text-red-200 border-red-600/30",
  };

  const colorClass = ratingColors[primary.rating] ?? "bg-surface-800/60 text-surface-300 border-surface-700/30";

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${colorClass}`}>
        <Shield className="w-3 h-3 inline mr-1 -mt-0.5" />
        {primary.rating}
      </span>
      <span className="text-[10px] text-surface-500">{primary.iso_3166_1}</span>
    </div>
  );
}
