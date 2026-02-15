"use client";

import React, { useState, useEffect } from "react";

const TV_STATUS_LABELS: Record<string, string> = {
  watching: "Watching",
  completed: "Completed",
  on_hold: "On hold",
  dropped: "Dropped",
  plan_to_watch: "Plan to watch",
  rewatching: "Rewatching",
};

interface TvStatusSelectorProps {
  showId: string;
  initialStatus?: string | null;
}

export default function TvStatusSelector({
  showId,
  initialStatus,
}: TvStatusSelectorProps) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [updating, setUpdating] = useState(false);

  // If initialStatus is not provided, we could fetch it, but usually we pass it from server.
  // If we want to support independent fetching:
  useEffect(() => {
    if (initialStatus === undefined) {
      // fetch logic if needed, but for now assuming usage with initialStatus or null
      fetch(`/api/tv-list-status?showId=${showId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.status) setStatus(d.status);
        })
        .catch(() => {});
    } else {
      setStatus(initialStatus);
    }
  }, [showId, initialStatus]);

  const handleChange = async (newStatus: string) => {
    setUpdating(true);
    // Optimistic update
    const prevStatus = status;
    setStatus(newStatus);
    try {
      const res = await fetch("/api/tv-list-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId, status: newStatus }),
      });
      if (!res.ok) {
        throw new Error("Failed to update");
      }
    } catch (err) {
      console.error(err);
      setStatus(prevStatus); // Revert
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="inline-block relative">
      <select
        value={status ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        disabled={updating}
        className={`appearance-none cursor-pointer rounded-lg border border-neutral-700 bg-neutral-800 py-1.5 pl-3 pr-8 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-neutral-750 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50
          ${
            status === "watching"
              ? "text-green-400 border-green-900/50 bg-green-900/10"
              : status === "rewatching"
                ? "text-blue-400 border-blue-900/50 bg-blue-900/10"
                : status === "completed"
                  ? "text-purple-400 border-purple-900/50 bg-purple-900/10"
                  : status === "dropped"
                    ? "text-red-400 border-red-900/50 bg-red-900/10"
                    : status === "on_hold"
                      ? "text-yellow-400 border-yellow-900/50 bg-yellow-900/10"
                      : ""
          }
        `}
      >
        <option value="" className="bg-neutral-800 text-neutral-400">
          Add to list...
        </option>
        {Object.entries(TV_STATUS_LABELS).map(([value, label]) => (
          <option
            key={value}
            value={value}
            className="bg-neutral-800 text-neutral-200"
          >
            {label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>
    </div>
  );
}
