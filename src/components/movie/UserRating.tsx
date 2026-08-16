"use client";

import React, { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import StarRating from "@components/ui/StarRating";
import RatingScaleNotice from "@components/ui/RatingScaleNotice";
import { formatStarsWithMax } from "@/utils/ratingScale";

interface UserRatingProps {
  itemId: number | string;
  itemType: "movie" | "tv";
  itemName?: string;
  imageUrl?: string;
  isWatched?: boolean;
}

export default function UserRating({ itemId, itemType, itemName, imageUrl, isWatched }: UserRatingProps) {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLoggedOut(false);

    const params = new URLSearchParams({ itemId: String(itemId), itemType });
    fetch(`/api/user-rating?${params}`)
      .then((res) => {
        if (res.status === 401) { setLoggedOut(true); return null; }
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        if (body?.error) { setError(body.error); return; }
        setScore(body?.score ?? null);
      })
      .catch(() => { if (!cancelled) setError("Failed to load rating"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [itemId, itemType, isWatched]);

  const handleSetScore = async (value: number) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: String(itemId), itemType, score: value, itemName: itemName ?? undefined, imageUrl: imageUrl ?? undefined }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body?.error || "Failed to save rating"); return; }
      setScore(value);
    } catch { setError("Failed to save rating"); }
    finally { setSaving(false); }
  };

  const handleClearRating = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user-rating", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: String(itemId), itemType }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body?.error || "Failed to clear rating"); return; }
      setScore(null);
    } catch { setError("Failed to clear rating"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-surface-800 rounded w-24 mb-3" />
        <div className="flex gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="w-8 h-8 rounded-lg bg-surface-800" />
          ))}
        </div>
      </div>
    );
  }

  if (loggedOut) return null;

  if (score == null && isWatched === false) {
    return (
      <div className="card-accent rounded-2xl p-5 border border-brand-500/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
          <h3 className="text-sm font-semibold text-surface-200">Your Rating</h3>
        </div>
        <p className="text-xs text-surface-500 leading-relaxed">
          Mark this as <span className="text-brand-400 font-medium">Watched</span> to rate it.
        </p>
      </div>
    );
  }

  return (
    <div className="card-accent rounded-2xl p-5 animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
          <h3 className="text-sm font-semibold text-surface-200">Your Rating</h3>
        </div>
        {score !== null && (
          <span className="text-lg font-bold text-accent-gold">{formatStarsWithMax(score)}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <StarRating value={score} onChange={handleSetScore} size="lg" disabled={saving} />
        {score !== null && (
          <button
            type="button"
            disabled={saving}
            onClick={handleClearRating}
            className="btn-ghost p-2"
            title="Clear rating"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {score !== null && <RatingScaleNotice />}
    </div>
  );
}
