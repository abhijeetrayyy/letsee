"use client";

import { useContext } from "react";
import { Bookmark, Check, Play } from "lucide-react";
import Link from "@components/ui/AppLink";
import Faces from "@components/ds/Faces";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { releaseInfo } from "@/utils/releaseInfo";
import { titlePath, personPath } from "@/utils/urls";

/**
 * The one card for a film, a series or a person (docs/design/SYSTEM.md §8,
 * `TitleCard`): the poster, the title, one line beneath. At most two marks on
 * the art — where *you* stand with it, top right (a check once watched, a
 * bookmark when saved, a play mark while you're watching), and the faces of
 * your people who have seen it, bottom left. No rating chips, no genre or type
 * badges, no button strip, no hover lift: a card is a door to the title, and
 * what you can do with a title lives on its page.
 *
 * The props keep the old `MediaCard` names so every caller moved over without
 * re-plumbing; the ones that drew badges (`rating`, `rank`, `typeLabel`) are
 * accepted and ignored.
 */
export type TitleCardProps = {
  id: number | string;
  title: string;
  mediaType: "movie" | "tv" | "person";
  imageUrl?: string | null;
  posterPath?: string | null;
  adult?: boolean;
  /** Raw TMDB date: drives the year, and "out 16 Dec" for something not released yet. */
  releaseDate?: string | null;
  year?: string | null;
  /** What this person did on this title, or why it's here. Replaces the year line. */
  role?: string | null;
  knownFor?: string | null;
  subtitle?: React.ReactNode;
  /** Your people who have seen it. */
  people?: { username: string; avatarUrl: string | null }[];
  /** Hide the state mark (e.g. on your own diary, where every card is watched). */
  hideState?: boolean;
  /** Load now rather than when scrolled near: for the first row of a grid at the top of a page. */
  eager?: boolean;
  className?: string;
  // Accepted for old callers; deliberately not drawn.
  genres?: string[];
  rating?: number | null;
  voteCount?: number | null;
  rank?: number;
  typeLabel?: string;
  overview?: string | null;
  originalTitle?: string | null;
  showActions?: boolean;
  onShare?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
};

const POSTER = "https://image.tmdb.org/t/p/w342";
const FACE = "https://image.tmdb.org/t/p/w185";

export default function TitleCard({
  id,
  title,
  mediaType,
  imageUrl,
  posterPath,
  adult = false,
  releaseDate,
  year,
  role,
  knownFor,
  subtitle,
  people = [],
  hideState = false,
  eager = false,
  className = "",
  style,
}: TitleCardProps) {
  const { getStatus } = useContext(UserPrefrenceContext);
  const isPerson = mediaType === "person";
  const src = adult && !imageUrl ? "/pixeled.webp" : imageUrl ?? (posterPath ? `${isPerson ? FACE : POSTER}${posterPath}` : "/no-photo.svg");
  const href = isPerson ? personPath(id, title) : titlePath(mediaType, id, title);

  const release = releaseInfo(releaseDate);
  const line = role ?? knownFor ?? (release.isUpcoming ? `Out ${release.short}` : year ?? release.year ?? null);
  const status = isPerson || hideState ? null : getStatus(id, mediaType);
  const mark = status === "watched" ? Check : status === "watchlist" ? Bookmark : status === "watching" ? Play : null;
  const markLabel = status === "watched" ? "Watched" : status === "watchlist" ? "Saved" : status === "watching" ? "Watching" : null;

  return (
    <Link href={href} className={`group block min-w-0 ${className}`} style={style}>
      <span className="relative block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={`w-full bg-hover object-cover ring-1 ring-inset ring-line-strong transition-opacity group-hover:opacity-90 ${
            isPerson ? "aspect-square rounded-full" : "aspect-2/3 rounded-media"
          }`}
        />
        {mark && (
          <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-page/85 text-ink-0 ring-1 ring-line-strong" title={markLabel ?? undefined}>
            {(() => {
              const Icon = mark;
              return <Icon className={`size-3.5 ${status === "watchlist" || status === "watching" ? "fill-current" : ""}`} aria-hidden />;
            })()}
            <span className="sr-only">{markLabel}</span>
          </span>
        )}
        {people.length > 0 && (
          <span className="absolute bottom-1.5 left-1.5">
            <Faces people={people} size={20} />
          </span>
        )}
      </span>
      <span className={`mt-2 block ${isPerson ? "text-center" : ""}`}>
        <span className={`line-clamp-2 leading-snug text-ink-0 ${isPerson ? "text-sm font-medium" : "font-display text-base"}`}>{title}</span>
        {line && <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink-500">{line}</span>}
        {subtitle && <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink-500">{subtitle}</span>}
      </span>
    </Link>
  );
}
