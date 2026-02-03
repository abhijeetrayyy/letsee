import Tv from "@components/clientComponent/tv";
import MovieRecoTile from "@components/movie/recoTiles";
import { Metadata } from "next";
import { tmdbFetchJson } from "@/utils/tmdb";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

const getNumericId = (value: string) => {
  const match = String(value).match(/^\d+/);
  return match ? match[0] : null;
};

async function getShowDetails(id: string) {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,videos,images,external_ids,recommendations,similar`,
    "TV show details",
    { next: { revalidate: 600 } }
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = getNumericId(id);
  if (!numericId) {
    return {
      title: "TV Show Not Found",
      description: "Invalid TV show id.",
    };
  }
  const movieResult = await getShowDetails(numericId);
  const movie = movieResult.data;

  return {
    title: movie?.name || "Movie Not Found",
    description:
      movie?.tagline || movieResult.error || "Discover amazing movie/tv!",
    openGraph: {
      title: movie?.name || "Movie Not Found",
      description: movie?.tagline || "Discover amazing movie/tv!",
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
      title: movie?.name || "Movie Not Found",
      description: movie?.tagline || "Discover amazing movie/tv!",
      images: [
        `https://image.tmdb.org/t/p/w342${movie?.poster_path}` ||
          "/default-image.jpg",
      ],
    },
  };
}

const ShowDetails = async ({ params }: PageProps) => {
  const { id } = await params;
  const numericId = getNumericId(id);
  if (!numericId) {
    return notFound();
  }
  const showResult = await getShowDetails(numericId);
  const errors = [showResult.error].filter(Boolean) as string[];

  if (!showResult.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-200 p-4">
        <div className="max-w-xl text-center">
          <p className="text-lg font-semibold">TV show data unavailable.</p>
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

  const show = showResult.data;
  const ExternalIDs = show.external_ids ?? {};
  const { cast, crew } = show.credits ?? { cast: [], crew: [] };
  const { results: videos } = show.videos ?? { results: [] };
  const { posters: Pimages, backdrops: Bimages } = show.images ?? {
    posters: [],
    backdrops: [],
  };
  const recoData = show.recommendations ?? { total_results: 0, results: [] };
  const similarData = show.similar ?? { total_results: 0, results: [] };

  return (
    <div>
      <Tv
        show={show}
        ExternalIDs={ExternalIDs}
        videos={videos}
        Pimages={Pimages}
        Bimages={Bimages}
        cast={cast}
        crew={crew}
        id={numericId}
      />
      {recoData.total_results > 0 && (
        <MovieRecoTile type="tv" title={show.name} data={recoData} sectionTitle="More like this" />
      )}
      {similarData.total_results > 0 && (
        <MovieRecoTile type="tv" title={show.name} data={similarData} sectionTitle="Similar to this" />
      )}
    </div>
  );
};

export default ShowDetails;
