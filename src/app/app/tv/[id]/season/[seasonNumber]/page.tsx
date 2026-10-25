import React from "react";
import Link from "@components/ui/AppLink";
import { notFound, unstable_rethrow } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import SeasonEpisodes from "@components/tv/SeasonEpisodes";
import TitleTalk from "@components/takes/TitleTalk";
import LazyFold from "@components/ds/LazyFold";
import { getTvShowWithSeasons, getSeasonEpisodes } from "@/utils/tmdbTvShow";
import { tmdbConfigured } from "@/utils/tmdbClient";
import { parseRouteId } from "@/utils/urls";
import type { Metadata } from "next";
import JsonLd from "@components/seo/JsonLd";
import { tvSeasonLd, breadcrumbLd } from "@/utils/structuredData";
import { shareImage } from "@/utils/shareImage";
import { seasonPath, titlePath } from "@/utils/urls";
import { getPosterUrl } from "@/utils/imageUrl";

/**
 * ── This page was on the incident's "still rendered per request" list ──────
 *
 * `docs/incident-2026-08-23-deployment-paused.md` records it at 439
 * invocations in twelve hours, with the reason given as "reads the viewer's
 * watched state server-side", and notes that fixing it "means moving viewer
 * state to the client, which is real work for a small return".
 *
 * The reason turned out to be almost true. The episode list has always been a
 * client component that fetches its own watched state; the only thing this
 * page read a session for was one `initialStatus` prop on the Watchlist /
 * Watching selector — and that component already knows how to fetch its own
 * status when the prop is not given. The work was deleting fourteen lines.
 *
 * It matters more than the 439 suggests, because every season anyone here has
 * tracked is published in the sitemap. Each of those URLs was a full render —
 * two TMDB calls, a session read and a database read — on every crawler hit,
 * forever, to produce bytes that are the same for everybody.
 *
 * `generateStaticParams` returning `[]` is required alongside `revalidate`,
 * for the reason R3 in that document spells out: on a `[param]` route Next
 * ignores `revalidate` on its own and still emits `no-store`. Empty means
 * "prerender nothing, cache each one on first request".
 *
 * Six hours, which is not an arbitrary number — it is the same window the
 * series page settled on, and it is bounded by the same thing. Both pages get
 * their data from `tmdbTvShow.ts`, and Next takes the *minimum* of the route's
 * revalidate and every fetch inside the render, so this value is only real
 * because `TMDB_REVALIDATE_SEC` was raised to match it.
 */
/**
 * A day, up from six hours.
 *
 * Six hours meant four ISR write units per page per day for anything still
 * being visited — and season and episode pages are the deepest, most numerous
 * routes in the app, so they are the ones where a short window costs the most.
 * A newly aired episode showing up a few hours later than it might have is not
 * a defect anyone will report.
 */
export const revalidate = 86400;

export async function generateStaticParams() {
  return [];
}

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  air_date: string | null;
  overview: string;
  runtime?: number;
  episode_type?: string | null;
}

/**
 * What the browser actually needs about an episode.
 *
 * TMDB's season payload is 96.5KB for Breaking Bad's sixteen-episode fifth
 * season, and all of it used to be handed to the client — 56KB of it guest
 * stars this list never rendered. A row is the code, the title, the date, the
 * runtime and whether it's a premiere or a finale; the overview rides along
 * for the rows you've watched. The credits live on the episode page.
 */
function trimEpisode(e: any): Episode {
  return {
    id: e.id,
    episode_number: e.episode_number,
    name: e.name,
    air_date: e.air_date ?? null,
    overview: e.overview ?? "",
    runtime: e.runtime,
    episode_type: e.episode_type ?? null,
  };
}

type SeasonPageProps = {
  params: Promise<{ id: string; seasonNumber: string }>;
};


const fetchSeriesAndSeasonData = async (
  seriesId: string,
  seasonNumber: string,
) => {
  if (!tmdbConfigured()) {
    throw new Error("TMDB_READ_TOKEN is missing");
  }

  const seriesData = await getTvShowWithSeasons(seriesId);
  if (!seriesData) {
    notFound();
  }
  const seasons = (seriesData.seasons as any[]) ?? [];
  const seriesName = seriesData.name as string;
  const seriesOverview = (seriesData.overview as string) ?? "";
  const seriesPoster = (seriesData.poster_path as string) ?? null;
  // For the share card only: a season has no backdrop of its own, and the
  // series one is the only landscape image available to it.
  const seriesBackdrop = (seriesData.backdrop_path as string) ?? null;
  const last = seriesData.last_episode_to_air as { season_number?: number; episode_number?: number } | null | undefined;
  const lastAired = last?.season_number != null && last?.episode_number != null ? { s: last.season_number, e: last.episode_number } : null;

  const seasonDataRaw = await getSeasonEpisodes(seriesId, seasonNumber);
  if (!seasonDataRaw) {
    notFound();
  }
  const seasonData = seasonDataRaw as any;

  return {
    seriesName,
    seriesOverview,
    seriesPoster,
    seriesBackdrop,
    lastAired,
    seasons: seasons.map((s: any): { id: number; season_number: number; name: string; poster_path: string | null; air_date: string | null; episode_count: number } => ({
      id: s.id,
      season_number: s.season_number,
      name: s.name,
      poster_path: s.poster_path,
      air_date: s.air_date,
      episode_count: s.episode_count,
    })),
    currentSeason: {
      id: seasonData.id,
      season_number: seasonData.season_number,
      name: seasonData.name,
      overview: seasonData.overview,
      poster_path: seasonData.poster_path,
      air_date: seasonData.air_date,
      episodes: (seasonData.episodes || []).map(trimEpisode),
    },
  };
};


/**
 * Several hundred season pages shared one title and one description, which is
 * the same as having none: a result list cannot tell Breaking Bad season 2 from
 * season 4, and neither can a person reading it.
 */
export async function generateMetadata({ params }: SeasonPageProps): Promise<Metadata> {
  const { id: rawId, seasonNumber }: any = await params;
  const numericId = parseRouteId(rawId);
  if (!numericId) return { title: "Season" };

  try {
    // Both fetches are cached, so this shares the page's requests rather than
    // paying for a second round trip.
    const data = await fetchSeriesAndSeasonData(numericId, seasonNumber);
    const { seriesName, currentSeason, seriesPoster } = data;
    const n = currentSeason.season_number;
    const seasonName = currentSeason.name || `Season ${n}`;
    const title = `${seriesName}: ${seasonName}`;
    const year = currentSeason.air_date ? String(currentSeason.air_date).slice(0, 4) : null;
    const count = currentSeason.episodes?.length ?? 0;

    const description =
      (currentSeason.overview && String(currentSeason.overview).trim().slice(0, 200)) ||
      [
        `${seasonName} of ${seriesName}`,
        year ? `aired ${year}` : null,
        count ? `${count} episodes` : null,
      ]
        .filter(Boolean)
        .join(" — ") + ". Track what you have watched, episode by episode.";

    const canonical = seasonPath(numericId, n, seriesName);
    const share = shareImage(
      data.seriesBackdrop,
      currentSeason.poster_path || seriesPoster,
      title,
    );

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: "video.tv_show",
        title,
        description,
        url: canonical,
        images: share.images,
      },
      twitter: { card: share.card, title, description, images: share.urls },
    };
  } catch {
    return { title: "Season" };
  }
}

const SeasonPage = async ({ params }: SeasonPageProps) => {
  const { id: rawId, seasonNumber }: any = await params;
  const numericId = parseRouteId(rawId);
  if (!numericId) {
    return notFound();
  }

  let data;
  try {
    data = await fetchSeriesAndSeasonData(numericId, seasonNumber);
  } catch (error) {
    // `notFound()` inside the fetch throws; let Next turn it into a 404
    // rather than caching this page as a 200.
    unstable_rethrow(error);
    return (
      <div className="mx-auto flex w-full max-w-read flex-col items-start gap-4 px-4 py-16">
        <h1 className="text-2xl text-ink-0">This season didn&apos;t load.</h1>
        <p className="text-sm text-ink-400">TMDB didn&apos;t answer. Try again in a moment.</p>
        <Link href={titlePath("tv", numericId)} className="text-sm font-medium text-ink-0 underline decoration-line-input underline-offset-4">
          Back to the series
        </Link>
      </div>
    );
  }

  const { seriesName, seriesPoster, seasons, currentSeason, lastAired } = data;
  const currentSeasonNum = parseInt(seasonNumber, 10);
  // Seasons with episodes, specials last; a season TMDB has announced but not
  // filled stays out of the chips and the next/previous links.
  const ordered = [...seasons]
    .filter((s) => s.episode_count > 0 || s.season_number === currentSeasonNum)
    .sort((a, b) => (a.season_number === 0 ? 1e6 : a.season_number) - (b.season_number === 0 ? 1e6 : b.season_number));
  const regular = ordered.filter((s) => s.season_number > 0);
  const at = ordered.findIndex((s) => s.season_number === currentSeasonNum);
  const prevSeason = at > 0 ? ordered[at - 1] : null;
  const nextSeason = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;
  const seasonName = currentSeason.name?.trim() || (currentSeasonNum === 0 ? "Specials" : `Season ${currentSeasonNum}`);
  const year = currentSeason.air_date?.slice(0, 4) ?? null;
  const count = currentSeason.episodes.length;
  const poster = currentSeason.poster_path || seriesPoster;
  const seasonLabel = (n: number) => (n === 0 ? "Specials" : `Season ${n}`);
  const chip = (on: boolean) =>
    `inline-flex h-9 shrink-0 items-center rounded-full px-3.5 font-mono text-xs tabular-nums transition-colors ${
      on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
    }`;

  return (
    <>
      <JsonLd
        data={[
          tvSeasonLd({
            showId: numericId,
            showName: seriesName,
            seasonNumber: currentSeasonNum,
            name: currentSeason.name,
            overview: currentSeason.overview,
            posterPath: currentSeason.poster_path ?? seriesPoster,
            airDate: currentSeason.air_date,
            episodeCount: count,
          }),
          breadcrumbLd([
            { name: "Series", path: "/app/search?browse=1&type=tv" },
            { name: seriesName, path: titlePath("tv", numericId, seriesName) },
            { name: seasonName, path: seasonPath(numericId, currentSeasonNum, seriesName) },
          ]),
        ]}
      />
      <div className="mx-auto flex w-full max-w-read flex-col gap-8 px-4 pb-16 pt-6 sm:pt-10">
        <header className="flex flex-col gap-5">
          <Link href={titlePath("tv", numericId, seriesName)} className="inline-flex items-center gap-1.5 self-start text-sm text-ink-400 transition-colors hover:text-ink-0">
            <ArrowLeft className="size-4" aria-hidden />
            {seriesName}
          </Link>
          <div className="flex items-end gap-4">
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getPosterUrl(poster, "w185")} alt="" className="aspect-2/3 w-20 shrink-0 rounded-media object-cover ring-1 ring-inset ring-line sm:w-24" />
            )}
            <div className="min-w-0">
              <h1 className="text-3xl text-ink-0 sm:text-4xl">{seasonName}</h1>
              <p className="mt-1 font-mono text-xs uppercase tracking-wide text-ink-500">
                {[year, `${count} ${count === 1 ? "episode" : "episodes"}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          {regular.length > 1 && (
            <nav aria-label="Seasons" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {ordered.map((s) => (
                  <Link
                    key={s.season_number}
                    href={seasonPath(numericId, s.season_number, seriesName)}
                    aria-current={s.season_number === currentSeasonNum ? "page" : undefined}
                    className={chip(s.season_number === currentSeasonNum)}
                  >
                    {s.season_number === 0 ? "Specials" : `S${String(s.season_number).padStart(2, "0")}`}
                  </Link>
              ))}
            </nav>
          )}
          {currentSeason.overview?.trim() && <p className="hlimit text-base leading-relaxed text-ink-300">{currentSeason.overview}</p>}
        </header>

        <SeasonEpisodes
          showId={numericId}
          showName={seriesName}
          season={currentSeasonNum}
          episodes={currentSeason.episodes}
          seasons={seasons.map((s) => ({ season_number: s.season_number, episode_count: s.episode_count }))}
          lastAired={lastAired}
        />

        {/* The season is the unit people actually argue about: series talk
            is too coarse for a long-running show, episode talk too fine. */}
        <LazyFold title="Talk about this season" hint="Your rating and words for the season, and everyone else's">
          <TitleTalk itemId={numericId} itemType="tv" scope="season" seasonNumber={currentSeasonNum} itemName={seriesName} />
        </LazyFold>

        {(prevSeason || nextSeason) && (
          <nav aria-label="Other seasons" className="flex items-center justify-between gap-4 border-t border-line pt-5">
            {prevSeason ? (
              <Link href={seasonPath(numericId, prevSeason.season_number, seriesName)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-300 hover:text-ink-0">
                <ArrowLeft className="size-4" aria-hidden />
                {seasonLabel(prevSeason.season_number)}
              </Link>
            ) : (
              <span />
            )}
            {nextSeason && (
              <Link href={seasonPath(numericId, nextSeason.season_number, seriesName)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-0 hover:underline hover:underline-offset-4">
                {seasonLabel(nextSeason.season_number)}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
};

export default SeasonPage;
