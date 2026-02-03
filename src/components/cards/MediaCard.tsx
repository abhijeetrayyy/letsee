"use client";

/**
 * MediaCard – single centralized card for movie/TV/person tiles across the app.
 * All media grids, carousels, and list tiles should use this component (map your
 * data to id, title, mediaType, posterPath/imageUrl, genres, etc.) so one component
 * controls layout, hover actions, and share. Do not duplicate card markup elsewhere.
 */

import Link from "next/link";
import React from "react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import { LuSend } from "react-icons/lu";

const TMDB_POSTER = "https://image.tmdb.org/t/p/w342";
const TMDB_PROFILE = "https://image.tmdb.org/t/p/h632";

function slug(title: string): string {
  return title
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-");
}

function href(mediaType: string, id: number, title: string): string {
  const s = slug(title);
  return `/app/${mediaType}/${id}${s ? `-${s}` : ""}`;
}

export type MediaCardProps = {
  id: number;
  title: string;
  mediaType: "movie" | "tv" | "person";
  /** Full image URL, or pass posterPath to use TMDB. */
  imageUrl?: string | null;
  /** TMDB path (e.g. poster_path); used if imageUrl not set. */
  posterPath?: string | null;
  /** If true and image would show, use pixeled placeholder (e.g. profile). */
  adult?: boolean;
  genres?: string[];
  /** Show Watched / Favorites / Watchlist + Share overlay on hover. */
  showActions?: boolean;
  onShare?: (e: React.MouseEvent) => void;
  /** Badge text (e.g. "movie", "tv", or "mix" type). */
  typeLabel?: string;
  /** Optional year badge (top-right). */
  year?: string | null;
  /** Optional text below title (e.g. "Watched Jan 1", review snippet). */
  subtitle?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Person card: show known_for_department. */
  knownFor?: string | null;
  /** When set for TV, clicking "Watched" (add) opens this instead of toggling. Used for Mark TV Watched modal (e.g. profile watched section). */
  onAddWatchedTv?: () => void;
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
  onAddWatchedTv,
}: MediaCardProps) {
  const isPerson = mediaType === "person";
  const typeBadge = typeLabel ?? mediaType;
  const imageUrl =
    imageUrlProp ??
    (posterPath && !adult
      ? isPerson
        ? `${TMDB_PROFILE}${posterPath}`
        : `${TMDB_POSTER}${posterPath}`
      : null);
  const imgSrc = adult && !imageUrlProp ? "/pixeled.webp" : imageUrl ?? "/no-photo.webp";
  const detailHref = href(mediaType, id, title);

  const cardClass =
    "group relative flex flex-col shrink-0 overflow-hidden rounded-2xl bg-neutral-900/90 border border-neutral-700/50 shadow-lg shadow-black/20 transition-all duration-300 ease-out hover:bg-neutral-800/95 hover:shadow-2xl hover:shadow-black/30 hover:border-neutral-600/50 hover:-translate-y-0.5";

  return (
    <div
      className={`${cardClass} ${className}`}
      style={style}
    >
      {/* Type / year badges – pill style, soft glass */}
      <div className="absolute top-2 left-2 right-2 z-10 flex justify-between pointer-events-none">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-neutral-200 text-[11px] font-medium uppercase tracking-wide">
          {typeBadge}
        </span>
        {year && !isPerson && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-neutral-200 text-[11px] font-medium">
            {year}
          </span>
        )}
      </div>

      {/* Image area */}
      <div className="relative w-full block leading-none overflow-hidden rounded-t-2xl">
        <Link href={detailHref} className="block w-full">
          <img
            src={imgSrc}
            alt={title}
            className={`block w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 align-bottom ${
              isPerson ? "aspect-square" : "aspect-[2/3]"
            }`}
            loading="lazy"
            decoding="async"
          />
        </Link>
        {/* Gradient + overlay: desktop only (md), hover-reveal */}
        <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 md:group-hover:opacity-100" aria-hidden />
        {showActions && !isPerson && (
          <div className="absolute bottom-0 left-0 right-0 w-full opacity-0 translate-y-2 transition-all duration-300 ease-out pointer-events-none md:group-hover:opacity-100 md:group-hover:translate-y-0 md:group-hover:pointer-events-auto hidden md:block">
            <div className="bg-neutral-900/90 backdrop-blur-md border-t border-white/5 min-h-12 flex flex-col justify-center">
              <ThreePrefrenceBtn
                variant="compact"
                cardId={id}
                cardType={mediaType}
                cardName={title}
                cardAdult={adult}
                cardImg={posterPath ?? undefined}
                genres={genres}
                onAddWatchedTv={onAddWatchedTv}
              />
              {onShare != null && (
                <button
                  type="button"
                  className="flex w-full min-h-[44px] items-center justify-center gap-2 py-2.5 text-neutral-300 text-sm font-medium transition-colors hover:text-white hover:bg-white/5 active:bg-white/10 touch-manipulation"
                  onClick={onShare}
                  aria-label="Share"
                >
                  <LuSend className="shrink-0 size-4" /> Share
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions in flow – mobile only: relative, takes space below image */}
      {showActions && !isPerson && (
        <div className="relative w-full md:hidden bg-neutral-900/95 border-t border-white/5 rounded-b-none">
          <ThreePrefrenceBtn
            variant="compact"
            cardId={id}
            cardType={mediaType}
            cardName={title}
            cardAdult={adult}
            cardImg={posterPath ?? undefined}
            genres={genres}
            onAddWatchedTv={onAddWatchedTv}
          />
          {onShare != null && (
            <button
              type="button"
              className="flex w-full min-h-[44px] items-center justify-center gap-2 py-2.5 text-neutral-300 text-sm font-medium transition-colors hover:text-white hover:bg-white/5 active:bg-white/10 touch-manipulation border-t border-white/5"
              onClick={onShare}
              aria-label="Share"
            >
              <LuSend className="shrink-0 size-4" /> Share
            </button>
          )}
        </div>
      )}

      {/* Title + subtitle – border and opaque bg so it doesn’t blend with section background */}
      <div className="min-h-14 flex flex-col justify-center px-3 py-3 bg-neutral-900 border-t border-neutral-700/60 rounded-b-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
        <Link
          href={detailHref}
          className="text-neutral-100 text-sm font-semibold line-clamp-2 hover:text-white transition-colors leading-snug"
        >
          {title}
        </Link>
        {subtitle && (
          <div className="mt-1 text-xs text-neutral-500 line-clamp-2 leading-relaxed">
            {subtitle}
          </div>
        )}
        {isPerson && knownFor && (
          <div className="mt-1 text-xs text-neutral-500">{knownFor}</div>
        )}
      </div>
    </div>
  );
}

export { href as mediaCardHref, slug as mediaCardSlug };
