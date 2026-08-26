"use client";

import Link from "@components/ui/AppLink";
import React, { useState } from "react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import EpisodeManagementModal from "@components/tv/EpisodeManagementModal";
import type { MediaStatus } from "@/app/contextAPI/userPrefrence";
import { Film, Tv, User, Star, Calendar } from "lucide-react";
import { releaseInfo } from "@/utils/releaseInfo";
import { titlePath } from "@/utils/urls";

const TMDB_POSTER = "https://image.tmdb.org/t/p/w342";
const TMDB_PROFILE = "https://image.tmdb.org/t/p/h632";


function href(mediaType: string, id: number, title: string): string {
  return titlePath(mediaType, id, title);
}

export type MediaCardProps = {
  id: number;
  title: string;
  mediaType: "movie" | "tv" | "person";
  imageUrl?: string | null;
  posterPath?: string | null;
  adult?: boolean;
  genres?: string[];
  showActions?: boolean;
  onShare?: (e: React.MouseEvent) => void;
  typeLabel?: string;
  year?: string | null;
  subtitle?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  knownFor?: string | null;
  rating?: number | null;
  /** Optional rank number (e.g. trending position) shown as a badge. */
  rank?: number;
  /** Raw TMDB date ("2026-12-16"). Drives the year and the upcoming badge. */
  releaseDate?: string | null;
  /** Votes behind `rating` — a 10.0 from three people is not a 10.0. */
  voteCount?: number | null;
  /** Shown on hover, so you can tell two same-named titles apart. */
  overview?: string | null;
  /** Only worth showing when it differs from `title`. */
  originalTitle?: string | null;
  /**
   * What this person did on this title — "Director, Screenplay" for a crew
   * credit, the character name for an acting one. Gets its own line.
   */
  role?: string | null;
};

export default function MediaCard({
  id,
  title,
  mediaType,
  imageUrl: imageUrlProp,
  posterPath,
  adult = false,
  genres = [],
  showActions = true,
  onShare,
  typeLabel,
  year,
  subtitle,
  className = "",
  style,
  knownFor,
  rating,
  rank,
  releaseDate,
  voteCount,
  overview,
  originalTitle,
  role,
}: MediaCardProps) {
  const [tvModalOpen, setTvModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MediaStatus | null>(null);
  const isPerson = mediaType === "person";
  const typeBadge = typeLabel ?? (isPerson ? "person" : mediaType);

  const imageUrl = imageUrlProp ?? (posterPath && !adult
    ? (isPerson ? `${TMDB_PROFILE}${posterPath}` : `${TMDB_POSTER}${posterPath}`)
    : null);
  const imgSrc = adult && !imageUrlProp ? "/pixeled.webp" : imageUrl ?? "/no-photo.webp";
  const detailHref = href(mediaType, id, title);

  const release = releaseInfo(releaseDate);
  // Callers that already computed a year keep theirs; the rest get it here.
  const yearLabel = year ?? release.year;
  const altTitle = originalTitle && originalTitle !== title ? originalTitle : null;
  /**
   * Only real extra detail earns the overlay.
   *
   * `release.full` used to count, which meant any card carrying a date got a
   * black gradient washed over the bottom of its artwork on hover — to reveal
   * a rating and a date that are both printed under the poster anyway. On a
   * filmography grid that is every card: the poster you are looking at gets
   * darkened to show you nothing you did not have.
   *
   * The overview and the original title are genuinely only available here, so
   * those still earn it — and where they appear the gradient is doing real
   * work, keeping small text legible over arbitrary artwork.
   */
  const hasHoverDetail = !isPerson && Boolean(overview || altTitle);
  // knownFor was accepted and then silently dropped; it belongs in the same
  // slot as a crew job — both answer "what is this person to this entry".
  const roleLabel = role ?? knownFor ?? null;

  const genreList = Array.isArray(genres) ? genres.filter((g): g is string => typeof g === "string") : [];
  const onAddWatchedTv = mediaType === "tv" && showActions
    ? (intended: MediaStatus | null) => { setPendingStatus(intended); setTvModalOpen(true); }
    : undefined;

  return (
    <div
      className={`group relative flex flex-col rounded-xl overflow-hidden bg-surface-900/60 border border-surface-800/40 transition-all duration-300 hover:border-brand-500/20 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 ${className}`}
      style={style}
    >
      {/* Poster */}
      <Link href={detailHref} className="relative block overflow-hidden">
        <img
          src={imgSrc}
          alt={title}
          className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${isPerson ? "aspect-square" : "aspect-[2/3]"}`}
          loading="lazy"
          decoding="async"
        />

        {/* Type badge top-left */}
        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-semibold uppercase tracking-wider text-surface-200">
          {isPerson ? (
            <User className="size-2.5 inline mr-0.5" />
          ) : mediaType === "tv" ? (
            <Tv className="size-2.5 inline mr-0.5" />
          ) : (
            <Film className="size-2.5 inline mr-0.5" />
          )}
          {typeBadge}
        </span>

        {/* Rating badge top-right */}
        {rating != null && (
          <span className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-accent-gold">
            <Star className="size-2.5 fill-current" />
            {rating.toFixed(1)}
          </span>
        )}

        {/* Rank badge bottom-left */}
        {rank != null && (
          <span className="absolute bottom-2 left-2 w-5 h-5 rounded-md bg-black/70 backdrop-blur-sm flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
            {rank}
          </span>
        )}

        {/* Hover detail. Desktop only: touch devices have no hover, and a
            group-hover layer there sticks open after a tap. Everything a
            phone needs is in the always-visible row under the poster. */}
        {hasHoverDetail && (
          <div className="pointer-events-none absolute inset-0 hidden sm:flex flex-col justify-end gap-1 p-2.5 bg-gradient-to-t from-black via-black/85 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {altTitle && <p className="text-[10px] text-surface-400 line-clamp-1">{altTitle}</p>}
            {overview && (
              <p className="text-[10px] leading-snug text-surface-300 line-clamp-4">{overview}</p>
            )}
          </div>
        )}
      </Link>

      {/* Title and year */}
      <div className="p-2.5 flex-1">
        <Link href={detailHref} className="block">
          <h3 className="text-xs font-medium text-surface-200 line-clamp-2 leading-snug group-hover:text-brand-400 transition-colors">
            {title}
          </h3>
        </Link>
        {/* The role used to share one line with the year, so it was clipped
            after a few characters — "Director" and "Screenplay" looked
            identical on a 140px card. It gets its own line now, unclamped:
            someone who directed, shot and cut a short has six jobs listed,
            and truncating that is the bug this is fixing. A taller row is
            the cheaper price. */}
        {roleLabel && (
          <p className="mt-1 text-[10px] font-medium leading-snug text-brand-400/90">
            {roleLabel}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {/* An unreleased title used to look like any other: a bare year with
              no hint you can't watch it yet. This says the date outright, and
              stays visible on mobile where there is no hover. */}
          {release.isUpcoming ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-400">
              <Calendar className="size-2.5 shrink-0" aria-hidden />
              {release.short}
            </span>
          ) : (
            yearLabel && <span className="text-[10px] text-surface-500">{yearLabel}</span>
          )}
          {/* No rating here — the gold badge on the poster's top-right corner
              already carries it, always, on every device. */}
          {subtitle && (
            <span className="text-[10px] text-surface-500 line-clamp-1">{subtitle}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && !isPerson && (
        /* The button row is square-cornered and sits at the very bottom of a
           card that is `rounded-xl overflow-hidden`, so the card's radius was
           slicing the button fills off on the diagonal instead of curving with
           them. Rounding the row itself makes the fill follow the corner.
           11px, not 12: the card's 12px radius is measured outside a 1px
           border, and a nested shape has to subtract it or it bulges. */
        <div className="overflow-hidden rounded-b-[11px] border-t border-surface-800/30">
          <ThreePrefrenceBtn
            variant="compact"
            cardId={id}
            cardType={mediaType}
            cardName={title}
            cardAdult={adult}
            cardImg={imageUrl ?? undefined}
            genres={genreList}
            onAddWatchedTv={onAddWatchedTv}
          />
        </div>
      )}

      {/* Episode management modal */}
      {mediaType === "tv" && showActions && tvModalOpen && (
        <EpisodeManagementModal
          showId={String(id)}
          showName={title}
          isOpen={tvModalOpen}
          intendedStatus={pendingStatus}
          onClose={() => { setTvModalOpen(false); setPendingStatus(null); }}
          onSuccess={() => { setTvModalOpen(false); setPendingStatus(null); }}
        />
      )}
    </div>
  );
}

export { href as mediaCardHref };
