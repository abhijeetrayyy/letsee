"use client";

import Link from "next/link";
import React, { useState } from "react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import MarkTVWatchedModal from "@components/tv/MarkTVWatchedModal";
import { Film, Tv, User, Star } from "lucide-react";

const TMDB_POSTER = "https://image.tmdb.org/t/p/w342";
const TMDB_PROFILE = "https://image.tmdb.org/t/p/h632";

function slug(title: string): string {
  return title.trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-");
}

function href(mediaType: string, id: number, title: string): string {
  return `/app/${mediaType}/${id}${title ? `-${slug(title)}` : ""}`;
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
}: MediaCardProps) {
  const [tvModalOpen, setTvModalOpen] = useState(false);
  const isPerson = mediaType === "person";
  const typeBadge = typeLabel ?? (isPerson ? "person" : mediaType);

  const imageUrl = imageUrlProp ?? (posterPath && !adult
    ? (isPerson ? `${TMDB_PROFILE}${posterPath}` : `${TMDB_POSTER}${posterPath}`)
    : null);
  const imgSrc = adult && !imageUrlProp ? "/pixeled.webp" : imageUrl ?? "/no-photo.webp";
  const detailHref = href(mediaType, id, title);

  const genreList = Array.isArray(genres) ? genres.filter((g): g is string => typeof g === "string") : [];
  const tvWatchedPayload = { itemId: id, name: title, imgUrl: imageUrl ?? "", adult, genres: genreList };
  const onAddWatchedTv = mediaType === "tv" && showActions ? () => setTvModalOpen(true) : undefined;

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
      </Link>

      {/* Title and year */}
      <div className="p-2.5 flex-1">
        <Link href={detailHref} className="block">
          <h3 className="text-xs font-medium text-surface-200 line-clamp-2 leading-snug group-hover:text-brand-400 transition-colors">
            {title}
          </h3>
        </Link>
        <div className="flex items-center gap-2 mt-1">
          {year && <span className="text-[10px] text-surface-500">{year}</span>}
          {subtitle && (
            <span className="text-[10px] text-surface-500 line-clamp-1">{subtitle}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && !isPerson && (
        <div className="border-t border-surface-800/30">
          <ThreePrefrenceBtn
            variant="compact"
            cardId={id}
            cardType={mediaType}
            cardName={title}
            cardAdult={adult}
            cardImg={posterPath ?? undefined}
            genres={genreList}
            onAddWatchedTv={onAddWatchedTv}
          />
        </div>
      )}

      {/* TV Watched modal */}
      {mediaType === "tv" && showActions && (
        <MarkTVWatchedModal
          showId={String(id)}
          showName={title}
          seasons={[]}
          isOpen={tvModalOpen}
          onClose={() => setTvModalOpen(false)}
          onSuccess={() => setTvModalOpen(false)}
          watchedPayload={tvWatchedPayload}
        />
      )}
    </div>
  );
}

export { href as mediaCardHref, slug as mediaCardSlug };
