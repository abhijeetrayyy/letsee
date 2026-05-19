"use client";

import { Heart, ThumbsDown, Star } from "lucide-react";
import type { TasteProfile } from "@/utils/tasteProfile";

export default function TasteSummary({ profile }: { profile: TasteProfile }) {
  if (profile.topGenres.length === 0) return null;

  return (
    <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 backdrop-blur-sm p-5">
      <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Taste Summary</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {profile.topGenres.slice(0, 5).map((g) => (
          <span
            key={g.genre}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-800 border border-surface-700/50"
          >
            <span className="text-surface-200">{g.genre}</span>
            <span className={g.affinity > 0 ? "text-green-400" : "text-red-400"}>
              {g.affinity > 0 ? "+" : ""}{g.affinity}
            </span>
          </span>
        ))}
      </div>

      {profile.topGenres.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-400">
          {profile.loves.length > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-green-400 fill-green-400" />
              Loves {profile.loves.join(", ")}
            </span>
          )}
          {profile.avoids.length > 0 && (
            <span className="flex items-center gap-1">
              <ThumbsDown className="w-3 h-3 text-red-400" />
              Avoids {profile.avoids.join(", ")}
            </span>
          )}
          {profile.ratesHighest && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              Rates highest: {profile.ratesHighest}
            </span>
          )}
          <span className="text-surface-500">{profile.totalGenresExplored} genres explored</span>
        </div>
      )}
    </div>
  );
}
