"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type Season = {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
};

type Episode = {
  season_number: number;
  episode_number: number;
};

type EpisodeManagementModalProps = {
  showId: string;
  showName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function EpisodeManagementModal({
  showId,
  showName,
  isOpen,
  onClose,
  onSuccess,
}: EpisodeManagementModalProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSeason, setActiveSeason] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [seasonsRes, watchedRes] = await Promise.all([
          fetch(`/api/tv-seasons?showId=${encodeURIComponent(showId)}`),
          fetch(`/api/watched-episodes?showId=${encodeURIComponent(showId)}`),
        ]);

        const seasonsData = await seasonsRes.json();
        const watchedData = await watchedRes.json();

        setSeasons(seasonsData.seasons ?? []);

        const watchedSet = new Set<string>();
        for (const ep of watchedData.episodes ?? []) {
          watchedSet.add(`${ep.season_number}-${ep.episode_number}`);
        }
        setWatchedEpisodes(watchedSet);
        setSelectedEpisodes(new Set(watchedSet));

        // Set active season to first unwatched season
        const firstUnwatched = (seasonsData.seasons ?? []).find((s: Season) => {
          for (let ep = 1; ep <= s.episode_count; ep++) {
            if (!watchedSet.has(`${s.season_number}-${ep}`)) return true;
          }
          return false;
        });
        if (firstUnwatched) {
          setActiveSeason(firstUnwatched.season_number);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, showId]);

  const toggleEpisode = useCallback((seasonNum: number, epNum: number) => {
    const key = `${seasonNum}-${epNum}`;
    setSelectedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleSeason = useCallback((seasonNum: number, episodeCount: number) => {
    const seasonKeys = Array.from({ length: episodeCount }, (_, i) =>
      `${seasonNum}-${i + 1}`
    );
    const allSelected = seasonKeys.every((k) => selectedEpisodes.has(k));

    setSelectedEpisodes((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        seasonKeys.forEach((k) => next.delete(k));
      } else {
        seasonKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  }, [selectedEpisodes]);

  const markUpTo = useCallback((seasonNum: number, epNum: number) => {
    const activeSeasonData = seasons.find((s) => s.season_number === seasonNum);
    if (!activeSeasonData) return;

    const newSelected = new Set(selectedEpisodes);

    // Mark all episodes in previous seasons
    for (const season of seasons) {
      if (season.season_number < seasonNum) {
        for (let ep = 1; ep <= season.episode_count; ep++) {
          newSelected.add(`${season.season_number}-${ep}`);
        }
      } else if (season.season_number === seasonNum) {
        for (let ep = 1; ep <= epNum; ep++) {
          newSelected.add(`${seasonNum}-${ep}`);
        }
        break;
      }
    }

    setSelectedEpisodes(newSelected);
  }, [seasons, selectedEpisodes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Calculate diff
      const toAdd: Episode[] = [];
      const toRemove: Episode[] = [];

      for (const key of selectedEpisodes) {
        if (!watchedEpisodes.has(key)) {
          const [season, episode] = key.split("-").map(Number);
          toAdd.push({ season_number: season, episode_number: episode });
        }
      }

      for (const key of watchedEpisodes) {
        if (!selectedEpisodes.has(key)) {
          const [season, episode] = key.split("-").map(Number);
          toRemove.push({ season_number: season, episode_number: episode });
        }
      }

      // Bulk add
      if (toAdd.length > 0) {
        await fetch("/api/watched-episodes-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showId, episodes: toAdd, action: "mark" }),
        });
      }

      // Bulk delete
      if (toRemove.length > 0) {
        await fetch("/api/watched-episodes/bulk-delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showId, episodes: toRemove }),
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkComplete = async () => {
    setSaving(true);
    try {
      await fetch("/api/watchedButton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: showId,
          name: showName,
          mediaType: "tv",
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const activeSeasonData = seasons.find((s) => s.season_number === activeSeason);
  const selectedCount = selectedEpisodes.size;
  const watchedCount = watchedEpisodes.size;
  const totalEpisodes = seasons.reduce((sum, s) => sum + s.episode_count, 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="bg-surface-900 rounded-2xl border border-surface-700/60 w-full max-w-4xl mt-8 mb-8 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-700/60">
          <div>
            <h2 className="text-lg font-bold text-surface-100">
              Manage Episodes
            </h2>
            <p className="text-sm text-surface-400">{showName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <LoadingSpinner size="lg" className="border-t-white" />
          </div>
        ) : (
          <>
            {/* Quick Actions */}
            <div className="flex items-center gap-2 p-3 bg-surface-800/30 border-b border-surface-700/60">
              <button
                onClick={handleMarkComplete}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 transition-colors disabled:opacity-50"
              >
                Mark complete series
              </button>
              <button
                onClick={() => setSelectedEpisodes(new Set(watchedEpisodes))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-700 text-surface-200 hover:bg-surface-600 transition-colors"
              >
                Reset to current
              </button>
              <button
                onClick={() => {
                  const allKeys: string[] = [];
                  for (const s of seasons) {
                    for (let ep = 1; ep <= s.episode_count; ep++) {
                      allKeys.push(`${s.season_number}-${ep}`);
                    }
                  }
                  setSelectedEpisodes(new Set(allKeys));
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-700 text-surface-200 hover:bg-surface-600 transition-colors"
              >
                Select all
              </button>
              <button
                onClick={() => setSelectedEpisodes(new Set())}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-700 text-surface-200 hover:bg-surface-600 transition-colors"
              >
                Clear all
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Season Sidebar */}
              <div className="w-48 border-r border-surface-700/60 overflow-y-auto bg-surface-900/50">
                {seasons.map((season) => {
                  const seasonEpisodes = Array.from(
                    { length: season.episode_count },
                    (_, i) => `${season.season_number}-${i + 1}`
                  );
                  const watchedInSeason = seasonEpisodes.filter((k) =>
                    selectedEpisodes.has(k)
                  ).length;
                  const allSelected =
                    watchedInSeason === season.episode_count &&
                    season.episode_count > 0;
                  const someSelected =
                    watchedInSeason > 0 && !allSelected;

                  return (
                    <button
                      key={season.season_number}
                      onClick={() => setActiveSeason(season.season_number)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                        activeSeason === season.season_number
                          ? "bg-surface-800 text-surface-100"
                          : "text-surface-400 hover:bg-surface-800/50"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">{season.name}</p>
                        <p className="text-xs text-surface-500">
                          {watchedInSeason}/{season.episode_count}
                        </p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          allSelected
                            ? "bg-brand-500 border-brand-500"
                            : someSelected
                            ? "bg-surface-600 border-surface-500"
                            : "border-surface-600"
                        }`}
                      >
                        {allSelected && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-surface-950">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Episode Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeSeasonData && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-surface-100">
                        {activeSeasonData.name}
                      </h3>
                      <button
                        onClick={() =>
                          toggleSeason(
                            activeSeasonData.season_number,
                            activeSeasonData.episode_count
                          )
                        }
                        className="text-xs text-brand-400 hover:text-brand-300"
                      >
                        Toggle season
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {Array.from(
                        { length: activeSeasonData.episode_count },
                        (_, i) => i + 1
                      ).map((epNum) => {
                        const key = `${activeSeasonData.season_number}-${epNum}`;
                        const isSelected = selectedEpisodes.has(key);

                        return (
                          <button
                            key={epNum}
                            onClick={() =>
                              toggleEpisode(activeSeasonData.season_number, epNum)
                            }
                            className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                              isSelected
                                ? "bg-brand-500/20 border-brand-500/50 text-brand-400"
                                : "bg-surface-800/50 border-surface-700/50 text-surface-300 hover:border-surface-500"
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-brand-500 border-brand-500"
                                  : "border-surface-600"
                              }`}
                            >
                              {isSelected && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-surface-950">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                            </div>
                            <span className="text-xs font-medium">
                              Episode {epNum}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-surface-700/60 bg-surface-900/50">
              <p className="text-sm text-surface-400">
                <span className="text-brand-400 font-medium">{selectedCount}</span> selected ·{" "}
                <span className="text-surface-300 font-medium">{watchedCount}</span> watched ·{" "}
                <span className="text-surface-500">{totalEpisodes}</span> total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-surface-300 hover:bg-surface-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || selectedCount === watchedCount}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-surface-950 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <LoadingSpinner size="sm" className="border-t-surface-950" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
