"use client";

import React, { useCallback, useState } from "react";
import { useWatchedEpisode } from "./useWatchedEpisode";

interface MarkEpisodeWatchedProps {
  showId: string;
  seasonNumber: number;
  episodeNumber: number;
}

export default function MarkEpisodeWatched({
  showId,
  seasonNumber,
  episodeNumber,
}: MarkEpisodeWatchedProps) {
  const { watched, mutate, ready, signedIn } = useWatchedEpisode(showId, seasonNumber, episodeNumber);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    setToggling(true);
    try {
      const res = await fetch("/api/watched-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId, seasonNumber, episodeNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.action) {
        // Revalidate the show's shared entry: the spoiler gates lower on the
        // page read the same key, so marking reveals the overview and thread
        // without a reload.
        await mutate();
        setError(null);
      } else {
        throw new Error(String(res.status));
      }
    } catch {
      setError("Couldn’t save. Try again.");
    } finally {
      setToggling(false);
    }
  }, [showId, seasonNumber, episodeNumber, mutate]);

  if (!ready || !signedIn || watched === null) return null;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={toggling}
        aria-pressed={watched}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
          watched
            ? "bg-emerald-600/90 text-white hover:bg-emerald-600"
            : "bg-surface-700/80 text-surface-200 hover:bg-surface-600 border border-surface-600"
        } disabled:opacity-60`}
      >
        {toggling ? "…" : watched ? <>✓ Marked as watched</> : <>Mark as watched</>}
      </button>
      {error && <p className="mt-2 text-xs text-red-400" role="status">{error}</p>}
    </div>
  );
}
