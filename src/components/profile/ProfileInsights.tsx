"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

interface TasteInsight {
  summary: string;
  topGenres: string[];
  watchingStyle: string;
  recommendation: string;
}

interface ProfileInsightsProps {
  username: string;
  profileId: string;
}

export default function ProfileInsights({ username, profileId }: ProfileInsightsProps) {
  const [insight, setInsight] = useState<TasteInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if we haven't already
    if (insight) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/profile/ai-summary?userId=${encodeURIComponent(profileId)}`, {
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => {
        if (!cancelled && data.summary) {
          setInsight(data);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load insights");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [profileId, insight]);

  if (loading) {
    return (
      <div className="rounded-xl border border-brand-500/10 bg-brand-500/3 p-4 animate-pulse">
        <div className="h-3 bg-brand-500/10 rounded w-3/4 mb-2" />
        <div className="h-3 bg-brand-500/10 rounded w-1/2" />
      </div>
    );
  }

  if (error || !insight) return null;

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

      <p className="text-xs text-white/40 mt-2 italic">{insight.watchingStyle}</p>
    </div>
  );
}
