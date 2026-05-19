import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import EpisodeListWithWatched from "@components/tv/EpisodeListWithWatched";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";
import { fetchTmdb } from "@/utils/tmdbClient";
import { createClient } from "@/utils/supabase/server";
import TvStatusSelector from "@/components/tv/TvStatusSelector";
import { ArrowLeft, Tv, Calendar, Film } from "lucide-react";

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  air_date: string | null;
  overview: string;
  still_path: string | null;
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

const getNumericId = (value: string) => {
  const match = String(value).match(/^\d+/);
  return match ? match[0] : null;
};

const SEASON_REVALIDATE_SEC = 300;

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

  const seasonResponse = await fetchTmdb(
    `https://api.themoviedb.org/3/tv/${seriesId}/season/${seasonNumber}?api_key=${apiKey}`,
    { revalidate: SEASON_REVALIDATE_SEC },
  );
  if (!seasonResponse.ok) {
    if (seasonResponse.status === 404) notFound();
    throw new Error(`Failed to fetch season data: ${seasonResponse.status}`);
  }
  const seasonData = await seasonResponse.json();

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
      episodes: seasonData.episodes || [],
    },
  };
};

const SeasonPage = async ({ params }: SeasonPageProps) => {
  const { id: rawId, seasonNumber }: any = await params;
  const numericId = getNumericId(rawId);
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
          <Link href={`/app/tv/${numericId}`} className="btn-primary mt-4 inline-block">
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
      .from("user_tv_list")
      .select("status")
      .eq("user_id", user.id)
      .eq("show_id", numericId)
      .maybeSingle();
    initialTVStatus = data?.status ?? null;
  }

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 via-surface-950 to-surface-950" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Back Link */}
          <Link href={`/app/tv/${numericId}`} className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-brand-400 transition-colors mb-6">
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
              <Link href={`/app/tv/${numericId}`} className="text-2xl sm:text-4xl font-black text-white hover:text-brand-400 transition-colors">
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

        {/* Season Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-white/5">
          {prevSeason ? (
            <Link href={`/app/tv/${numericId}/season/${prevSeason.season_number}`} className="btn-secondary">
              <ArrowLeft className="w-4 h-4" />
              Season {prevSeason.season_number}
            </Link>
          ) : (
            <div />
          )}
          {nextSeason ? (
            <Link href={`/app/tv/${numericId}/season/${nextSeason.season_number}`} className="btn-primary">
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
                href={`/app/tv/${numericId}/season/${season.season_number}`}
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
  );
};

export default SeasonPage;
