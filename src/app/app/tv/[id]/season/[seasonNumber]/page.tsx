import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import EpisodeListWithWatched from "@components/tv/EpisodeListWithWatched";
import TitleTalk from "@components/takes/TitleTalk";
import { getTvShowWithSeasons, getSeasonEpisodes } from "@/utils/tmdbTvShow";
import { createClient } from "@/utils/supabase/server";
import TvStatusSelector from "@/components/tv/TvStatusSelector";
import { ArrowLeft, Tv, Calendar, Film } from "lucide-react";
import { parseRouteId } from "@/utils/urls";
import type { Metadata } from "next";
import JsonLd from "@components/seo/JsonLd";
import { tvSeasonLd, breadcrumbLd } from "@/utils/structuredData";
import { seasonPath, titlePath } from "@/utils/urls";

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  air_date: string | null;
  overview: string;
  still_path: string | null;
  vote_average?: number;
  vote_count?: number;
  runtime?: number;
  episode_type?: string | null;
  crew?: { name?: string; job?: string }[];
}

/**
 * What the browser actually needs about an episode.
 *
 * TMDB's season payload is 96.5KB for Breaking Bad's sixteen-episode fifth
 * season, and all of it was being handed to the client. 56KB of that is
 * `guest_stars` — eight people per episode, with profile paths and credit ids —
 * which this list has never rendered and does not intend to; the episode page
 * fetches its own when you open one. Another 30KB is the rest of the crew:
 * editors, photography directors, three producers apiece.
 *
 * Keeping the director and the writer and dropping the remainder takes the same
 * list to 7.6KB, a 92% cut, while showing *more* than before — the byline is
 * new. The cheapest payload is the one you never send.
 */
function trimEpisode(e: any): Episode {
  return {
    id: e.id,
    episode_number: e.episode_number,
    name: e.name,
    air_date: e.air_date ?? null,
    overview: e.overview ?? "",
    still_path: e.still_path ?? null,
    vote_average: e.vote_average,
    vote_count: e.vote_count,
    runtime: e.runtime,
    episode_type: e.episode_type ?? null,
    crew: (e.crew ?? [])
      .filter((c: any) => c?.job === "Director" || c?.job === "Writer")
      .map((c: any) => ({ name: c.name, job: c.job })),
  };
}

interface Season {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episode_count: number;
}

type SeasonPageProps = {
  params: Promise<{ id: string; seasonNumber: string }>;
};


const fetchSeriesAndSeasonData = async (
  seriesId: string,
  seasonNumber: string,
) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDb API key is missing");
  }

  const seriesData = await getTvShowWithSeasons(seriesId);
  if (!seriesData) {
    notFound();
  }
  const seasons = (seriesData.seasons as any[]) ?? [];
  const seriesName = seriesData.name as string;
  const seriesOverview = (seriesData.overview as string) ?? "";
  const seriesPoster = (seriesData.poster_path as string) ?? null;

  const seasonDataRaw = await getSeasonEpisodes(seriesId, seasonNumber);
  if (!seasonDataRaw) {
    notFound();
  }
  const seasonData = seasonDataRaw as any;

  return {
    seriesName,
    seriesOverview,
    seriesPoster,
    seasons: seasons.map((s: any) => ({
      id: s.id,
      season_number: s.season_number,
      name: s.name,
      overview: s.overview,
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
    const poster = currentSeason.poster_path || seriesPoster;
    const image = poster ? `https://image.tmdb.org/t/p/w780${poster}` : null;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: "video.tv_show",
        title,
        description,
        url: canonical,
        images: image ? [{ url: image, width: 780, height: 1170, alt: title }] : [],
      },
      twitter: { card: "summary_large_image", title, description, images: image ? [image] : [] },
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
    return (
      <div className="min-h-screen bg-surface-950 text-white flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <p className="text-red-400 text-lg font-semibold">Error loading season</p>
          <p className="text-surface-400 text-sm mt-2">{(error as Error).message}</p>
          <Link href={titlePath("tv", numericId)} className="btn-primary mt-4 inline-block">
            Back to Show
          </Link>
        </div>
      </div>
    );
  }

  const { seriesName, seriesOverview, seriesPoster, seasons, currentSeason } = data;
  const currentSeasonNum = parseInt(seasonNumber, 10);
  const prevSeason = seasons.find((s: any) => s.season_number === currentSeasonNum - 1 && s.season_number > 0);
  const nextSeason = seasons.find((s: any) => s.season_number === currentSeasonNum + 1);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let initialTVStatus = null;
  if (user) {
    const { data } = await supabase
      .from("user_media_status")
      .select("status")
      .eq("user_id", user.id)
      .eq("item_id", numericId)
      .eq("item_type", "tv")
      .maybeSingle();
    initialTVStatus = data?.status ?? null;
  }

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
            episodeCount: currentSeason.episodes?.length ?? null,
          }),
          breadcrumbLd([
            { name: "TV", path: "/app/browse?type=tv" },
            { name: seriesName, path: titlePath("tv", numericId, seriesName) },
            {
              name: currentSeason.name || `Season ${currentSeasonNum}`,
              path: seasonPath(numericId, currentSeasonNum, seriesName),
            },
          ]),
        ]}
      />
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 via-surface-950 to-surface-950" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Back Link */}
          <Link href={titlePath("tv", numericId, seriesName)} className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-brand-400 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to {seriesName}
          </Link>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
            {/* Series Poster */}
            {seriesPoster && (
              <div className="shrink-0 w-32 sm:w-40">
                <div className="relative rounded-xl overflow-hidden ring-1 ring-white/10 shadow-xl">
                  <img
                    src={`https://image.tmdb.org/t/p/w300${seriesPoster}`}
                    alt={seriesName}
                    className="w-full aspect-[2/3] object-cover"
                  />
                </div>
              </div>
            )}

            {/* Series Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Tv className="w-4 h-4 text-brand-400" />
                <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">TV Series</span>
              </div>
              <Link href={titlePath("tv", numericId, seriesName)} className="text-2xl sm:text-4xl font-black text-white hover:text-brand-400 transition-colors">
                {seriesName}
              </Link>
              <p className="text-sm text-surface-400 mt-3 line-clamp-3 max-w-2xl">
                {seriesOverview || "No overview available."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="pill-glass text-sm">
                  Season {currentSeasonNum} of {seasons.length}
                </span>
                <span className="pill-glass text-sm flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {currentSeason.air_date?.slice(0, 4) || "TBA"}
                </span>
                <span className="pill-glass text-sm flex items-center gap-1">
                  <Film className="w-3.5 h-3.5" />
                  {currentSeason.episodes.length} episodes
                </span>
              </div>
              <div className="mt-4">
                <TvStatusSelector showId={numericId} initialStatus={initialTVStatus} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Season Details */}
        {currentSeason.overview && (
          <div className="glass-card rounded-2xl p-5 mb-8">
            <div className="flex items-start gap-4">
              {currentSeason.poster_path && (
                <img
                  src={`https://image.tmdb.org/t/p/w185${currentSeason.poster_path}`}
                  alt={currentSeason.name}
                  className="shrink-0 w-24 rounded-lg object-cover ring-1 ring-white/10"
                />
              )}
              <div>
                <h2 className="text-xl font-bold text-white">{currentSeason.name}</h2>
                <p className="text-sm text-surface-400 mt-2 leading-relaxed">
                  {currentSeason.overview}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Episode List */}
        <EpisodeListWithWatched
          showId={numericId}
          seasonNumber={currentSeasonNum}
          episodes={currentSeason.episodes}
          allSeasons={seasons}
        />

        {/* Season reviews. The season is the unit people actually argue
            about, and it had no home before: series reviews are too coarse for
            a long-running show, episode notes too fine. */}
        <TitleTalk
          itemId={numericId}
          itemType="tv"
          scope="season"
          seasonNumber={currentSeasonNum}
          itemName={seriesName}
          isAuthenticated={!!user}
        />

        {/* Season Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-white/5">
          {prevSeason ? (
            <Link href={seasonPath(numericId, prevSeason.season_number, seriesName)} className="btn-secondary">
              <ArrowLeft className="w-4 h-4" />
              Season {prevSeason.season_number}
            </Link>
          ) : (
            <div />
          )}
          {nextSeason ? (
            <Link href={seasonPath(numericId, nextSeason.season_number, seriesName)} className="btn-primary">
              Season {nextSeason.season_number}
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          ) : (
            <div />
          )}
        </div>

        {/* All Seasons Grid */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-white">All Seasons</h2>
              <p className="text-sm text-surface-500 mt-0.5">{seasons.length} seasons</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {seasons.filter((s: any) => s.season_number > 0).map((season: Season) => (
              <Link
                key={season.id}
                href={seasonPath(numericId, season.season_number, seriesName)}
                className={`group rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 ${
                  season.season_number === currentSeasonNum
                    ? "ring-2 ring-brand-500 shadow-lg shadow-brand-500/20"
                    : "glass-card hover:border-surface-600/50"
                }`}
              >
                <div className="aspect-[2/3] overflow-hidden">
                  {season.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${season.poster_path}`}
                      alt={season.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-800 flex flex-col items-center justify-center">
                      <Tv className="w-8 h-8 text-surface-600 mb-2" />
                      <span className="text-xs text-surface-500">No image</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-white truncate">{season.name}</h3>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {season.episode_count} episodes
                    {season.air_date && ` · ${season.air_date.slice(0, 4)}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default SeasonPage;
