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

const MOVIE_REVALIDATE_SEC = 3600; // 1 hour

/** Single TMDB call for movie page: details + credits, videos, images, recommendations, similar (deduped by Next.js with generateMetadata). */
async function getMovieFull(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos,images,recommendations,similar`,
    "Movie full",
    { revalidate: MOVIE_REVALIDATE_SEC }
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
  const movieResult = await getMovieFull(numericId);
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
  const movieResult = await getMovieFull(numericId);
  const movie = movieResult.data;

  if (!movie) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-200 p-4">
        <div className="max-w-xl text-center">
          <p className="text-lg font-semibold">Movie data unavailable.</p>
          {movieResult.error && (
            <p className="mt-3 text-sm text-amber-200">{movieResult.error}</p>
          )}
          <p className="mt-3 text-sm text-neutral-400">
            Try refreshing in a moment.
          </p>
        </div>
      </div>
    );
  }

  const credits = movie.credits ?? { cast: [], crew: [] };
  const videos = (movie.videos?.results ?? []) as any[];
  const Pimages = movie.images?.posters ?? [];
  const Bimages = movie.images?.backdrops ?? [];

  const originCountries = Array.isArray(movie.origin_country)
    ? movie.origin_country
    : [];
  const CountryName: any = originCountries.map((name: any) =>
    Countrydata.filter((item: any) => item.iso_3166_1 == name)
  );

  const recoData = movie.recommendations ?? { total_results: 0, results: [] };
  const similarData = movie.similar ?? { total_results: 0, results: [] };

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
      {recoData.total_results > 0 && (
        <MovieRecoTile type="movie" title={movie.title} data={recoData} sectionTitle="More like this" />
      )}
      {similarData.total_results > 0 && (
        <MovieRecoTile type="movie" title={movie.title} data={similarData} sectionTitle="Similar to this" />
      )}
    </div>
  );
};

export default MovieDetails;
