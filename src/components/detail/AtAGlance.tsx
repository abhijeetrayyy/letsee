"use client";

import { useMemo, useSyncExternalStore } from "react";
import useSWR from "swr";
import { ChevronRight } from "lucide-react";
import Link from "@components/ui/AppLink";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { useToday } from "@/hooks/useToday";
import { swrFetcher } from "@/utils/swrFetcher";
import { buildBrowseUrl } from "@/utils/browseUrl";
import type { CollectionResponse } from "@/app/api/collection/route";
import {
  basedOnGlance,
  collectionGlance,
  creditsGlance,
  endTime,
  filmLengthGlance,
  languageGlance,
  moneyGlance,
  ratingGlance,
  seriesSizeGlance,
  seriesStatusGlance,
  seriesTimeGlance,
  themes as pickThemes,
  type Glance,
  type SeasonRuntime,
} from "@/utils/title/glance";

/**
 * The short version, right under the hero (rules in `utils/title/glance.ts`).
 *
 * One panel of tiles rather than a row of separate cards: it is one object —
 * the answers to "is it good, how long, is it finished, what is it about" —
 * and reads as one, the cells split by hairlines like the stub of a ticket.
 * Two columns on a phone, one row from `lg`. Under it, the title's themes as
 * doors into more of the same.
 */

type Keyword = { id: number; name: string };

export function GlancePanel({ items, keywords, mediaType }: { items: Glance[]; keywords: Keyword[]; mediaType: "movie" | "tv" }) {
  if (items.length === 0 && keywords.length === 0) return null;
  return (
    <section aria-labelledby="at-a-glance" className="flex flex-col gap-4">
      <h2 id="at-a-glance" className="sr-only">
        At a glance
      </h2>
      {items.length > 0 && (
        // An odd tile out spans the row on a phone rather than sitting beside a hole.
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line-strong bg-line-strong [&>div:last-child:nth-child(odd)]:col-span-2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:[&>div:last-child:nth-child(odd)]:col-span-1">
          {items.map((g) => (
            <div key={g.key} className="relative flex min-w-0 flex-col bg-page px-4 py-3">
              <dt className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                {g.label}
                {g.href && <ChevronRight className="size-3.5" aria-hidden />}
              </dt>
              <dd className="mt-1.5 font-display text-2xl leading-tight text-ink-0 tabular-nums">
                {g.href ? (
                  // The link is the answer; its ::after stretches over the
                  // whole tile, so the tile is the target without an <a>
                  // where a `dl` may only hold `dt` and `dd`.
                  <a href={g.href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus">
                    {g.lead}
                  </a>
                ) : (
                  g.lead
                )}
                {g.unit && <span className="ml-0.5 font-sans text-sm text-ink-500">{g.unit}</span>}
              </dd>
              {g.note && <dd className="mt-1 text-sm leading-snug text-ink-400">{g.note}</dd>}
            </div>
          ))}
        </dl>
      )}
      {keywords.length > 0 && (
        // One swipeable line on a phone (two rows of chips cost more height
        // than the tiles above them); wrapped from `sm`, where they fit.
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <span className="mr-1 shrink-0 text-xs font-medium uppercase tracking-wide text-ink-500">Themes</span>
          {keywords.map((k) => (
            <Link
              key={k.id}
              href={buildBrowseUrl({ type: mediaType, keyword: String(k.id) })}
              className="inline-flex h-8 shrink-0 items-center rounded-full px-3 text-sm text-ink-300 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
            >
              {k.name.charAt(0).toUpperCase() + k.name.slice(1)}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* The reader's clock, to the minute, without an effect: null on the server and
   in the first client render, so the two agree; then it ticks. */
const subscribeMinute = (tick: () => void) => {
  const id = window.setInterval(tick, 15_000);
  return () => window.clearInterval(id);
};
const minuteNow = () => Math.floor(Date.now() / 60_000);
const noMinute = () => null;

type Movie = {
  id: number;
  status?: string | null;
  runtime?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  budget?: number | null;
  revenue?: number | null;
  original_language?: string | null;
  spoken_languages?: { iso_639_1?: string; english_name?: string }[];
};

export function FilmGlance({
  movie,
  keywords = [],
  collection,
  countryNames = [],
}: {
  movie: Movie;
  keywords?: Keyword[];
  collection: { id: number; name?: string | null } | null;
  countryNames?: string[];
}) {
  const minute = useSyncExternalStore(subscribeMinute, minuteNow, noMinute);
  // The same request as the collection strip below, so it is made once.
  const { data, error } = useSWR<CollectionResponse>(collection?.id ? `/api/collection?id=${collection.id}` : null, swrFetcher, {
    revalidateOnFocus: false,
  });

  const released = !movie.status || movie.status === "Released";
  const endsAt = released && minute != null && movie.runtime ? endTime(new Date(minute * 60_000), movie.runtime) : null;

  const items = [
    ratingGlance(movie.vote_average, movie.vote_count),
    filmLengthGlance(movie.runtime, endsAt),
    languageGlance(movie.original_language, movie.spoken_languages, countryNames),
    basedOnGlance(keywords),
    // No collection to open if it couldn't load: the fold below would be empty.
    error ? null : collectionGlance(data?.name ?? collection?.name, data ? data.parts : null, movie.id),
    moneyGlance(movie.budget, movie.revenue),
    creditsGlance(keywords),
  ].filter((g): g is Glance => g != null);

  return <GlancePanel items={items} keywords={pickThemes(keywords)} mediaType="movie" />;
}

type EpisodeStub = { season_number?: number | null; episode_number?: number | null; name?: string | null; air_date?: string | null };

type Show = {
  id: number;
  status?: string | null;
  in_production?: boolean | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  original_language?: string | null;
  spoken_languages?: { iso_639_1?: string; english_name?: string }[];
  networks?: { name?: string }[];
  next_episode_to_air?: EpisodeStub | null;
  last_episode_to_air?: EpisodeStub | null;
};

export function SeriesGlance({
  show,
  keywords = [],
  runtimes,
  countryNames = [],
}: {
  show: Show;
  keywords?: Keyword[];
  runtimes: SeasonRuntime[] | null;
  countryNames?: string[];
}) {
  const today = useToday();
  const { user, status } = useAuth();
  const me = status === "ok" ? (user?.id ?? null) : null;
  // The same entry as the action bar and the progress ribbon: one request.
  const { data } = useSWR<{ episodes?: { season_number: number; episode_number: number }[] }>(
    me ? `/api/watched-episodes?showId=${show.id}` : null,
    swrFetcher,
  );
  const watched = useMemo(
    () => (data ? new Set((data.episodes ?? []).map((r) => `${r.season_number}:${r.episode_number}`)) : null),
    [data],
  );

  const items = [
    seriesStatusGlance({
      status: show.status,
      inProduction: show.in_production,
      next: show.next_episode_to_air,
      last: show.last_episode_to_air,
      network: show.networks?.[0]?.name ?? null,
      seasons: show.number_of_seasons,
      today,
    }),
    ratingGlance(show.vote_average, show.vote_count),
    seriesSizeGlance(show.number_of_seasons, show.number_of_episodes, runtimes),
    seriesTimeGlance(runtimes, watched),
    languageGlance(show.original_language, show.spoken_languages, countryNames),
    basedOnGlance(keywords),
  ].filter((g): g is Glance => g != null);

  return <GlancePanel items={items} keywords={pickThemes(keywords)} mediaType="tv" />;
}
