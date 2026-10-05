"use client";

import Link from "@components/ui/AppLink";
import Faces from "@components/ds/Faces";
import { QuickMarkButton } from "@components/ds/QuickMarks";
import { releaseInfo } from "@/utils/releaseInfo";
import { titlePath, personPath } from "@/utils/urls";

/**
 * The one card for a film, a series or a person (docs/design/SYSTEM.md §8,
 * `TitleCard`): the poster, the title, one line beneath. Two things on the
 * art — where *you* stand with it, top right, and the faces of your people
 * who have seen it, bottom left. No rating chips, no genre or type badges, no
 * hover lift.
 *
 * Where you stand is a button now (ds/QuickMarks): ✓ watched, ▶ watching,
 * ◷ watch later, ♥ favourite, or a plus — and tapping it marks the title
 * right there, on any page the card is on (owner review, 5 Oct 2026). It sits
 * beside the link, not inside it: a button inside a link is two controls in
 * one, and the tap would open the page too.
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
  const isPerson = mediaType === "person";
  const src = adult && !imageUrl ? "/pixeled.webp" : imageUrl ?? (posterPath ? `${isPerson ? FACE : POSTER}${posterPath}` : "/no-photo.svg");
  const href = isPerson ? personPath(id, title) : titlePath(mediaType, id, title);

  const release = releaseInfo(releaseDate);
  const line = role ?? knownFor ?? (release.isUpcoming ? `Out ${release.short}` : year ?? release.year ?? null);

  return (
    <div className={`group relative min-w-0 ${className}`} style={style}>
      <Link href={href} data-nav-title={title} className="block min-w-0">
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
      {!isPerson && !hideState && (
        <QuickMarkButton
          title={{ itemId: String(id), itemType: mediaType, itemName: title, imageUrl: imageUrl ?? (posterPath ? `${POSTER}${posterPath}` : null), adult }}
          className="absolute right-1.5 top-1.5"
        />
      )}
    </div>
  );
}
