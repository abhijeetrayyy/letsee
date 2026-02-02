import { Countrydata } from "@/staticData/countryName";
import Movie from "@components/clientComponent/movie";
import MovieRecoTile from "@components/movie/recoTiles";

import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

const getNumericId = (value: string) => {
  const match = String(value).match(/^\d+/);
  return match ? match[0] : null;
};

// import { likedButton as LikedButton } from "@/components/buttons/intrectionButton";
async function getMovieDetails(id: any) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}`,
    "Movie details"
  );
}

async function getCredit(id: any) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${process.env.TMDB_API_KEY}`,
    "Movie credits"
  );
}
async function getVideos(id: any) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/movie/${id}/videos?api_key=${process.env.TMDB_API_KEY}`,
    "Movie videos"
  );
}
async function getImages(id: any) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/movie/${id}/images?api_key=${process.env.TMDB_API_KEY}`,
    "Movie images"
  );
}

async function Reco(id: any) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/movie/${id}/similar?api_key=${process.env.TMDB_API_KEY}`,
    "Movie recommendations"
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = getNumericId(id);
  if (!numericId) {
    return {
      title: "Movie Not Found",
      description: "Invalid movie id.",
    };
  }
  const movieResult = await getMovieDetails(numericId);
  const movie = movieResult.data;

  return {
    title: movie?.title || "Movie Not Found",
    description:
      movie?.tagline || movieResult.error || "Discover amazing movies!",
    openGraph: {
      title: movie?.title || "Movie Not Found",
      description: movie?.tagline || "Discover amazing movies!",
      images: [
        {
          url:
            `https://image.tmdb.org/t/p/w342${movie?.poster_path}` ||
            "/default-image.jpg",
          width: 630,
          height: 1200,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: movie?.title || "Movie Not Found",
      description: movie?.tagline || "Discover amazing movies!",
      images: [
        `https://image.tmdb.org/t/p/w342${movie?.poster_path}` ||
          "/default-image.jpg",
      ],
    },
  };
}

const MovieDetails = async ({ params }: PageProps) => {
  const { id } = await params;
  const numericId = getNumericId(id);
  if (!numericId) {
    return notFound();
  }
  const [movieResult, creditsResult, videosResult, imagesResult, recoResult] =
    await Promise.all([
      getMovieDetails(numericId),
      getCredit(numericId),
      getVideos(numericId),
      getImages(numericId),
      Reco(numericId),
    ]);

  const errors = [
    movieResult.error,
    creditsResult.error,
    videosResult.error,
    imagesResult.error,
    recoResult.error,
  ].filter(Boolean) as string[];

  if (!movieResult.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-200 p-4">
        <div className="max-w-xl text-center">
          <p className="text-lg font-semibold">Movie data unavailable.</p>
          {errors.length > 0 && (
            <ul className="mt-3 text-sm text-amber-200 list-disc list-inside">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-neutral-400">
            Try refreshing in a moment.
          </p>
        </div>
      </div>
    );
  }

  const movie = movieResult.data;
  const credits = creditsResult.data ?? { cast: [], crew: [] };
  const videos = videosResult.data?.results ?? [];
  const Pimages = imagesResult.data?.posters ?? [];
  const Bimages = imagesResult.data?.backdrops ?? [];

  const originCountries = Array.isArray(movie.origin_country)
    ? movie.origin_country
    : [];
  const CountryName: any = originCountries.map((name: any) =>
    Countrydata.filter((item: any) => item.iso_3166_1 == name)
  );

  const RecoData = recoResult.data ?? { total_results: 0, results: [] };

  return (
    <div>
      <Movie
        CountryName={CountryName}
        videos={videos}
        Pimages={Pimages}
        Bimages={Bimages}
        movie={movie}
        credits={credits}
        id={numericId}
      />
      {RecoData.total_results > 0 && (
        <MovieRecoTile type={"movie"} title={movie.title} data={RecoData} />
      )}
    </div>
  );
};

export default MovieDetails;
