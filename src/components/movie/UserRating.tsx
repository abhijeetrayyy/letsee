"use client";

import React, { useEffect, useState } from "react";

interface UserRatingProps {
  itemId: number | string;
  itemType: "movie" | "tv";
  itemName?: string;
  imageUrl?: string;
  /** When provided, rating is only shown when watched: false = placeholder, true = fetch and show. */
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

    const params = new URLSearchParams({
      itemId: String(itemId),
      itemType,
    });
    fetch(`/api/user-rating?${params}`)
      .then((res) => {
        if (res.status === 401) {
          setLoggedOut(true);
          return null;
        }
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        if (body?.error) {
          setError(body.error);
          return;
        }
        setScore(body?.score ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load rating");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [itemId, itemType, isWatched]);

  const handleSetScore = async (value: number) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: String(itemId),
          itemType,
          score: value,
          itemName: itemName ?? undefined,
          imageUrl: imageUrl ?? undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Failed to save rating");
        return;
      }
      setScore(value);
    } catch {
      setError("Failed to save rating");
    } finally {
      setSaving(false);
    }
  };

  const handleClearRating = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user-rating", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: String(itemId),
          itemType,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Failed to clear rating");
        return;
      }
      setScore(null);
    } catch {
      setError("Failed to clear rating");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="my-4 text-neutral-400 text-sm">
        Your rating: Loading…
      </div>
    );
  }

  if (loggedOut) {
    return null;
  }

  if (score == null && isWatched === false) {
    return (
      <div className="my-4 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
        <p className="text-neutral-300 text-sm font-medium mb-1">Your rating</p>
        <p className="text-neutral-500 text-sm">
          Mark this as <strong className="text-neutral-400">Watched</strong> (use the button above) to rate.
        </p>
      </div>
    );
  }

  return (
    <div className="my-4">
      <p className="text-neutral-300 text-sm font-medium mb-2">
        Your rating
        {score !== null && (
          <span className="ml-2 text-indigo-400 font-semibold">
            {score}/10
          </span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => handleSetScore(n)}
              className={`w-8 h-8 rounded text-sm font-medium transition ${
                score === n
                  ? "bg-indigo-600 text-white"
                  : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
              } disabled:opacity-60`}
            >
              {n}
            </button>
          ))}
        </div>
        {score !== null && (
          <button
            type="button"
            disabled={saving}
            onClick={handleClearRating}
            className="text-neutral-400 hover:text-white text-xs font-medium underline disabled:opacity-60"
          >
            Clear rating
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-amber-200 text-xs">{error}</p>
      )}
    </div>
  );
}
