"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCheck, Clock, ArrowUpDown, Star, Search } from "lucide-react";

export interface EpisodeItem {
  id: number;
  episode_number: number;
  name: string;
  air_date: string | null;
  overview: string;
  still_path: string | null;
  vote_average?: number;
  vote_count?: number;
  runtime?: number;
  /** TMDB marks premieres, mid-season breaks and finales explicitly. */
  episode_type?: string | null;
  /** Per-episode crew. Every episode carries one; the series-level list does not. */
  crew?: { id?: number; name?: string; job?: string }[];
}

/**
 * TMDB's `episode_type`, in words a viewer uses.
 *
 * "standard" is every episode that is not one of these, so it earns no badge —
 * printing it on fourteen of sixteen rows would make the two that matter harder
 * to find, not easier.
 */
const EPISODE_TYPE_LABEL: Record<string, string> = {
  finale: "Finale",
  mid_season: "Mid-season finale",
  premiere: "Premiere",
};

/**
 * Who made this episode.
 *
 * The season payload carries a `crew` array per episode and the page threw all
 * of it away — so "who directed Ozymandias" (Rian Johnson) or "who wrote it"
 * (Moira Walley-Beckett) was answerable only by opening the episode. For an
 * anthology or a prestige drama that is the question people scan the list for.
 *
 * Director and writer only. The array also holds the editor, the photography
 * director and three producers, which is a credits roll, not a scan line.
 */
function episodeByline(crew?: { name?: string; job?: string }[]): string | null {
  if (!crew?.length) return null;
  const pick = (job: string) =>
    [...new Set(crew.filter((c) => c.job === job && c.name).map((c) => c.name as string))];
  const directors = pick("Director");
  const writers = pick("Writer");
  const parts: string[] = [];
  if (directors.length) parts.push(`Dir. ${directors.join(", ")}`);
  if (writers.length) parts.push(`Wr. ${writers.join(", ")}`);
  return parts.length ? parts.join("  ·  ") : null;
}

interface SeasonSummary {
  id: number;
  season_number: number;
  episode_count: number;
}

interface EpisodeListWithWatchedProps {
  showId: string;
  seasonNumber: number;
  episodes: EpisodeItem[];
  allSeasons?: SeasonSummary[];
  episodesLoading?: boolean;
  /** How many episodes to render before "Show more". Long-running anime can
      carry 1000+ episodes in a single season, and rendering every one as a
      card with a still image made the page unusable. */
  initialCount?: number;
  /** Shown when the list is truncated, so there's a way to see the lot. */
  seeAllHref?: string;
}

const LOAD_MORE_STEP = 24;
/** Below this, a season is short enough that searching it is pointless. */
const SEARCH_THRESHOLD = 15;

function getWatchedInfo(
  episodes: {
    season_number: number;
    episode_number: number;
    watched_at?: string;
  }[],
  seasonNumber: number,
  episodeNumber: number,
): { watched: boolean; date?: string } {
  const match = episodes.find(
    (e) =>
      e.season_number === seasonNumber && e.episode_number === episodeNumber,
  );
  return { watched: !!match, date: match?.watched_at };
}

type SortMode = "number" | "rating" | "runtime";

export default function EpisodeListWithWatched({
  showId,
  seasonNumber,
  episodes,
  allSeasons,
  episodesLoading = false,
  initialCount = 24,
  seeAllHref,
}: EpisodeListWithWatchedProps) {
  const [watched, setWatched] = useState<
    { season_number: number; episode_number: number; watched_at?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("number");
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [query, setQuery] = useState("");
  const [hideWatched, setHideWatched] = useState(false);

  // Switching season swaps the whole list out from under us.
  useEffect(() => {
    setVisibleCount(initialCount);
    setQuery("");
    setHideWatched(false);
  }, [seasonNumber, initialCount]);

  const fetchWatched = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/watched-episodes?showId=${encodeURIComponent(showId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json();
      setWatched(data?.episodes ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    fetchWatched();
  }, [fetchWatched]);

  const toggleEpisode = useCallback(
    async (e: React.MouseEvent, episodeNumber: number) => {
      e.preventDefault();
      e.stopPropagation();
      const key = `${seasonNumber}-${episodeNumber}`;
      setToggling(key);
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
        if (res.ok) await fetchWatched();
      } finally {
        setToggling(null);
      }
    },
    [showId, seasonNumber, fetchWatched],
  );

  const handleBulkMark = async (
    targetEpisodes: { season_number: number; episode_number: number }[],
  ) => {
    if (targetEpisodes.length === 0) return;
    setBulkUpdating(true);
    try {
      const res = await fetch("/api/watched-episodes-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          episodes: targetEpisodes,
          action: "mark",
        }),
      });
      if (res.ok) await fetchWatched();
    } finally {
      setBulkUpdating(false);
    }
  };

  const markSeasonWatched = () => {
    const now = new Date();
    const target = episodes
      .filter((e) => !e.air_date || new Date(e.air_date) <= now)
      .map((e) => ({
        season_number: seasonNumber,
        episode_number: e.episode_number,
      }));
    handleBulkMark(target);
  };

  const markAllPrevious = (currentEpNumber: number) => {
    const now = new Date();
    const prevInSeason = episodes
      .filter((e) => e.episode_number < currentEpNumber)
      .filter((e) => !e.air_date || new Date(e.air_date) <= now)
      .map((e) => ({
        season_number: seasonNumber,
        episode_number: e.episode_number,
      }));

    let prevSeasonsEpisodes: {
      season_number: number;
      episode_number: number;
    }[] = [];
    if (allSeasons) {
      allSeasons
        .filter((s) => s.season_number < seasonNumber && s.season_number > 0)
        .forEach((s) => {
          for (let i = 1; i <= s.episode_count; i++) {
            prevSeasonsEpisodes.push({
              season_number: s.season_number,
              episode_number: i,
            });
          }
        });
    }

    handleBulkMark([...prevSeasonsEpisodes, ...prevInSeason]);
  };

  const isUnaired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) > new Date();
  };

  const toggleExpand = (epNum: number) => {
    setExpandedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(epNum)) next.delete(epNum);
      else next.add(epNum);
      return next;
    });
  };

  const watchedCount = episodes.filter((e) =>
    getWatchedInfo(watched, seasonNumber, e.episode_number).watched
  ).length;
  const airedCount = episodes.filter((e) => !isUnaired(e.air_date)).length;
  const progressPct = airedCount > 0 ? (watchedCount / airedCount) * 100 : 0;

  const sortedEpisodes = [...episodes].sort((a, b) => {
    if (sortMode === "rating") return (b.vote_average ?? 0) - (a.vote_average ?? 0);
    if (sortMode === "runtime") return (b.runtime ?? 0) - (a.runtime ?? 0);
    return a.episode_number - b.episode_number;
  });

  const trimmedQuery = query.trim().toLowerCase();
  const filteredEpisodes = sortedEpisodes.filter((e) => {
    if (hideWatched && getWatchedInfo(watched, seasonNumber, e.episode_number).watched) {
      return false;
    }
    if (!trimmedQuery) return true;
    // Match on title or episode number, so "417" jumps straight there.
    return (
      e.name?.toLowerCase().includes(trimmedQuery) ||
      String(e.episode_number) === trimmedQuery ||
      `e${e.episode_number}` === trimmedQuery
    );
  });

  const visibleEpisodes = filteredEpisodes.slice(0, visibleCount);
  const remaining = filteredEpisodes.length - visibleEpisodes.length;
  const showSearch = episodes.length > SEARCH_THRESHOLD;

  if (episodesLoading) {
    return (
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-4 flex gap-4 animate-pulse">
            <div className="shrink-0 w-10 h-8 bg-surface-800 rounded" />
            <div className="shrink-0 w-36 sm:w-44 aspect-video bg-surface-800 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-surface-800 rounded w-2/3" />
              <div className="h-3 bg-surface-800 rounded w-1/3" />
              <div className="h-3 bg-surface-800 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-surface-600 mx-auto mb-4" />
        <p className="text-surface-400 text-lg font-medium">No episodes found</p>
        <p className="text-surface-500 text-sm mt-1">This season has no episodes yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Progress Bar + Controls */}
      <div className="glass-card rounded-2xl p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">{watchedCount}/{airedCount} watched</span>
            <span className="text-xs text-surface-500">{Math.round(progressPct)}% complete</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="relative">
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="text-xs bg-surface-800 text-surface-300 rounded-lg px-3 py-1.5 border border-white/10 focus:border-brand-500 outline-none appearance-none pr-7 cursor-pointer"
              >
                <option value="number">Episode #</option>
                <option value="rating">Rating</option>
                <option value="runtime">Runtime</option>
              </select>
              <ArrowUpDown className="w-3 h-3 text-surface-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {/* Mark Season Watched */}
            <button
              onClick={markSeasonWatched}
              disabled={bulkUpdating || loading}
              className="btn-secondary text-xs py-1.5 disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {bulkUpdating ? "Updating..." : "Mark All"}
            </button>
          </div>
        </div>
        {/* Progress Track */}
        <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Find an episode — only worth showing on a season long enough to get lost in */}
      {showSearch && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="w-3.5 h-3.5 text-surface-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${episodes.length} episodes by name or number…`}
              className="w-full bg-surface-800 text-sm text-surface-200 placeholder:text-surface-500 rounded-lg pl-9 pr-3 py-2 border border-white/10 focus:border-brand-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setHideWatched((v) => !v)}
            aria-pressed={hideWatched}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              hideWatched
                ? "bg-brand-500/20 text-brand-400 border-brand-500/30"
                : "bg-surface-800 text-surface-400 border-white/10 hover:text-surface-200"
            }`}
          >
            Unwatched only
          </button>
        </div>
      )}

      {filteredEpisodes.length === 0 && (
        <p className="text-sm text-surface-500 py-8 text-center">
          No episodes match that filter.
        </p>
      )}

      {/* Episode List */}
      <div className="space-y-3">
        {visibleEpisodes.map((episode) => {
          const watchedInfo = getWatchedInfo(watched, seasonNumber, episode.episode_number);
          const key = `${seasonNumber}-${episode.episode_number}`;
          const busy = toggling === key;
          const unaired = isUnaired(episode.air_date);
          const isExpanded = expandedEpisodes.has(episode.episode_number);
          const epNum = episode.episode_number.toString().padStart(2, "0");

          return (
            <div
              key={episode.id}
              className={`glass-card rounded-xl overflow-hidden transition-all duration-200 ${
                watchedInfo.watched ? "border-brand-500/20" : unaired ? "opacity-60" : "hover:border-surface-600/50"
              }`}
            >
              <div className="flex gap-4 p-4">
                {/* Episode Number */}
                <div className="shrink-0 w-10 text-center">
                  <span className={`text-2xl font-black ${watchedInfo.watched ? "text-brand-400" : "text-surface-600"}`}>
                    {epNum}
                  </span>
                </div>

                {/* Still Image */}
                {episode.still_path ? (
                  <button
                    onClick={() => toggleExpand(episode.episode_number)}
                    className="shrink-0 w-36 sm:w-44 aspect-video rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
                      alt={episode.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="shrink-0 w-36 sm:w-44 aspect-video rounded-lg bg-surface-800 flex items-center justify-center">
                    <span className="text-xs text-surface-600">No image</span>
                  </div>
                )}

                {/* Episode Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`truncate text-base font-semibold ${watchedInfo.watched ? "text-brand-300" : "text-white"}`}>
                          {episode.name}
                        </h3>
                        {episode.episode_type && EPISODE_TYPE_LABEL[episode.episode_type] && (
                          <span className="shrink-0 rounded-md border border-brand-500/20 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-300">
                            {EPISODE_TYPE_LABEL[episode.episode_type]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {episode.air_date ? new Date(episode.air_date).toLocaleDateString() : "Air date TBA"}
                        {episode.runtime && ` · ${episode.runtime}m`}
                      </p>
                      {episodeByline(episode.crew) && (
                        <p className="mt-0.5 truncate text-xs text-surface-500">
                          {episodeByline(episode.crew)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {episode.vote_average != null && episode.vote_average > 0 && (
                        <span
                          className="flex items-center gap-1 text-xs text-accent-gold"
                          title={
                            episode.vote_count
                              ? `TMDB score from ${episode.vote_count.toLocaleString()} votes`
                              : undefined
                          }
                        >
                          <Star className="w-3 h-3 fill-current" />
                          {Number(episode.vote_average).toFixed(1)}
                          {/* A 9.4 from four people is not a 9.4. The series score
                              already carries its count for exactly this reason;
                              the episode score was printed bare. */}
                          {episode.vote_count ? (
                            <span className="text-surface-600">
                              ({episode.vote_count.toLocaleString()})
                            </span>
                          ) : null}
                        </span>
                      )}
                      {!loading && !unaired && (
                        <button
                          type="button"
                          onClick={(e) => markAllPrevious(episode.episode_number)}
                          disabled={bulkUpdating}
                          title="Mark all previous as watched"
                          className="p-1.5 text-surface-500 hover:text-surface-300 hover:bg-surface-700 rounded-lg transition-colors"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                      {!loading && !unaired && (
                        <button
                          type="button"
                          onClick={(e) => toggleEpisode(e, episode.episode_number)}
                          disabled={busy}
                          aria-pressed={watchedInfo.watched}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                            watchedInfo.watched
                              ? "bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 border border-brand-500/30"
                              : "bg-surface-700 text-surface-300 hover:bg-surface-600 border border-white/10"
                          } disabled:opacity-60`}
                        >
                          {busy ? "…" : watchedInfo.watched ? "✓ Watched" : "Mark"}
                        </button>
                      )}
                      {unaired && (
                        <span className="text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                          Unaired
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-surface-400 mt-2 line-clamp-2">
                    {episode.overview || "No overview available."}
                  </p>
                  {watchedInfo.watched && watchedInfo.date && (
                    <p className="text-xs text-surface-600 mt-1">
                      Watched on {new Date(watchedInfo.date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {remaining > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + LOAD_MORE_STEP)}
            className="px-4 py-2.5 rounded-xl bg-surface-800 text-surface-200 text-sm font-medium border border-white/10 hover:bg-surface-700 transition-colors"
          >
            Show {Math.min(remaining, LOAD_MORE_STEP)} more
          </button>
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="px-4 py-2.5 rounded-xl bg-brand-500/10 text-brand-400 text-sm font-medium border border-brand-500/25 hover:bg-brand-500/20 transition-colors"
            >
              Open full season ({filteredEpisodes.length}) →
            </Link>
          )}
          <span className="w-full text-center text-xs text-surface-500">
            Showing {visibleEpisodes.length} of {filteredEpisodes.length}
          </span>
        </div>
      )}
    </div>
  );
}
