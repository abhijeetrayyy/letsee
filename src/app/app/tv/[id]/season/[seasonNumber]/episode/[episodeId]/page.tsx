// app/tv/[id]/season/[seasonNumber]/episode/[episodeId]/page.tsx
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

// Fetch episode (one TMDB call) and series name from cached getTvShowWithSeasons
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

  // Parallel fetch: Episode Data + User Data
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    const error = (episodeRes as any).error; // Cast for now
    console.log("Fetch Error:", error);
    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-200 flex items-center justify-center p-4">
        <p className="text-red-400 text-center">
          Error: {(error as Error).message}
        </p>
      </div>
    );
  }

  const data = episodeRes as Awaited<ReturnType<typeof fetchEpisodeData>>;
  const userRating = ratingRes.data;

  const { seriesName, seasonNumber: seasonNum, episode } = data;

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-200 p-4">
      <div className="max-w-[1520px] mx-auto">
        {/* Breadcrumb Navigation */}
        <nav className="flex flex-row items-center gap-3 mb-6 text-sm text-neutral-400">
          <Link href={`/app/tv/${id}`} className="hover:underline">
            {seriesName}
          </Link>
          <FaChevronRight />
          <Link
            href={`/app/tv/${id}/season/${seasonNumber}`}
            className="hover:underline"
          >
            Season {seasonNumber}
          </Link>{" "}
          <FaChevronRight /> Episode {episode.episode_number}
        </nav>

        {/* Episode Header */}
        <header className="mb-8 flex flex-col sm:flex-row gap-6">
          {episode.still_path && (
            <div className="relative shrink-0">
              <img
                src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
                alt={episode.name}
                width={300}
                height={169}
                className="rounded-lg object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-100 mb-1">
                {episode.name}
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-400 mb-3">
              <span className="bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
                S{seasonNum} E{episode.episode_number}
              </span>
              <span>{episode.air_date || "TBA"}</span>
              <span>{episode.runtime ? `${episode.runtime}m` : ""}</span>
              {/* TMDB Rating */}
              {episode.vote_average > 0 && (
                <span className="flex items-center gap-1 text-amber-500">
                  <FaStar size={12} />
                  <span>{episode.vote_average.toFixed(1)}</span>
                  <span className="text-neutral-600">
                    ({episode.vote_count})
                  </span>
                </span>
              )}
            </div>

            <p className="text-sm sm:text-base text-neutral-300 mb-4 leading-relaxed">
              {episode.overview || "No overview available."}
            </p>

            <div className="flex flex-wrap items-center gap-6 mb-6">
              <MarkEpisodeWatched
                showId={id}
                seasonNumber={seasonNum}
                episodeNumber={episode.episode_number}
              />

              {/* User Rating Component */}
              <EpisodeRating
                showId={id}
                seasonNumber={seasonNum}
                episodeNumber={episode.episode_number}
                initialRating={userRating?.score}
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-4 mb-6">
              {episode.episode_number > 1 ? (
                <Link
                  href={`/app/tv/${id}/season/${seasonNum}/episode/${episode.episode_number - 1}`}
                  className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors border border-neutral-700 hover:border-neutral-500 px-3 py-1.5 rounded-full"
                >
                  <FaChevronLeft size={12} /> Previous
                </Link>
              ) : (
                <span className="opacity-0 px-3"></span> // Spacer
              )}

              {data?.episodeCount &&
                episode.episode_number < data.episodeCount && (
                  <Link
                    href={`/app/tv/${id}/season/${seasonNum}/episode/${episode.episode_number + 1}`}
                    className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors border border-neutral-700 hover:border-neutral-500 px-3 py-1.5 rounded-full"
                  >
                    Next <FaChevronRight size={12} />
                  </Link>
                )}
            </div>

            {/* Note Component */}
            <EpisodeNote
              showId={id}
              seasonNumber={seasonNum}
              episodeNumber={episode.episode_number}
              initialNote={userRating?.note}
            />
          </div>
        </header>

        {/* Episode Images with Horizontal Scroll */}
        {episode.images.stills.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-neutral-100 mb-4">
              Images
            </h2>
            <ImageViewEpisode Bimages={episode.images.stills} />
          </section>
        )}

        {/* Episode Videos (e.g., Trailers/Clips) */}
        {episode.videos.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-neutral-100 mb-4">
              Media Content
            </h2>
            <VideoEpisode videos={episode.videos} />
          </section>
        )}

        {/* Guest Stars */}
        <div className="max-w-5xl m-auto">
          {episode.guest_stars.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-neutral-100 mb-4">
                Guest Stars
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {episode.guest_stars.map((star: any, index: number) => (
                  <Link
                    key={index}
                    href={`/app/person/${star.id}`}
                    className="flex flex-col  items-center hover:opacity-80 transition-opacity duration-200"
                  >
                    {star.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${star.profile_path}`}
                        alt={star.name}
                        width={185}
                        height={278}
                        className="rounded-md object-cover"
                      />
                    ) : (
                      <div className="w-full min-h-52 h-full bg-neutral-600 rounded-md flex items-center justify-center">
                        <span className="text-xs text-neutral-400">
                          No Image
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-neutral-200 mt-2 text-center hover:underline">
                      {star.name}
                    </p>
                    <p className="text-xs text-neutral-400">{star.character}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Crew */}
          {episode.crew.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-neutral-100 mb-4">
                Crew
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {episode.crew.map((member: any, index: number) => (
                  <Link
                    key={index}
                    href={`/app/person/${member.id}`}
                    className="flex flex-col items-center  hover:opacity-80 transition-opacity duration-200"
                  >
                    {member.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${member.profile_path}`}
                        alt={member.name}
                        width={185}
                        height={278}
                        className="rounded-md object-cover"
                      />
                    ) : (
                      <div className="w-full h-full min-h-52 bg-neutral-600 rounded-md flex items-center justify-center">
                        <span className="text-xs text-neutral-400">
                          No Image
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-neutral-200 mt-2 text-center hover:underline">
                      {member.name}
                    </p>
                    <p className="text-xs text-neutral-400">{member.job}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default EpisodePage;
