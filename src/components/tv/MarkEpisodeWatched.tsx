"use client";

import React, { useCallback, useEffect, useState } from "react";

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
  const [watched, setWatched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const checkWatched = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/watched-episodes?showId=${encodeURIComponent(showId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      const episodes = data?.episodes ?? [];
      const isWatched = episodes.some(
        (e: { season_number: number; episode_number: number }) =>
          e.season_number === seasonNumber && e.episode_number === episodeNumber
      );
      setWatched(isWatched);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [showId, seasonNumber, episodeNumber]);

  useEffect(() => {
    checkWatched();
  }, [checkWatched]);

  const toggle = useCallback(async () => {
    setToggling(true);
    try {
      const res = await fetch("/api/watched-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          seasonNumber,
          episodeNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.action) {
        setWatched(data.action === "added");
      }
    } finally {
      setToggling(false);
    }
  }, [showId, seasonNumber, episodeNumber]);

  if (loading) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={toggling}
      aria-pressed={watched}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
        watched
          ? "bg-emerald-600/90 text-white hover:bg-emerald-600"
          : "bg-neutral-700/80 text-neutral-200 hover:bg-neutral-600 border border-neutral-600"
      } disabled:opacity-60`}
    >
      {toggling ? (
        "…"
      ) : watched ? (
        <>✓ Marked as watched</>
      ) : (
        <>Mark as watched</>
      )}
    </button>
  );
}
