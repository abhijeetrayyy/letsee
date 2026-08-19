"use client";

import Link from "next/link";
import { useState } from "react";
import EpisodeManagementModal from "@components/tv/EpisodeManagementModal";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import type { MediaStatus } from "@/app/contextAPI/userPrefrence";

type TvShowCardProps = {
  showId: string;
  showName: string;
  posterPath: string | null;
  seasonsCompleted: number;
  episodesWatched: number;
  totalEpisodes: number;
  nextSeason: number | null;
  nextEpisode: number | null;
  allComplete: boolean;
  caughtUp?: boolean;
  nextAirDate?: string | null;
  tvStatus: string | null;
  isOwner: boolean;
  onMarkNext: (showId: string) => void;
  markingId: string | null;
  onEpisodesChanged?: () => void;
};

// The badge sits on an arbitrary poster, so only the text and the ring carry
// colour — the background is a near-opaque scrim. A 20%-tint chip vanished
// over anything bright, which is most posters.
const STATUS_COLORS: Record<string, string> = {
  watchlist: "text-surface-200 ring-surface-300/40",
  watching: "text-emerald-300 ring-emerald-400/50",
  watched: "text-brand-300 ring-brand-400/50",
  on_hold: "text-amber-300 ring-amber-400/50",
  dropped: "text-red-300 ring-red-400/50",
};

const STATUS_LABELS: Record<string, string> = {
  watchlist: "Watchlist",
  watching: "Watching",
  watched: "Watched",
  on_hold: "On Hold",
  dropped: "Dropped",
};

export default function TvShowCard({
  showId,
  showName,
  posterPath,
  seasonsCompleted,
  episodesWatched,
  totalEpisodes,
  nextSeason,
  nextEpisode,
  allComplete,
  caughtUp = false,
  nextAirDate = null,
  tvStatus,
  isOwner,
  onMarkNext,
  markingId,
  onEpisodesChanged,
}: TvShowCardProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [tvModalOpen, setTvModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MediaStatus | null>(null);

  const percent =
    totalEpisodes > 0
      ? Math.min(100, Math.round((episodesWatched / totalEpisodes) * 100))
      : 0;

  const statusColor = STATUS_COLORS[tvStatus ?? ""] ?? STATUS_COLORS.watchlist;
  const statusLabel = STATUS_LABELS[tvStatus ?? ""] ?? "Not Started";
  const posterUrl = posterPath
    ? `https://image.tmdb.org/t/p/w185${posterPath}`
    : "/no-photo.webp";

  return (
    <>
      <div className="group flex flex-col rounded-xl border border-surface-700/60 bg-surface-900/40 overflow-hidden hover:border-surface-500/60 transition-all duration-300">
        {/* Poster & Overlay */}
        <Link
          href={`/app/tv/${showId}`}
          className="relative aspect-[2/3] overflow-hidden"
        >
          <img
            src={posterUrl}
            alt={showName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/40 to-transparent" />

          {/* Status Badge */}
          <div className="absolute top-2 left-2">
            <span className={`px-2 py-0.5 rounded-md bg-surface-950/90 backdrop-blur-md ring-1 text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
              {statusLabel}
            </span>
          </div>

          {/* Caught up is its own state, not a variant of "watching".
              Someone current on an ongoing show has finished everything that
              exists — the honest label is that they're waiting, not that
              they're behind. */}
          {caughtUp && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 rounded-md bg-surface-950/90 backdrop-blur-md ring-1 ring-sky-400/50 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                Caught up
              </span>
            </div>
          )}

          {/* Progress Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="w-full h-1 bg-surface-800/80 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-white font-medium">
              {episodesWatched}/{totalEpisodes} eps
            </p>
          </div>
        </Link>

        {/* Content */}
        <div className="flex flex-col bg-surface-900/40">
          <div className="p-3 flex flex-col gap-2">
            <Link
              href={`/app/tv/${showId}`}
              className="text-sm font-semibold text-surface-100 line-clamp-1 hover:text-brand-400 transition-colors"
            >
              {showName}
            </Link>

            {/* Quick Actions */}
            {caughtUp ? (
              <p className="w-full py-1.5 text-center text-xs text-sky-300/80">
                {nextAirDate
                  ? `Next airs ${new Date(nextAirDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                  : "Waiting on the next episode"}
              </p>
            ) : null}
            {isOwner && !caughtUp && !allComplete && nextSeason && nextEpisode && (
              <button
                onClick={() => onMarkNext(showId)}
                disabled={markingId === showId}
                className="w-full py-1.5 rounded-lg bg-brand-500/20 text-brand-400 text-xs font-semibold hover:bg-brand-500/30 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {markingId === showId ? (
                  <>
                    <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Marking…
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Mark S{nextSeason}E{nextEpisode}
                  </>
                )}
              </button>
            )}

            {isOwner && (
              <button
                onClick={() => setEditModalOpen(true)}
                className="w-full py-1.5 rounded-lg bg-surface-800 text-surface-300 text-xs font-medium hover:bg-surface-700 transition-colors"
              >
                Manage episodes
              </button>
            )}
          </div>

          {/* Preference Buttons */}
          {/* Square-cornered buttons at the very bottom of a card that is
              `rounded-xl overflow-hidden`, so the card's radius was slicing the
              fills off on the diagonal instead of curving with them — most
              visibly the favourite heart in the bottom-right corner. Rounding
              the row itself makes the fill follow the corner. 11px, not 12: the
              card's 12px radius is measured outside a 1px border, and a nested
              shape has to subtract it or it bulges. MediaCard carries the same
              fix and the same note; this card never got it. */}
          <div className="overflow-hidden rounded-b-[11px] border-t border-surface-700/50">
            <ThreePrefrenceBtn
              variant="compact"
              cardId={showId}
              cardType="tv"
              cardName={showName}
              cardImg={posterPath ?? undefined}
              genres={[]}
              onAddWatchedTv={(intended) => { setPendingStatus(intended); setTvModalOpen(true); }}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {editModalOpen && (
        <EpisodeManagementModal
          showId={showId}
          showName={showName}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            setEditModalOpen(false);
            onEpisodesChanged?.();
          }}
        />
      )}

      {tvModalOpen && (
        <EpisodeManagementModal
          showId={showId}
          showName={showName}
          isOpen={tvModalOpen}
          intendedStatus={pendingStatus}
          onClose={() => { setTvModalOpen(false); setPendingStatus(null); }}
          onSuccess={() => {
            setTvModalOpen(false);
            setPendingStatus(null);
            onEpisodesChanged?.();
          }}
        />
      )}
    </>
  );
}
