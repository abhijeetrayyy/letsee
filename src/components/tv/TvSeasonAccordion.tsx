"use client";

import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type Episode = {
  episode_number: number;
  name: string;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  vote_average: number | null;
};

type SeasonData = {
  season_number: number;
  name: string;
  overview: string | null;
  air_date: string | null;
  episodes: Episode[];
};

type TvSeasonAccordionProps = {
  season: SeasonData;
  watchedEpisodes: Set<string>; // "seasonNumber-episodeNumber"
  onToggleEpisode: (seasonNumber: number, episodeNumber: number) => void;
  onMarkSeason: (seasonNumber: number, episodeNumbers: number[]) => void;
  onMarkUpTo: (seasonNumber: number, episodeNumber: number) => void;
  isOwner: boolean;
};

export default function TvSeasonAccordion({
  season,
  watchedEpisodes,
  onToggleEpisode,
  onMarkSeason,
  onMarkUpTo,
  isOwner,
}: TvSeasonAccordionProps) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const airedEpisodes = season.episodes.filter(
    (ep) => ep.air_date && new Date(ep.air_date) <= new Date()
  );

  const watchedInSeason = airedEpisodes.filter(
    (ep) => watchedEpisodes.has(`${season.season_number}-${ep.episode_number}`)
  );

  const progressPercent =
    airedEpisodes.length > 0
      ? Math.round((watchedInSeason.length / airedEpisodes.length) * 100)
      : 0;

  const allWatched = watchedInSeason.length === airedEpisodes.length && airedEpisodes.length > 0;
  const someWatched = watchedInSeason.length > 0 && !allWatched;

  const handleToggleSeason = () => {
    if (!isOwner) return;
    const allEpisodeNumbers = airedEpisodes.map((ep) => ep.episode_number);
    onMarkSeason(season.season_number, allEpisodeNumbers);
  };

  const handleToggleEpisode = (epNum: number) => {
    if (!isOwner) return;
    const key = `${season.season_number}-${epNum}`;
    setToggling((prev) => new Set(prev).add(key));
    onToggleEpisode(season.season_number, epNum);
    setTimeout(() => {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 500);
  };

  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 overflow-hidden">
      {/* Season Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-surface-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-surface-100">
              {season.name}
            </h3>
            <p className="text-xs text-surface-500">
              {airedEpisodes.length} episode{airedEpisodes.length !== 1 ? "s" : ""} · {watchedInSeason.length} watched
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress Bar */}
          <div className="hidden sm:block w-24">
            <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  allWatched ? "bg-brand-500" : "bg-surface-600"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-medium text-surface-400 w-10 text-right">
            {progressPercent}%
          </span>
        </div>
      </button>

      {/* Expanded Episodes */}
      {expanded && (
        <div className="border-t border-surface-700/60">
          {/* Bulk Actions */}
          {isOwner && airedEpisodes.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-surface-800/30 border-b border-surface-700/40">
              <button
                onClick={handleToggleSeason}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-700 text-surface-200 hover:bg-surface-600 transition-colors"
              >
                {allWatched ? "Unmark season" : "Mark season watched"}
              </button>
              {!allWatched && (
                <button
                  onClick={() => {
                    const firstUnwatched = airedEpisodes.find(
                      (ep) => !watchedEpisodes.has(`${season.season_number}-${ep.episode_number}`)
                    );
                    if (firstUnwatched) {
                      onMarkUpTo(season.season_number, firstUnwatched.episode_number);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 transition-colors"
                >
                  Mark up to next unwatched
                </button>
              )}
            </div>
          )}

          {/* Episode List */}
          <div className="divide-y divide-surface-700/40">
            {airedEpisodes.map((ep) => {
              const isWatched = watchedEpisodes.has(
                `${season.season_number}-${ep.episode_number}`
              );
              const isToggling = toggling.has(
                `${season.season_number}-${ep.episode_number}`
              );

              return (
                <div
                  key={ep.episode_number}
                  className={`flex items-center gap-3 p-3 transition-colors ${
                    isWatched ? "bg-brand-500/5" : "hover:bg-surface-800/30"
                  }`}
                >
                  {/* Checkbox */}
                  {isOwner ? (
                    <button
                      onClick={() => handleToggleEpisode(ep.episode_number)}
                      disabled={isToggling}
                      className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        isWatched
                          ? "bg-brand-500 border-brand-500 text-surface-950"
                          : "border-surface-600 hover:border-surface-400"
                      }`}
                    >
                      {isToggling ? (
                        <LoadingSpinner size="sm" className="border-t-white w-3 h-3" />
                      ) : isWatched ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : null}
                    </button>
                  ) : (
                    <div
                      className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                        isWatched
                          ? "bg-brand-500/30 border-brand-500/50"
                          : "border-surface-700"
                      }`}
                    >
                      {isWatched && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                  )}

                  {/* Episode Number */}
                  <span className="shrink-0 w-8 text-sm font-medium text-surface-500">
                    E{ep.episode_number}
                  </span>

                  {/* Episode Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium line-clamp-1 ${isWatched ? "text-surface-300" : "text-surface-100"}`}>
                      {ep.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {ep.air_date && (
                        <span className="text-xs text-surface-500">
                          {new Date(ep.air_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {ep.runtime && (
                        <span className="text-xs text-surface-600">·</span>
                      )}
                      {ep.runtime && (
                        <span className="text-xs text-surface-500">
                          {ep.runtime}m
                        </span>
                      )}
                      {ep.vote_average != null && ep.vote_average > 0 && (
                        <>
                          <span className="text-xs text-surface-600">·</span>
                          <span className="text-xs text-accent-gold">
                            ★ {ep.vote_average.toFixed(1)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Still Image */}
                  {ep.still_path && (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${ep.still_path}`}
                      alt=""
                      className="shrink-0 w-20 aspect-video rounded object-cover hidden sm:block"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
