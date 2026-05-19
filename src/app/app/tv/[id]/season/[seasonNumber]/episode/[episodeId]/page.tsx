import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaChevronRight, FaChevronLeft, FaStar } from "react-icons/fa";
import ImageViewEpisode from "@components/clientComponent/imageViewEpisode";
import VideoEpisode from "@components/clientComponent/videoEpisode";
import MarkEpisodeWatched from "@components/tv/MarkEpisodeWatched";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";
import { fetchTmdb } from "@/utils/tmdbClient";
import { createClient } from "@/utils/supabase/server";
import EpisodeRating from "@/components/tv/EpisodeRating";
import EpisodeNote from "@/components/tv/EpisodeNote";
import { ArrowLeft, Clock, Calendar, Users, Clapperboard, Star } from "lucide-react";

interface EpisodeDetails {
  id: number;
  episode_number: number;
  name: string;
  air_date: string | null;
  overview: string;
  still_path: string | null;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  guest_stars: {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
  }[];
  crew: {
    id: number;
    name: string;
    job: string;
    profile_path: string | null;
  }[];
  images: { stills: { file_path: string }[] };
  videos: { key: string; type: string; site: string }[];
}

interface PageProps {
  params: Promise<{ id: string; seasonNumber: string; episodeId: string }>;
}

const getNumericId = (value: string) => {
  const match = String(value).match(/^\d+/);
  return match ? match[0] : null;
};

const EPISODE_REVALIDATE_SEC = 300;

const fetchEpisodeData = async (
  id: string,
  seasonNumber: string,
  episodeId: string,
) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDb API key is missing");
  }

  const url = `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}/episode/${episodeId}?api_key=${apiKey}&append_to_response=images,videos`;
  const response = await fetchTmdb(url, { revalidate: EPISODE_REVALIDATE_SEC });

  if (!response.ok) {
    if (response.status === 404) notFound();
    throw new Error(`Failed to fetch episode data: ${response.status}`);
  }

  const data = await response.json();

  const seriesData = await getTvShowWithSeasons(id);
  const seriesName = (seriesData?.name as string) ?? "Series";
  const seasons = (seriesData?.seasons as any[]) || [];
  const currentSeasonData = seasons.find(
    (s) => s.season_number === parseInt(seasonNumber, 10),
  );
  const episodeCount = currentSeasonData?.episode_count || 0;

  return {
    seriesName,
    seasonNumber: parseInt(seasonNumber, 10),
    episodeCount,
    episode: {
      id: data.id,
      episode_number: data.episode_number,
      name: data.name,
      air_date: data.air_date,
      overview: data.overview,
      still_path: data.still_path,
      runtime: data.runtime,
      vote_average: data.vote_average,
      vote_count: data.vote_count,
      guest_stars: data.guest_stars || [],
      crew: data.crew || [],
      images: data.images || { stills: [] },
      videos: data.videos?.results || [],
    },
  };
};

const EpisodePage = async ({ params }: PageProps) => {
  const rawId = (await params).id;
  const id = getNumericId(rawId);
  const seasonNumber = (await params).seasonNumber;
  const episodeId = (await params).episodeId;

  if (!id) {
    return notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [episodeRes, ratingRes] = await Promise.all([
    fetchEpisodeData(id, seasonNumber, episodeId).catch((e) => ({ error: e })),
    user
      ? supabase
          .from("episode_ratings")
          .select("score, note")
          .eq("user_id", user.id)
          .eq("show_id", id)
          .eq("season_number", seasonNumber)
          .eq("episode_number", episodeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if ((episodeRes as any).error) {
    const error = (episodeRes as any).error;
    return (
      <div className="min-h-screen bg-surface-950 text-white flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <p className="text-red-400 text-lg font-semibold">Error loading episode</p>
          <p className="text-surface-400 text-sm mt-2">{(error as Error).message}</p>
          <Link href={`/app/tv/${id}/season/${seasonNumber}`} className="btn-primary mt-4 inline-block">
            Back to Season
          </Link>
        </div>
      </div>
    );
  }

  const data = episodeRes as Awaited<ReturnType<typeof fetchEpisodeData>>;
  const userRating = ratingRes.data;
  const { seriesName, seasonNumber: seasonNum, episode } = data;
  const epNum = episode.episode_number.toString().padStart(2, "0");

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {episode.still_path ? (
          <>
            <img src={`https://image.tmdb.org/t/p/w1280${episode.still_path}`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/80 to-surface-950/30" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-surface-950" />
        )}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-2 text-sm text-surface-500 mb-6">
            <Link href={`/app/tv/${id}`} className="hover:text-brand-400 transition-colors">
              {seriesName}
            </Link>
            <FaChevronRight className="w-3 h-3" />
            <Link href={`/app/tv/${id}/season/${seasonNumber}`} className="hover:text-brand-400 transition-colors">
              Season {seasonNumber}
            </Link>
            <FaChevronRight className="w-3 h-3" />
            <span className="text-surface-300">Episode {epNum}</span>
          </nav>

          {/* Episode Title + Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="badge-brand">S{seasonNum} E{epNum}</span>
            {episode.air_date && (
              <span className="pill-glass text-sm flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(episode.air_date).toLocaleDateString()}
              </span>
            )}
            {episode.runtime && (
              <span className="pill-glass text-sm flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {episode.runtime}m
              </span>
            )}
            {episode.vote_average > 0 && (
              <span className="pill-glass text-sm flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-accent-gold fill-accent-gold" />
                {episode.vote_average.toFixed(1)}
                <span className="text-surface-600 text-xs">({episode.vote_count})</span>
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white max-w-3xl">
            {episode.name}
          </h1>

          <p className="text-base text-surface-400 mt-4 max-w-3xl leading-relaxed">
            {episode.overview || "No overview available."}
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <MarkEpisodeWatched
              showId={id}
              seasonNumber={seasonNum}
              episodeNumber={episode.episode_number}
            />
            <EpisodeRating
              showId={id}
              seasonNumber={seasonNum}
              episodeNumber={episode.episode_number}
              initialRating={userRating?.score}
            />
          </div>

          {/* Episode Navigation */}
          <div className="flex items-center gap-3 mt-6">
            {episode.episode_number > 1 ? (
              <Link
                href={`/app/tv/${id}/season/${seasonNum}/episode/${episode.episode_number - 1}`}
                className="btn-secondary text-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </Link>
            ) : <div />}
            {data?.episodeCount && episode.episode_number < data.episodeCount && (
              <Link
                href={`/app/tv/${id}/season/${seasonNum}/episode/${episode.episode_number + 1}`}
                className="btn-primary text-sm"
              >
                Next <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Notes */}
        <EpisodeNote
          showId={id}
          seasonNumber={seasonNum}
          episodeNumber={episode.episode_number}
          initialNote={userRating?.note}
        />

        {/* Images */}
        {episode.images.stills.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white">Screenshots</h2>
                <p className="text-sm text-surface-500 mt-0.5">{episode.images.stills.length} images</p>
              </div>
            </div>
            <ImageViewEpisode Bimages={episode.images.stills} />
          </div>
        )}

        {/* Videos */}
        {episode.videos.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white">Clips & Behind the Scenes</h2>
                <p className="text-sm text-surface-500 mt-0.5">{episode.videos.length} videos</p>
              </div>
            </div>
            <VideoEpisode videos={episode.videos} />
          </div>
        )}

        {/* Guest Stars */}
        {episode.guest_stars.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white">Guest Stars</h2>
                <p className="text-sm text-surface-500 mt-0.5">{episode.guest_stars.length} guests</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {episode.guest_stars.map((star: any) => (
                <Link
                  key={star.id}
                  href={`/app/person/${star.id}`}
                  className="group glass-card rounded-xl overflow-hidden hover:border-surface-600/50 transition-all hover:-translate-y-1"
                >
                  <div className="aspect-[2/3] overflow-hidden">
                    {star.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${star.profile_path}`}
                        alt={star.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-800 flex items-center justify-center">
                        <Users className="w-8 h-8 text-surface-600" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white truncate">{star.name}</p>
                    <p className="text-xs text-surface-500 mt-0.5 truncate">{star.character}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Crew */}
        {episode.crew.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white">Crew</h2>
                <p className="text-sm text-surface-500 mt-0.5">{episode.crew.length} crew members</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {episode.crew.map((member: any) => (
                <Link
                  key={member.id}
                  href={`/app/person/${member.id}`}
                  className="group glass-card rounded-xl overflow-hidden hover:border-surface-600/50 transition-all hover:-translate-y-1"
                >
                  <div className="aspect-[2/3] overflow-hidden">
                    {member.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${member.profile_path}`}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-800 flex items-center justify-center">
                        <Clapperboard className="w-8 h-8 text-surface-600" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white truncate">{member.name}</p>
                    <p className="text-xs text-surface-500 mt-0.5 truncate">{member.job}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EpisodePage;
