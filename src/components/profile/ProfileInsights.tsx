"use client";

import { Sparkles } from "lucide-react";
import type { TasteInsight } from "@/utils/tasteProfile";

interface ProfileInsightsProps {
  insight: TasteInsight | null;
}

export default function ProfileInsights({ insight }: ProfileInsightsProps) {
  if (!insight || !insight.summary) return null;

  return (
    <div className="rounded-xl border border-brand-500/10 bg-brand-500/3 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="size-4 text-brand-400" />
        <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Taste Profile</span>
      </div>

      <p className="text-sm text-white/80 leading-relaxed mb-3">{insight.summary}</p>

      <div className="flex flex-wrap gap-1.5">
        {insight.topGenres.map((genre) => (
          <span
            key={genre}
            className="px-2 py-0.5 rounded-full text-xs bg-brand-500/10 text-brand-300 border border-brand-500/20"
          >
            {genre}
          </span>
        ))}
      </div>

      {insight.watchingStyle && (
        <p className="text-xs text-white/40 mt-2 italic">{insight.watchingStyle}</p>
      )}
    </div>
  );
}
