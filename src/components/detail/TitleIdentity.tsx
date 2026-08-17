"use client";

import React from "react";
import Link from "next/link";
import { Play, Share2, Star } from "lucide-react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import { useCountry } from "@/app/contextAPI/countryContext";
import { movieCertification, tvCertification } from "@/utils/title/certification";
import { pickLogo, formatRuntime, type LogoSource } from "@/utils/title/logo";
import { buildBrowseUrl } from "@/utils/browseUrl";
import { releaseInfo } from "@/utils/releaseInfo";
import type { MediaStatus } from "@/app/contextAPI/userPrefrence";

/**
 * Who this title is, said once.
 *
 * Both detail pages opened with the same pile: a star chip, a year chip, a
 * runtime chip, a certificate chip, a country chip, then a second row of genre
 * chips underneath. Six boxes, each holding one word, arranged so the reader
 * has to assemble the sentence themselves — and on a phone that pile ran four
 * rows deep before the synopsis started. The facts were all there; the reading
 * was not.
 *
 * So the chips become one line. "2014 · 2h 49m · UA · Sci-Fi, Drama" is the
 * same five facts in the order a person would say them, and it costs one row
 * instead of four. The separators come from `.meta-row`, which hangs the dot
 * off the item that FOLLOWS it, so a wrapped line never strands a dot at the
 * end and a missing year never leaves one at the start.
 *
 * The heading above it is the title's own artwork wherever TMDB has it, which
 * measured 12 titles out of 12 — including the Indian ones, which is where a
 * feature like this usually falls over.
 */

export type TitleIdentityView = {
  id: number | string;
  title: string;
  tagline: string | null;
  overview: string | null;
  /** Raw TMDB path; ThreePrefrenceBtn resolves it. */
  posterPath: string | null;
  adult: boolean;
  genres: { id: number; name: string }[];
  /** TMDB `images`, or the `logos` array off it. */
  logos: LogoSource;
  /** Release year (film) or first-air year (series). */
  year: string | null;
  /** Series only, and only when the show has stopped and it differs. */
  endYear: string | null;
  /** Film only, in minutes. */
  runtime: number | null;
  /** Series only. */
  seasonCount: number | null;
  episodeCount: number | null;
  /** TMDB's production status, verbatim. */
  status: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  /** Film certification source: `release_dates.results`. */
  releaseDates?: { iso_3166_1?: string; release_dates?: { certification?: string }[] }[];
  /** Series certification source: `content_ratings.results`. */
  contentRatings?: { iso_3166_1?: string; rating?: string }[];
};

type TitleIdentityProps = {
  kind: "movie" | "tv";
  view: TitleIdentityView;
  hasTrailer?: boolean;
  onPlayTrailer?: () => void;
  onShare: () => void;
  /** TV only: marking a series watched opens the episode modal instead. */
  onAddWatchedTv?: (intended: MediaStatus | null) => void;
  /** Sits under the verdict line: "In cinemas 16 December", "Next: S3E4". */
  notice?: React.ReactNode;
  /** Sits under the action row — the vitals grid, or anything else the page owns. */
  children?: React.ReactNode;
};

/**
 * Three lines of synopsis is roughly 260 characters on the 672px column and
 * roughly 130 on a 375px phone, at text-sm. Overviews measured across twelve
 * titles run 100-385 characters, median 198 — which lands most of them between
 * those two numbers: clipped on a phone, complete on a desktop. Nothing here
 * can measure the rendered text, so the control is rendered for anything over
 * the phone figure and hidden at `sm` for the middle band, where there is
 * nothing left to reveal.
 */
const EXPAND_ALWAYS = 260;
const EXPAND_ON_PHONE = 130;

type Segment = {
  key: string;
  node: React.ReactNode;
  /** Dropped below `sm`. Never applied to the first segment, or the line would open with a stray dot. */
  minor?: boolean;
  title?: string;
};

export default function TitleIdentity({
  kind,
  view,
  hasTrailer = false,
  onPlayTrailer,
  onShare,
  onAddWatchedTv,
  notice,
  children,
}: TitleIdentityProps) {
  // Client-side, like the chips it replaces: the route stays static and the
  // certificate follows the country selector without a round trip.
  const { country } = useCountry();
  const cert =
    kind === "movie"
      ? movieCertification(view.releaseDates, country)
      : tvCertification(view.contentRatings, country);

  const logo = pickLogo(view.logos);
  const genres = view.genres ?? [];
  const overview = view.overview?.trim() ?? "";
  const tagline = view.tagline?.trim() ?? "";

  const segments: Segment[] = [];

  // One range, not the two separate year chips a series used to get. A film
  // has no end year, so this reduces to the single year on its own.
  const years =
    view.endYear && view.endYear !== view.year ? `${view.year}–${view.endYear}` : view.year;
  if (years) segments.push({ key: "years", node: <span className="tabular-nums">{years}</span> });

  if (kind === "movie") {
    const runtime = formatRuntime(view.runtime);
    if (runtime) segments.push({ key: "runtime", node: runtime });
  } else {
    const counts = seriesSize(view.seasonCount, view.episodeCount);
    if (counts) segments.push({ key: "size", node: counts });
  }

  const status = statusLabel(kind, view.status);
  if (status) {
    segments.push({
      key: "status",
      node: status,
      // A closed range already reads as finished, so on a phone this is the
      // first thing to go. It stays on a running show, where "Returning" is
      // news the years cannot carry.
      minor: kind === "tv" && !!view.endYear,
    });
  }

  if (cert) {
    segments.push({
      key: "cert",
      // The country travels with a borrowed rating. A US certificate shown
      // unlabelled to an Indian reader is a confident lie; labelled, it is a
      // useful approximation.
      node: (
        <>
          {cert.value}
          {!cert.isLocal && <span className="text-surface-500"> ({cert.country})</span>}
        </>
      ),
      title: cert.isLocal ? undefined : `Certificate issued in ${cert.country}`,
    });
  }

  if (genres.length > 0) {
    segments.push({
      key: "genres",
      // Still links. A genre is a door to more of this, and discovery is the
      // point of the page — but three of them is the whole sentence's width,
      // and TMDB hands out five.
      node: genres.slice(0, 3).map((g, i) => (
        <React.Fragment key={g.id}>
          {i > 0 && ", "}
          <Link
            href={buildBrowseUrl({ type: kind, genre: String(g.id) })}
            className="hover:text-white transition-colors"
          >
            {g.name}
          </Link>
        </React.Fragment>
      )),
    });
  }

  // TMDB's score, last and dimmed and first to go. It is reference material on
  // a page whose subject is what YOU did with this title — the site's own
  // numbers live in the sidebar, where they can be attributed to people.
  const voteAverage = view.voteAverage ?? 0;
  const voteCount = view.voteCount ?? 0;
  if (voteAverage > 0 && voteCount > 0) {
    segments.push({
      key: "score",
      minor: true,
      node: (
        <span className="inline-flex items-center gap-1 text-accent-gold">
          <Star className="size-3.5 fill-current" aria-hidden />
          {voteAverage.toFixed(1)}
          {/* A 10.0 from three people is not a 10.0. */}
          <span className="text-surface-500 text-xs">({voteCount.toLocaleString()})</span>
        </span>
      ),
      title: `TMDB score from ${voteCount.toLocaleString()} votes`,
    });
  }

  const expandable = overview.length > EXPAND_ON_PHONE;
  const phoneOnlyExpand = overview.length <= EXPAND_ALWAYS;

  return (
    <>
      {logo ? (
        <>
          {/* The outline must not depend on an image loading, or on TMDB
              having one. The <h1> is always here and always carries the name;
              the artwork is decorative beside it, so its alt stays empty
              rather than reading the same words twice. */}
          <h1 className="sr-only">{view.title}</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.url}
            alt=""
            className="h-auto w-auto max-h-[112px] max-w-full object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]"
            decoding="async"
          />
        </>
      ) : (
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{view.title}</h1>
      )}

      <div className="meta-row mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-surface-300">
        {segments.map((s, i) => (
          <span
            key={s.key}
            title={s.title}
            // `hidden` is display:none, so a dropped segment takes its dot with
            // it. Guarding on the index keeps the first one visible whatever
            // its priority, since `.meta-row` only skips the leading dot for
            // the first CHILD, not the first visible one.
            className={s.minor && i > 0 ? "hidden items-center sm:block" : undefined}
          >
            {s.node}
          </span>
        ))}
      </div>

      {notice}

      {tagline && <p className="mt-4 text-lg text-surface-400 italic">&ldquo;{tagline}&rdquo;</p>}

      {/* A <details> rather than a useState, because this is the hero of a
          server-rendered page and an expander is exactly what the element is
          for. No hydration, no layout read, works before the JS lands. */}
      {overview &&
        (expandable ? (
          <details className="group mt-4 max-w-2xl">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-surface-300 group-open:hidden">
                {overview}
              </span>
              <span
                className={`mt-1.5 inline-block text-xs font-medium text-brand-400 group-open:hidden ${
                  phoneOnlyExpand ? "sm:hidden" : ""
                }`}
              >
                Read more
              </span>
              <span className="mt-1.5 hidden text-xs font-medium text-brand-400 group-open:inline-block">
                Show less
              </span>
            </summary>
            <p className="whitespace-pre-line text-sm leading-relaxed text-surface-300">
              {overview}
            </p>
          </details>
        ) : (
          <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-surface-300">
            {overview}
          </p>
        ))}

      <div className="flex flex-wrap items-center gap-2 mt-5">
        <ThreePrefrenceBtn
          variant="detail"
          cardId={view.id}
          cardType={kind}
          cardName={view.title}
          cardAdult={view.adult}
          cardImg={view.posterPath}
          genres={genres.map((g) => g.name)}
          onAddWatchedTv={kind === "tv" ? onAddWatchedTv : undefined}
        />
        {hasTrailer && onPlayTrailer && (
          <button
            onClick={onPlayTrailer}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 border border-brand-500/20 text-sm font-medium transition-colors"
          >
            <Play className="size-4 fill-current" /> Trailer
          </button>
        )}
        <button
          onClick={onShare}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-800/60 text-surface-300 hover:text-white border border-surface-700/50 text-sm font-medium transition-colors"
        >
          <Share2 className="size-4" /> Share
        </button>
      </div>

      {children}
    </>
  );
}

/** "5 seasons, 62 episodes" — one segment, because the two numbers only mean anything together. */
function seriesSize(seasons: number | null, episodes: number | null): string | null {
  const parts: string[] = [];
  if (seasons && seasons > 0) parts.push(`${seasons} season${seasons === 1 ? "" : "s"}`);
  if (episodes && episodes > 0) parts.push(`${episodes} episode${episodes === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

function statusLabel(kind: "movie" | "tv", status: string | null): string | null {
  const value = status?.trim();
  if (!value) return null;
  // "Released", next to the release year, is a word that earns nothing. The
  // other film statuses — Post Production, Rumored — are the whole story.
  if (kind === "movie") return value === "Released" ? null : value;
  // TMDB's own phrasing, in a line that is meant to read as a sentence.
  return value === "Returning Series" ? "Returning" : value;
}

/* ── Normalisers ──
   The two clients hand over TMDB's shapes; the component sees one shape. These
   live here so the field names can never drift apart from the view model. */

type MovieSource = {
  id: number | string;
  title?: string | null;
  tagline?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  adult?: boolean;
  genres?: { id: number; name: string }[] | null;
  images?: { logos?: unknown } | null;
  release_date?: string | null;
  runtime?: number | null;
  status?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
};

export function movieIdentity(
  movie: MovieSource,
  releaseDates?: TitleIdentityView["releaseDates"],
): TitleIdentityView {
  return {
    id: movie.id,
    title: movie.title ?? "",
    tagline: movie.tagline ?? null,
    overview: movie.overview ?? null,
    posterPath: movie.poster_path ?? null,
    adult: movie.adult ?? false,
    genres: movie.genres ?? [],
    logos: (movie.images ?? null) as LogoSource,
    year: releaseInfo(movie.release_date).year,
    endYear: null,
    runtime: movie.runtime ?? null,
    seasonCount: null,
    episodeCount: null,
    status: movie.status ?? null,
    voteAverage: movie.vote_average ?? null,
    voteCount: movie.vote_count ?? null,
    releaseDates,
  };
}

type TvSource = {
  id: number | string;
  name?: string | null;
  tagline?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  adult?: boolean;
  genres?: { id: number; name: string }[] | null;
  images?: { logos?: unknown } | null;
  first_air_date?: string | null;
  last_air_date?: string | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  in_production?: boolean;
  status?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
};

export function tvIdentity(
  show: TvSource,
  contentRatings?: TitleIdentityView["contentRatings"],
): TitleIdentityView {
  const first = releaseInfo(show.first_air_date).year;
  const last = releaseInfo(show.last_air_date).year;
  return {
    id: show.id,
    title: show.name ?? "",
    tagline: show.tagline ?? null,
    overview: show.overview ?? null,
    posterPath: show.poster_path ?? null,
    adult: show.adult ?? false,
    genres: show.genres ?? [],
    logos: (show.images ?? null) as LogoSource,
    year: first,
    // A running show's last_air_date is only its most recent episode, and
    // "2016–2025" on something still airing reads as finished.
    endYear: show.in_production ? null : last,
    runtime: null,
    seasonCount: show.number_of_seasons ?? null,
    episodeCount: show.number_of_episodes ?? null,
    status: show.status ?? null,
    voteAverage: show.vote_average ?? null,
    voteCount: show.vote_count ?? null,
    contentRatings,
  };
}
