"use client";

import React, { useEffect, useState } from "react";
import { Star, RotateCcw } from "lucide-react";

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
  const [hoverScore, setHoverScore] = useState<number | null>(null);

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
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-brand-400">{score}</span>
            <span className="text-xs text-surface-500">/ 10</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
          const isHovered = hoverScore !== null;
          const isActive = score !== null && n <= (isHovered ? hoverScore! : score!);
          return (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => handleSetScore(n)}
              onMouseEnter={() => setHoverScore(n)}
              onMouseLeave={() => setHoverScore(null)}
              className={`relative w-9 h-9 rounded-lg text-xs font-semibold transition-all duration-150 ${
                n <= (score ?? 0)
                  ? "bg-brand-500 text-surface-950 shadow-sm"
                  : "bg-surface-700/50 text-surface-400 hover:bg-surface-600/60 hover:text-surface-200"
              } ${isActive ? "scale-110" : ""} disabled:opacity-60`}
            >
              {n}
              {n <= (score ?? 0) && (
                <span className="absolute inset-0 rounded-lg ring-1 ring-inset ring-brand-500/30" />
              )}
            </button>
          );
        })}
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
    </div>
  );
}
