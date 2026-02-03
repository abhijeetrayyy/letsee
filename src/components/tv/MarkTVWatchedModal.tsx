"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { PiEyeBold } from "react-icons/pi";
import { FaChevronDown, FaChevronRight } from "react-icons/fa6";
import toast from "react-hot-toast";

export type SeasonOption = {
  season_number: number;
  name: string;
  episode_count: number;
};

/** selectedEpisodes: season_number -> Set of episode_number */
function buildEpisodeList(selectedEpisodes: Map<number, Set<number>>): { season_number: number; episode_number: number }[] {
  const list: { season_number: number; episode_number: number }[] = [];
  selectedEpisodes.forEach((epSet, seasonNumber) => {
    epSet.forEach((epNum) => list.push({ season_number: seasonNumber, episode_number: epNum }));
  });
  return list.sort((a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number);
}

function countSelectedEpisodes(selectedEpisodes: Map<number, Set<number>>): number {
  let n = 0;
  selectedEpisodes.forEach((set) => { n += set.size; });
  return n;
}

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

interface MarkTVWatchedModalProps {
  showId: string;
  showName: string;
  /** Pass when available (e.g. TV detail page). If empty and showId set, modal fetches from API (e.g. profile/cards). */
  seasons: SeasonOption[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Same payload shape as watchedButton (itemId, name, mediaType, imgUrl, adult, genres). */
  watchedPayload: {
    itemId: number | string;
    name: string;
    imgUrl: string;
    adult: boolean;
    genres: string[];
  };
}

export default function MarkTVWatchedModal({
  showId,
  showName,
  seasons: seasonsProp,
  isOpen,
  onClose,
  onSuccess,
  watchedPayload,
}: MarkTVWatchedModalProps) {
  const [saving, setSaving] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Map<number, Set<number>>>(new Map());
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
  const [fetchedSeasons, setFetchedSeasons] = useState<SeasonOption[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);

  const seasons = seasonsProp.length > 0 ? seasonsProp : fetchedSeasons;

  React.useEffect(() => {
    if (!isOpen || !showId || seasonsProp.length > 0) return;
    setSeasonsLoading(true);
    setFetchedSeasons([]);
    fetch(`/api/tv-seasons?showId=${encodeURIComponent(showId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.seasons) setFetchedSeasons(data.seasons);
      })
      .catch(() => setFetchedSeasons([]))
      .finally(() => setSeasonsLoading(false));
  }, [isOpen, showId, seasonsProp.length]);

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

  const selectAllEpisodes = useCallback(() => {
    const map = new Map<number, Set<number>>();
    seasons.forEach((s) => {
      const set = new Set<number>();
      for (let ep = 1; ep <= Math.max(0, s.episode_count); ep++) set.add(ep);
      if (set.size) map.set(s.season_number, set);
    });
    setSelectedEpisodes(map);
  }, [seasons]);

  const clearEpisodes = useCallback(() => {
    setSelectedEpisodes(new Map());
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

  const handleCompleteSeries = async () => {
    setSaving(true);
    const toastId = toast.loading("Adding to Watched…");
    try {
      const res = await fetch("/api/watchedButton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...watchedPayload,
          mediaType: "tv",
          itemId: String(watchedPayload.itemId),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data?.message ?? "Added to Watched", { id: toastId });
        onSuccess();
        onClose();
      } else {
        toast.error(data?.error ?? "Failed to add to Watched", { id: toastId });
      }
    } catch {
      toast.error("Something went wrong", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEpisodes = async () => {
    const list = buildEpisodeList(selectedEpisodes);
    if (list.length === 0) {
      toast.error("Select at least one episode");
      return;
    }
    setSaving(true);
    const toastId = toast.loading("Saving…");
    try {
      const res = await fetch("/api/watchedButton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...watchedPayload,
          mediaType: "tv",
          itemId: String(watchedPayload.itemId),
          episodes: { list },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data?.message ?? "Added to Watched", { id: toastId });
        onSuccess();
        onClose();
      } else {
        toast.error(data?.error ?? "Failed to save", { id: toastId });
      }
    } catch {
      toast.error("Something went wrong", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const totalSelected = countSelectedEpisodes(selectedEpisodes);

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
          <h2 className="text-lg font-semibold text-white">How much have you watched?</h2>
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
          <p className="mb-4 text-sm text-neutral-400">
            <span className="font-medium text-neutral-200">{showName}</span> — choose one option below.
          </p>
          {seasonsLoading && (
            <p className="mb-4 text-sm text-neutral-400">Loading seasons…</p>
          )}

          <button
            type="button"
            onClick={handleCompleteSeries}
            disabled={saving}
            className="mb-6 flex w-full items-center gap-3 rounded-xl border border-neutral-600 bg-neutral-800/80 px-4 py-3 text-left text-white transition-colors hover:border-neutral-500 hover:bg-neutral-800 disabled:opacity-60"
          >
            <PiEyeBold className="text-xl text-emerald-500 shrink-0" />
            <div>
              <span className="font-medium">I&apos;ve watched the complete series</span>
              <p className="text-xs text-neutral-400 mt-0.5">Mark all seasons and episodes as watched</p>
            </div>
          </button>

          <div className="border-t border-neutral-700 pt-4">
            <p className="mb-2 text-sm font-medium text-neutral-300">Or select seasons or individual episodes</p>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={selectAllEpisodes}
                className="rounded-lg bg-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-600"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearEpisodes}
                className="rounded-lg bg-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-600"
              >
                Clear
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800/50 p-2 space-y-0.5">
              {seasons.length === 0 ? (
                <p className="py-4 text-center text-sm text-neutral-500">No seasons data</p>
              ) : (
                seasons.map((season) => {
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
                          aria-label={expanded ? "Collapse season" : "Expand season"}
                        >
                          {expanded ? <FaChevronDown className="text-sm" /> : <FaChevronRight className="text-sm" />}
                        </button>
                        <label className="flex flex-1 cursor-pointer items-center gap-3 min-w-0">
                          <SeasonCheckbox
                            checked={isFullySelected}
                            indeterminate={isPartiallySelected && !isFullySelected}
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
                })
              )}
            </div>
            <button
              type="button"
              onClick={handleSaveEpisodes}
              disabled={saving || totalSelected === 0}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : `Save (${totalSelected} episode${totalSelected !== 1 ? "s" : ""} selected)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
