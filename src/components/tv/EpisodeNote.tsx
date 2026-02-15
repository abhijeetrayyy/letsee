"use client";

import React, { useState, useEffect } from "react";

interface EpisodeNoteProps {
  showId: string;
  seasonNumber: number;
  episodeNumber: number;
  initialNote?: string;
}

export default function EpisodeNote({
  showId,
  seasonNumber,
  episodeNumber,
  initialNote = "",
}: EpisodeNoteProps) {
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // If we want to fetch on mount if initial is empty?
    // Let's assume passed validation or fetched.
    if (!initialNote) {
      fetch(
        `/api/episode-rating?showId=${showId}&seasonNumber=${seasonNumber}&episodeNumber=${episodeNumber}`,
      )
        .then((r) => r.json())
        .then((d) => {
          if (d.note) setNote(d.note);
        })
        .catch(() => {});
    }
  }, [showId, seasonNumber, episodeNumber, initialNote]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/episode-rating", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          seasonNumber,
          episodeNumber,
          note,
          // API must handle partial update so we don't wipe score
        }),
      });
      if (res.ok) setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save on blur or explicit save?
  // Let's do explicit save or debounce. Explicit save button is safer for now.

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-neutral-300 mb-2">
        Your Notes
      </label>
      <div className="relative">
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setDirty(true);
          }}
          className="w-full bg-neutral-800 text-neutral-200 rounded-md p-3 border border-neutral-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 min-h-[100px]"
          placeholder="Write your thoughts on this episode..."
        />
        {dirty && (
          <div className="absolute bottom-3 right-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 text-xs rounded transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Note"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
