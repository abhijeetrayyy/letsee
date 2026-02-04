"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa6";
import toast from "react-hot-toast";

export type SeasonOption = {
  season_number: number;
  name: string;
  episode_count: number;
};

function SeasonCheckbox({
  checked,
  indeterminate,
  onChange,
}: { checked: boolean; indeterminate: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-neutral-600 bg-neutral-700 text-indigo-500 focus:ring-indigo-500"
    />
  );
}

interface EditTvProgressModalProps {
  showId: string;
  showName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditTvProgressModal({
  showId,
  showName,
  isOpen,
  onClose,
  onSuccess,
}: EditTvProgressModalProps) {
  const [saving, setSaving] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Map<number, Set<number>>>(new Map());
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [initialWatchedSet, setInitialWatchedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !showId) return;
    setLoading(true);
    setSeasons([]);
    setInitialWatchedSet(new Set());
    setSelectedEpisodes(new Map());
    Promise.all([
      fetch(`/api/tv-seasons?showId=${encodeURIComponent(showId)}`).then((r) => r.json()),
      fetch(`/api/watched-episodes?showId=${encodeURIComponent(showId)}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([seasonsData, watchedData]) => {
        const s = seasonsData?.seasons ?? [];
        setSeasons(s);
        const eps = (watchedData?.episodes ?? []) as { season_number: number; episode_number: number }[];
        const set = new Map<number, Set<number>>();
        const initial = new Set<string>();
        for (const ep of eps) {
          initial.add(`${ep.season_number},${ep.episode_number}`);
          if (!set.has(ep.season_number)) set.set(ep.season_number, new Set());
          set.get(ep.season_number)!.add(ep.episode_number);
        }
        setInitialWatchedSet(initial);
        setSelectedEpisodes(set);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, showId]);

  const toggleSeason = useCallback((season: SeasonOption) => {
    const sn = season.season_number;
    const count = Math.max(0, season.episode_count);
    setSelectedEpisodes((prev) => {
      const next = new Map(prev);
      const current = next.get(sn);
      const allSelected = current && current.size === count;
      if (allSelected) {
        next.delete(sn);
      } else {
        const set = new Set<number>();
        for (let ep = 1; ep <= count; ep++) set.add(ep);
        next.set(sn, set);
      }
      return next;
    });
  }, []);

  const toggleEpisode = useCallback((seasonNumber: number, episodeNumber: number) => {
    setSelectedEpisodes((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(seasonNumber) ?? []);
      if (set.has(episodeNumber)) set.delete(episodeNumber);
      else set.add(episodeNumber);
      if (set.size === 0) next.delete(seasonNumber);
      else next.set(seasonNumber, set);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((seasonNumber: number) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) next.delete(seasonNumber);
      else next.add(seasonNumber);
      return next;
    });
  }, []);

  const isSeasonFullySelected = useCallback(
    (season: SeasonOption) => {
      const set = selectedEpisodes.get(season.season_number);
      const count = Math.max(0, season.episode_count);
      return count > 0 && set && set.size === count;
    },
    [selectedEpisodes]
  );

  const isSeasonPartiallySelected = useCallback(
    (season: SeasonOption) => {
      const set = selectedEpisodes.get(season.season_number);
      return set ? set.size > 0 : false;
    },
    [selectedEpisodes]
  );

  const handleSave = useCallback(async () => {
    const currentSet = new Set<string>();
    selectedEpisodes.forEach((epSet, sn) => {
      epSet.forEach((ep) => currentSet.add(`${sn},${ep}`));
    });
    const toRemove: { season_number: number; episode_number: number }[] = [];
    const toAdd: { season_number: number; episode_number: number }[] = [];
    initialWatchedSet.forEach((key) => {
      if (!currentSet.has(key)) {
        const [s, e] = key.split(",").map(Number);
        toRemove.push({ season_number: s, episode_number: e });
      }
    });
    currentSet.forEach((key) => {
      if (!initialWatchedSet.has(key)) {
        const [s, e] = key.split(",").map(Number);
        toAdd.push({ season_number: s, episode_number: e });
      }
    });
    if (toRemove.length === 0 && toAdd.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    const toastId = toast.loading("Updating progress…");
    try {
      for (const ep of toRemove) {
        const res = await fetch("/api/watched-episode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showId, seasonNumber: ep.season_number, episodeNumber: ep.episode_number }),
        });
        if (!res.ok) throw new Error("Failed to update");
      }
      for (const ep of toAdd) {
        const res = await fetch("/api/watched-episode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showId, seasonNumber: ep.season_number, episodeNumber: ep.episode_number }),
        });
        if (!res.ok) throw new Error("Failed to update");
      }
      toast.success("Progress updated", { id: toastId });
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to update progress", { id: toastId });
    } finally {
      setSaving(false);
    }
  }, [showId, selectedEpisodes, initialWatchedSet, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-neutral-600 bg-neutral-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-700 px-4 py-3">
          <h2 className="text-lg font-semibold text-white">Edit progress — {showName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-4">
          {loading ? (
            <p className="text-sm text-neutral-400">Loading seasons…</p>
          ) : seasons.length === 0 ? (
            <p className="text-sm text-neutral-500">No seasons data</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800/50 p-2 space-y-0.5">
              {seasons.map((season) => {
                const sn = season.season_number;
                const expanded = expandedSeasons.has(sn);
                const episodeCount = Math.max(0, season.episode_count);
                const seasonEpisodes = selectedEpisodes.get(sn);
                const isFullySelected = isSeasonFullySelected(season);
                const isPartiallySelected = isSeasonPartiallySelected(season);
                return (
                  <div key={sn} className="rounded-lg border border-neutral-700/80 overflow-hidden">
                    <div className="flex items-center gap-2 bg-neutral-800/60 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(sn)}
                        className="p-1 text-neutral-400 hover:text-white shrink-0"
                        aria-expanded={expanded}
                      >
                        {expanded ? <FaChevronDown className="text-sm" /> : <FaChevronRight className="text-sm" />}
                      </button>
                      <label className="flex flex-1 cursor-pointer items-center gap-3 min-w-0">
                        <SeasonCheckbox
                          checked={!!isFullySelected}
                          indeterminate={!!(isPartiallySelected && !isFullySelected)}
                          onChange={() => toggleSeason(season)}
                        />
                        <span className="text-sm font-medium text-white truncate">{season.name}</span>
                        <span className="text-xs text-neutral-400 shrink-0">
                          {episodeCount} ep{episodeCount !== 1 ? "s" : ""}
                        </span>
                      </label>
                    </div>
                    {expanded && episodeCount > 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 p-2 pl-10 bg-neutral-800/40 border-t border-neutral-700/80">
                        {Array.from({ length: episodeCount }, (_, i) => i + 1).map((epNum) => (
                          <label
                            key={epNum}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-neutral-700/50"
                          >
                            <input
                              type="checkbox"
                              checked={seasonEpisodes?.has(epNum) ?? false}
                              onChange={() => toggleEpisode(sn, epNum)}
                              className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-700 text-indigo-500 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-neutral-300">E{epNum}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-600 bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
