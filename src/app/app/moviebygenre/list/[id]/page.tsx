import Pagination from "@/components/buttons/serchbygenreBtn";
import { notFound } from "next/navigation";

import MoviebyGenre from "@components/clientComponent/moviebyGenre";
import { tmdbFetchJson } from "@/utils/tmdb";

const getMovieByGenre = async (page: number, genreId: string) => {
  return tmdbFetchJson<any>(
    `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&with_genres=${genreId}&page=${page}`,
    "Movies by genre",
    { next: { revalidate: 300 } }
  );
};

type SearchParams = Promise<{ page: number | number[] | undefined }>;
type Params = Promise<{ id: string }>;

interface PageProps {
  params: Params;
  searchParams: SearchParams;
}

const Page = async ({ params, searchParams }: PageProps) => {
  const { id } = await params;
  const currentPage = Number((await searchParams).page) || 1;

  if (!id) return notFound();

  const decodedId = decodeURIComponent(id);
  const [genreId, ...nameParts] = decodedId.split("-");
  const genreName = nameParts.join("-") || decodedId;

  const result = await getMovieByGenre(currentPage, genreId);

  if (!result.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-200 p-4">
        <div className="max-w-xl text-center">
          <p className="text-lg font-semibold">
            Movie genre results unavailable.
          </p>
          {result.error && (
            <p className="mt-3 text-sm text-amber-200">{result.error}</p>
          )}
          <p className="mt-3 text-sm text-neutral-400">
            Try refreshing in a moment.
          </p>
        </div>
      </div>
    );
  }

  const Sresults = result.data;

  return (
    <div className="min-h-screen mx-auto w-full max-w-7xl">
      <div>
        <p>
          Search Results: {genreName} &apos;
          {Sresults?.total_results}&apos; items
        </p>
      </div>
      <MoviebyGenre Sresults={Sresults} />

      {Sresults?.total_pages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Sresults.total_pages}
        />
      )}
    </div>
  );
};

export default Page;
