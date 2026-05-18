"use client";

/**
 * MediaCard – single centralized card for movie/TV/person tiles across the app.
 */

import Link from "next/link";
import React, { useState, useContext } from "react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import MarkTVWatchedModal from "@components/tv/MarkTVWatchedModal";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
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
}: MediaCardProps) {
  const [tvModalOpen, setTvModalOpen] = useState(false);
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const isPerson = mediaType === "person";
  const typeBadge = typeLabel ?? mediaType;
  const imageUrl =
    imageUrlProp ??
    (posterPath && !adult
      ? isPerson
        ? `${TMDB_PROFILE}${posterPath}`
        : `${TMDB_POSTER}${posterPath}`
      : null);
  const imgSrc =
    adult && !imageUrlProp ? "/pixeled.webp" : imageUrl ?? "/no-photo.webp";
  const detailHref = href(mediaType, id, title);
  const imgUrlForTvPayload =
    imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")
      ? imageUrl
      : posterPath && !adult
        ? `${TMDB_POSTER}${posterPath}`
        : "";
  const tvWatchedPayload = {
    itemId: id,
    name: title,
    imgUrl: imgUrlForTvPayload,
    adult,
    genres: Array.isArray(genres)
      ? genres.filter((g): g is string => typeof g === "string")
      : [],
  };
  const onAddWatchedTv =
    mediaType === "tv" ? () => setTvModalOpen(true) : undefined;

  const cardClass =
    "group relative flex flex-col shrink-0 overflow-hidden rounded-2xl bg-surface-900/80 border border-surface-700/40 poster-shadow transition-all duration-300 ease-out hover:bg-surface-800/90 hover:border-surface-600/50 hover:-translate-y-1";

  return (
    <div className={`${cardClass} ${className}`} style={style}>
      {/* Type / year badges */}
      <div className="absolute top-2 left-2 right-2 z-10 flex justify-between pointer-events-none">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-surface-200 text-[10px] font-semibold uppercase tracking-wider">
          {typeBadge}
        </span>
        {year && !isPerson && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-surface-300 text-[10px] font-medium">
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
        {/* Gradient overlay */}
        <div
          className="absolute inset-x-0 bottom-0 h-20 pointer-events-none bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity duration-300 md:group-hover:opacity-100"
          aria-hidden
        />
        {/* Desktop hover actions */}
        {showActions && !isPerson && (
          <div className="absolute bottom-0 left-0 right-0 w-full opacity-0 translate-y-2 transition-all duration-300 ease-out pointer-events-none md:group-hover:opacity-100 md:group-hover:translate-y-0 md:group-hover:pointer-events-auto hidden md:block">
            <div className="bg-surface-900/95 backdrop-blur-md border-t border-white/5 min-h-12 flex flex-col justify-center">
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
                  className="flex w-full min-h-[44px] items-center justify-center gap-2 py-2.5 text-surface-300 text-sm font-medium transition-colors hover:text-white hover:bg-white/5 active:bg-white/10 touch-manipulation"
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

      {/* Mobile actions */}
      {showActions && !isPerson && (
        <div className="relative w-full md:hidden bg-surface-900/95 border-t border-white/5 rounded-b-none">
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
              className="flex w-full min-h-[44px] items-center justify-center gap-2 py-2.5 text-surface-300 text-sm font-medium transition-colors hover:text-white hover:bg-white/5 active:bg-white/10 touch-manipulation border-t border-white/5"
              onClick={onShare}
              aria-label="Share"
            >
              <LuSend className="shrink-0 size-4" /> Share
            </button>
          )}
        </div>
      )}

      {/* Title + subtitle */}
      <div className="min-h-14 flex flex-col justify-center px-3 py-3 bg-surface-900 border-t border-surface-700/40 rounded-b-2xl">
        <Link
          href={detailHref}
          className="text-surface-100 text-sm font-semibold line-clamp-2 hover:text-brand-400 transition-colors leading-snug"
        >
          {title}
        </Link>
        {subtitle && (
          <div className="mt-1 text-xs text-surface-500 line-clamp-2 leading-relaxed">
            {subtitle}
          </div>
        )}
        {isPerson && knownFor && (
          <div className="mt-1 text-xs text-surface-500">{knownFor}</div>
        )}
      </div>

      {mediaType === "tv" && (
        <MarkTVWatchedModal
          showId={String(id)}
          showName={title}
          seasons={[]}
          isOpen={tvModalOpen}
          onClose={() => setTvModalOpen(false)}
          onSuccess={() => {
            setTvModalOpen(false);
            refreshPreferences?.();
          }}
          watchedPayload={tvWatchedPayload}
        />
      )}
    </div>
  );
}

export { href as mediaCardHref, slug as mediaCardSlug };
